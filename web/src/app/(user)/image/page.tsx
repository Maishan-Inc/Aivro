"use client";

import { StudioEmptyState } from "@/components/studio-empty-state";
import { ImagePromptComposer } from "@/components/image-prompt-composer";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import { useImageComposerStore, type ImageComposerDraft } from "@/stores/use-image-composer-store";
import localforage from "localforage";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import studio from "@/components/studio-layout.module.css";

import { CheckSquare, Download, FileText, FolderPlus, History, PenLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Checkbox, Drawer, Dropdown, Image, Modal, Tag, Typography } from "antd";
import { saveAs } from "file-saver";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { GenerationHistoryDetailModal } from "@/components/generation-history-detail-modal";
import { formatDateTime } from "@/lib/datetime";
import { useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { nanoid } from "nanoid";
import { formatBytes, formatDuration, getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { cancelGenerationTask, fetchGenerationTask, requestEdit, requestGeneration, resumeGenerationTask, type GenerationQueueUpdate, type GenerationTaskView } from "@/services/api/image";
import { deleteGenerationHistory, fetchGenerationHistories, saveGenerationHistory, type GenerationHistory, type GenerationHistoryMedia } from "@/services/api/generation-history";
import { storeGeneratedImage, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";

type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    cloudFileId?: string;
    expiresAt?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "queued" | "executing" | "success" | "failed";
    aspectRatio?: string;
    image?: GeneratedImage;
    error?: string;
    taskId?: string;
    queuePosition?: number;
    aheadCount?: number;
};

type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "生成中" | "成功" | "失败";
    images: GeneratedImage[];
    thumbnails: string[];
    taskIds?: string[];
    history?: GenerationHistory;
};

type RecoverableGeneration = {
    prompt: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    userId: string;
    resultIds: string[];
    taskIds: Record<string, string>;
    startedAt: number;
};

const RECOVERY_KEY = "image-generation-recovery-v1";

type GenerationLogConfig = Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;

export default function ImagePage() {
    const { message } = App.useApp();
    const searchParams = useSearchParams();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const autoStarted = useRef(false);
    const restoring = useRef(false);
    const submittingRef = useRef(false);
    const [draftLoaded, setDraftLoaded] = useState("");
    const [draftConfig, setDraftConfig] = useState<GenerationLogConfig | null>(null);
    const publicReady = useConfigStore((state) => Boolean(state.publicSettings));
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const addAsset = useAssetStore((state) => state.addAsset);
    const token = useUserStore((state) => state.token);
    const userId = useUserStore((state) => state.user?.id || "");
    const userReady = useUserStore((state) => state.isReady);
    const profileCompleted = useUserStore((state) => state.user?.profileCompleted === true);
    const { prompt, references, setPrompt, setReferences } = useImageComposerStore();
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [pendingLog, setPendingLog] = useState<GenerationLog | null>(null);
    const [running, setRunning] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [detailHistory, setDetailHistory] = useState<GenerationHistory | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const model = effectiveConfig.imageModel || effectiveConfig.model;
    const visibleLogs = pendingLog ? [pendingLog, ...logs] : logs;

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, [token]);

    useEffect(() => {
        const urlPrompt = searchParams.get("prompt");
        if (urlPrompt) setPrompt(urlPrompt);
    }, [searchParams]);

    useEffect(() => {
        const draft = searchParams.get("draft");
        if (!draft) return;
        let active = true;
        void localforage.getItem<ImageComposerDraft>(`image-draft-${draft}`).then((value) => {
            if (!active || !value) return;
            setPrompt(value.prompt);
            setReferences(value.references);
            setDraftConfig(value.config);
            setDraftLoaded(draft);
        }).catch(() => message.error("无法读取创作草稿"));
        return () => { active = false; };
    }, [searchParams, setPrompt, setReferences, message]);

    const generate = async (selectedConfig?: GenerationLogConfig) => {
        if (running || submittingRef.current) return;
        const generationConfig = { ...effectiveConfig, ...selectedConfig };
        const generationModel = generationConfig.imageModel || generationConfig.model;
        const generationCount = Math.max(1, Math.min(10, Number(generationConfig.count) || 1));
        const text = prompt.trim();
        if (!text) {
            message.error("请输入生图提示词");
            return;
        }
        if (!isAiConfigReady(generationConfig, generationModel)) {
            message.warning("管理员尚未配置可用模型");
            return;
        }

        submittingRef.current = true;
        if (!token || !profileCompleted) {
            const draft = nanoid();
            try {
                await localforage.setItem(`image-draft-${draft}`, { prompt, references, config: { model: generationConfig.model, imageModel: generationConfig.imageModel, quality: generationConfig.quality, size: generationConfig.size, count: generationConfig.count } });
                const destination = localizedPath(`/image?draft=${draft}`);
                router.push(localizedPath(`/${token ? "profile/setup" : "login"}?redirect=${encodeURIComponent(destination)}`));
            } catch {
                message.error("无法保存创作草稿");
            } finally {
                submittingRef.current = false;
            }
            return;
        }
        const snapshot = { text, config: { ...generationConfig, model: generationModel, count: "1" }, references: [...references] };

        setElapsedMs(0);
        setRunning(true);
        setPreviewLog(null);
        setPendingLog(buildPendingLog({ prompt: text, model: generationModel, config: { ...snapshot.config, count: String(generationCount) }, references: snapshot.references, imageCount: generationCount }));
        const aspectRatio = imagePreviewAspectRatio(snapshot.config.size);
        const initialResults = Array.from({ length: generationCount }, () => ({ id: nanoid(), status: "pending" as const, aspectRatio }));
        setResults(initialResults);
        const recovery: RecoverableGeneration = { prompt: text, config: snapshot.config, references: snapshot.references, userId, resultIds: initialResults.map((item) => item.id), taskIds: {}, startedAt: Date.now() };
        await localforage.setItem(RECOVERY_KEY, recovery);
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);

        const tasks = Array.from({ length: generationCount }, (_, index) => runGenerationSlot(index, snapshot));

        const result = await Promise.allSettled(tasks);
        const failed = result.find((item): item is PromiseRejectedResult => item.status === "rejected");
        const savedRecovery = await localforage.getItem<RecoverableGeneration>(RECOVERY_KEY);
        await saveGenerationResults(result, snapshot.text, generationModel, { ...snapshot.config, count: String(generationCount) }, snapshot.references, Object.values(savedRecovery?.taskIds || {}), performance.now() - batchStartedAt, failed?.reason);
        await localforage.removeItem(RECOVERY_KEY);
        setPendingLog(null);
        setRunning(false);
        submittingRef.current = false;
    };

    const saveGenerationResults = async (result: PromiseSettledResult<GeneratedImage>[], prompt: string, generationModel: string, config: GenerationLogConfig, references: ReferenceImage[], taskIds: string[], durationMs: number, failure?: unknown) => {
        const successImages = result.filter((item): item is PromiseFulfilledResult<GeneratedImage> => item.status === "fulfilled").map((item) => item.value);
        const successCount = successImages.length;
        const failCount = result.length - successCount;
        try {
            const logImages = await Promise.all(
                successImages.map(async (image) => {
                    const stored = await storeGeneratedImage(image);
                    return { ...image, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType };
                }),
            );
            await saveLog(
                buildLog({
                    prompt,
                    model: generationModel,
                    config,
                    references,
                    durationMs,
                    successCount,
                    failCount,
                    status: successCount ? "成功" : "失败",
                    images: logImages,
                    taskIds,
                }),
            );
            successCount ? message.success("图片已生成") : message.error(failure instanceof Error ? failure.message : "生成失败");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生成记录保存失败");
        }
    };

    useEffect(() => {
        if (userReady && token) void restoreGeneration();
    }, [token, userReady, userId]);

    const cancelQueuedResult = async (result: GenerationResult) => {
        if (!result.taskId) return;
        try {
            await cancelGenerationTask({ ...effectiveConfig, model }, result.taskId);
            setResults((value) => value.map((item) => (item.id === result.id ? { ...item, status: "failed", error: "任务已撤销" } : item)));
            message.success("已撤销排队任务");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "撤销失败");
        }
    };

    const downloadImage = (image: GeneratedImage, index: number) => {
        saveAs(image.dataUrl, `image-${index + 1}.png`);
    };

    const addResultToReferences = async (image: GeneratedImage, index: number) => {
        const stored = await storeGeneratedImage(image);
        setReferences((value) => [...value, { id: nanoid(), name: `result-${index + 1}.png`, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }]);
        message.success("已加入参考图");
    };

    const saveResultToAssets = async (image: GeneratedImage, index: number) => {
        try {
            const stored = await storeGeneratedImage(image);
            await addAsset({
                kind: "image",
                title: `生成结果 ${index + 1}`,
                coverUrl: stored.url,
                tags: [],
                source: "生图工作台",
                data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
                metadata: { source: "image-page", prompt },
            });
            message.success("已加入我的素材");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "素材操作失败，请重试");
        }
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = () => {
        if (!token) return;
        void Promise.all(selectedLogIds.map((id) => deleteGenerationHistory(token, id))).then(refreshLogs);
        if (previewLog && selectedLogIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLog = async (log: GenerationLog) => {
        if (!token) {
            message.warning("请先登录后再保存云端生成记录");
            return;
        }
        const media = log.images.map(imageToHistoryMedia).filter((item): item is GenerationHistoryMedia => Boolean(item));
        if (!media.length) {
            message.warning("生成结果未转存到云端，无法同步生成记录");
            return;
        }
        const storedReferences = await Promise.all(log.references.map(async (item) => {
            if (item.storageKey?.startsWith("cloud:")) return item;
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey, type: image.mimeType };
        }));
        await saveGenerationHistory(token, {
            type: "image",
            title: log.title,
            prompt: log.prompt,
            model: log.model,
            config: {
                model: log.config.model || "",
                imageModel: log.config.imageModel || "",
                quality: log.config.quality || "",
                size: log.config.size || "",
                count: log.config.count || "",
                taskIds: (log.taskIds || []).join(","),
            },
            references: storedReferences.map((item) => ({ name: item.name, type: item.type, url: item.dataUrl, storageKey: item.storageKey || "" })),
            media,
            status: log.status === "生成中" ? "失败" : log.status,
            error: "",
            durationMs: Math.round(log.durationMs),
        });
        await refreshLogs();
    };

    const refreshLogs = async () => {
        if (!token) {
            setLogs([]);
            return;
        }
        const data = await fetchGenerationHistories(token, { type: "image", pageSize: 100 });
        setLogs(data.items.map(historyToImageLog));
    };

    const previewGenerationLog = async (log: GenerationLog) => {
        setPreviewLog(log);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        useConfigStore.getState().setConfig(log.config, false);
        setResults(log.images.length ? log.images.map((image) => ({ id: image.id, status: "success", image })) : [{ id: log.id, status: "failed", error: log.history?.error || "生成失败" }]);
    };

    const updateRecovery = async (update: (recovery: RecoverableGeneration) => void) => {
        const recovery = await localforage.getItem<RecoverableGeneration>(RECOVERY_KEY);
        if (!recovery) return;
        update(recovery);
        await localforage.setItem(RECOVERY_KEY, recovery);
    };

    const restoreGeneration = async () => {
        if (restoring.current || !token) return;
        restoring.current = true;
        try {
            const recovery = await localforage.getItem<RecoverableGeneration>(RECOVERY_KEY);
            if (!recovery || !Object.keys(recovery.taskIds).length || !Array.isArray(recovery.resultIds)) return;
            if (recovery.userId !== userId) return;
            const savedLogs = await fetchGenerationHistories(token, { type: "image", pageSize: 100 });
            const savedTaskIds = new Set(savedLogs.items.flatMap((item) => (item.config?.taskIds || "").split(",").filter(Boolean)));
            const pendingEntries = Object.entries(recovery.taskIds).filter(([resultId, taskId]) => recovery.resultIds.includes(resultId) && !savedTaskIds.has(taskId));
            if (!pendingEntries.length) {
                await localforage.removeItem(RECOVERY_KEY);
                await refreshLogs();
                return;
            }
            const tasks = await Promise.all(pendingEntries.map(([, taskId]) => fetchGenerationTask(effectiveConfig, taskId).catch(() => null)));
            const activeTasks = tasks.filter((task): task is GenerationTaskView => Boolean(task));
            if (!activeTasks.length) return;
            setPrompt(recovery.prompt);
            setReferences(recovery.references);
            useConfigStore.getState().setConfig(recovery.config, false);
            const aspectRatio = imagePreviewAspectRatio(recovery.config.size);
            setResults(recovery.resultIds.map((id) => {
                const task = activeTasks.find((item) => item.id === recovery.taskIds[id]);
                return { ...taskToResult(task, aspectRatio), id };
            }));
            const generating = activeTasks.some((task) => task.status === "queued" || task.status === "executing");
            setRunning(generating);
            if (generating) setPendingLog(buildPendingLog({ prompt: recovery.prompt, model: recovery.config.imageModel || recovery.config.model, config: recovery.config, references: recovery.references, imageCount: recovery.resultIds.length }));
            if (generating) setStartedAt(performance.now() - Math.max(0, Date.now() - recovery.startedAt));
            activeTasks.forEach((task) => {
                if (task.status === "failed" || task.status === "canceled") {
                    const resultId = Object.keys(recovery.taskIds).find((id) => recovery.taskIds[id] === task.id) || "";
                    setResults((value) => updateResultAt(value, recovery.resultIds.indexOf(resultId), { status: "failed", error: task.error || (task.status === "canceled" ? "任务已撤销" : "生成失败") }));
                }
            });
            const result = await Promise.allSettled(activeTasks.map(async (task, index): Promise<GeneratedImage> => {
                const onQueue = (update: GenerationQueueUpdate) => {
                    setResults((value) => updateResultAt(value, recovery.resultIds.indexOf(pendingEntries[index][0]), { status: update.status === "queued" || update.status === "executing" ? update.status : update.status === "succeeded" ? "pending" : "failed", error: task.error, taskId: update.taskId, queuePosition: update.queuePosition, aheadCount: update.aheadCount }));
                };
                const images = await resumeGenerationTask(effectiveConfig, task, onQueue);
                const image = images[0];
                if (!image) throw new Error("接口没有返回图片");
                const meta = await readImageMeta(image.dataUrl);
                const nextImage: GeneratedImage = { id: image.id, dataUrl: image.dataUrl, storageKey: image.storageKey, cloudFileId: image.cloudFileId, expiresAt: image.expiresAt, durationMs: Math.max(0, Date.now() - recovery.startedAt), width: meta.width, height: meta.height, bytes: image.bytes ?? getDataUrlByteSize(image.dataUrl), mimeType: image.mimeType };
                setResults((value) => updateResultAt(value, recovery.resultIds.indexOf(pendingEntries[index][0]), { status: "success", image: nextImage }));
                return nextImage;
            }));
            const failed = result.find((item): item is PromiseRejectedResult => item.status === "rejected");
            await saveGenerationResults(result, recovery.prompt, recovery.config.imageModel || recovery.config.model, recovery.config, recovery.references, activeTasks.map((task) => task.id), Date.now() - recovery.startedAt, failed?.reason);
            await localforage.removeItem(RECOVERY_KEY);
            setPendingLog(null);
            await refreshLogs();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "恢复生成任务失败");
        } finally {
            setRunning(false);
            restoring.current = false;
        }
    };

    const runGenerationSlot = async (index: number, snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }): Promise<GeneratedImage> => {
        const itemStartedAt = performance.now();
        try {
            const onQueue = async (update: GenerationQueueUpdate) => {
                await updateRecovery((recovery) => { recovery.taskIds[recovery.resultIds[index]] = update.taskId; });
                setResults((value) =>
                    updateResultAt(value, index, {
                        status: update.status === "queued" ? "queued" : "executing",
                        taskId: update.taskId,
                        queuePosition: update.queuePosition,
                        aheadCount: update.aheadCount,
                    }),
                );
            };
            const result = snapshot.references.length ? await requestEdit(snapshot.config, snapshot.text, snapshot.references, onQueue) : await requestGeneration(snapshot.config, snapshot.text, onQueue);
            const image = result[0];
            if (!image) throw new Error("接口没有返回图片");
            const meta = await readImageMeta(image.dataUrl);
            const nextImage: GeneratedImage = { id: image.id, dataUrl: image.dataUrl, storageKey: image.storageKey, cloudFileId: image.cloudFileId, expiresAt: image.expiresAt, durationMs: performance.now() - itemStartedAt, width: meta.width, height: meta.height, bytes: image.bytes ?? getDataUrlByteSize(image.dataUrl), mimeType: image.mimeType };
            setResults((value) => updateResultAt(value, index, { status: "success", image: nextImage }));
            return nextImage;
        } catch (error) {
            setResults((value) => updateResultAt(value, index, { status: "failed", error: error instanceof Error ? error.message : "生成失败" }));
            throw error;
        }
    };

    useEffect(() => {
        if (!draftLoaded || !draftConfig || autoStarted.current || !token || !userReady || !profileCompleted || !publicReady) return;
        autoStarted.current = true;
        void localforage.removeItem(`image-draft-${draftLoaded}`).then(() => {
            setDraftLoaded("");
            window.history.replaceState(null, "", localizedPath("/image"));
            useConfigStore.getState().setConfig(draftConfig, false);
            void generate(draftConfig);
        }).catch(() => message.error("无法提交创作草稿，请手动发送"));
    }, [draftLoaded, draftConfig, token, userReady, profileCompleted, publicReady]);

    return (
        <div className={studio.studio}>
            <main className={studio.layout}>
                <section className={studio.panels}>
                    <header className={studio.header}>
                        <div><h1>生图工作台</h1><p>从一句描述开始，让画面自然发生。</p></div>
                        <div className={studio.headerActions}>
                            <Button type="text" icon={<Plus size={15} />} disabled={running} onClick={createSession}>新建</Button>
                            <div className={studio.historyActions}><Button type="text" icon={<History size={15} />} onClick={() => setLogsOpen(true)}>记录</Button></div>
                        </div>
                    </header>
                    <div className={studio.results}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold">生成结果</h2>
                            </div>
                            {running ? <Tag className="m-0 px-2 py-1">等待 {formatDuration(elapsedMs)}</Tag> : null}
                        </div>
                        {results.length ? (
                            <div className={`grid gap-4 ${results.length > 1 ? "sm:grid-cols-2 2xl:grid-cols-3" : ""}`}>
                                {results.map((result, index) => {
                                    const single = results.length === 1;
                                    return result.status === "success" && result.image ? (
                                        <ResultImageCard key={result.id} single={single} image={result.image} index={index} onEdit={addResultToReferences} onDownload={downloadImage} onSaveAsset={saveResultToAssets} />
                                    ) : result.status === "failed" ? (
                                        <FailedImageCard key={result.id} single={single} aspectRatio={result.aspectRatio} error={result.error || "生成失败"} />
                                    ) : result.status === "queued" ? (
                                        <QueuedImageCard key={result.id} single={single} aspectRatio={result.aspectRatio} aheadCount={result.aheadCount ?? 0} queuePosition={result.queuePosition ?? 0} onCancel={() => void cancelQueuedResult(result)} />
                                    ) : result.status === "executing" ? (
                                        <PendingImageCard key={result.id} single={single} aspectRatio={result.aspectRatio} label="生成中" />
                                    ) : (
                                        <PendingImageCard key={result.id} single={single} aspectRatio={result.aspectRatio} />
                                    );
                                })}
                            </div>
                        ) : (
                            <StudioEmptyState kind="image" onUsePrompt={setPrompt} />
                        )}
                    </div>
                    <div className={studio.form}>
                        <ImagePromptComposer onSubmit={() => void generate()} running={running} />
                        <p className={studio.composerHint}>Enter 生成 · Shift + Enter 换行 · 参考图发送时提交</p>
                    </div>
                </section>
                <StudioHistorySidebar items={visibleLogs.map((log) => ({ id: log.id, title: log.title, prompt: log.prompt, preview: log.thumbnails[0] }))} onSelect={(id) => { const log = visibleLogs.find((item) => item.id === id); if (log) void previewGenerationLog(log); }}>
                    <LogPanel
                        logs={visibleLogs}
                        selectedLogIds={selectedLogIds}
                        activeLogId={previewLog?.id}
                        onSelectedLogIdsChange={setSelectedLogIds}
                        onCreateSession={createSession}
                        onDeleteSelected={() => setDeleteConfirmOpen(true)}
                        onPreviewLog={(log) => void previewGenerationLog(log)}
                        onOpenDetail={(log) => log.history && setDetailHistory(log.history)}
                    />
                </StudioHistorySidebar>
            </main>
            <Drawer title="生成记录" placement="right" size={340} open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel
                    logs={visibleLogs}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onPreviewLog={(log) => void previewGenerationLog(log)}
                    onOpenDetail={(log) => log.history && setDetailHistory(log.history)}
                />
            </Drawer>

            <Modal centered title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？
            </Modal>
            <GenerationHistoryDetailModal open={Boolean(detailHistory)} history={detailHistory} onClose={() => setDetailHistory(null)} />
        </div>
    );
}

function ResultImageCard({
    image,
    index,
    single,
    onEdit,
    onDownload,
    onSaveAsset,
}: {
    image: GeneratedImage;
    index: number;
    single?: boolean;
    onEdit: (image: GeneratedImage, index: number) => void;
    onDownload: (image: GeneratedImage, index: number) => void;
    onSaveAsset: (image: GeneratedImage, index: number) => void;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <Image src={image.dataUrl} alt={`生成结果 ${index + 1}`} className={single ? "w-full" : "aspect-square object-cover"} />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {image.width}x{image.height}
                    </span>
                    <span>{formatBytes(image.bytes)}</span>
                    <span>{formatDuration(image.durationMs)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(image, index)}>
                        添加到素材
                    </Button>
                    <Button size="small" icon={<PenLine className="size-3.5" />} onClick={() => void onEdit(image, index)}>
                        加入参考图
                    </Button>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(image, index)}>
                        下载
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingImageCard({ label = "生成中", single, aspectRatio }: { label?: string; single?: boolean; aspectRatio?: string }) {
    const ratioStyle = single && aspectRatio ? { aspectRatio } : undefined;
    return (
        <div className={`relative ${single ? (aspectRatio ? "" : "min-h-[280px]") : "aspect-square"} overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900`} style={ratioStyle}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-stone-400">
                <AivroDrawableLoader className="h-28 w-80 text-stone-900 dark:text-stone-100" />
                <span className="text-sm">{label}</span>
            </div>
        </div>
    );
}

function QueuedImageCard({ aheadCount, queuePosition, onCancel, single, aspectRatio }: { aheadCount: number; queuePosition: number; onCancel: () => void; single?: boolean; aspectRatio?: string }) {
    const ratioStyle = single && aspectRatio ? { aspectRatio } : undefined;
    return (
        <div className={`relative ${single ? (aspectRatio ? "" : "min-h-[280px]") : "aspect-square"} overflow-hidden rounded-lg border border-dashed border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20`} style={ratioStyle}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-blue-700 dark:text-blue-200">
                <AivroDrawableLoader className="h-24 w-72 text-blue-700 dark:text-blue-200" />
                <div className="text-sm font-medium">排队中</div>
                <div className="text-xs text-blue-600 dark:text-blue-300">前方 {aheadCount} 位 · 当前第 {queuePosition} 位</div>
                <Button size="small" danger onClick={onCancel}>撤销任务</Button>
            </div>
        </div>
    );
}

function FailedImageCard({ error, single, aspectRatio }: { error: string; single?: boolean; aspectRatio?: string }) {
    const ratioStyle = single && aspectRatio ? { aspectRatio } : undefined;
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className={`flex ${single ? (aspectRatio ? "" : "min-h-[200px]") : "aspect-square"} flex-col items-center justify-center gap-3 p-5 text-center`} style={ratioStyle}>
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
        </div>
    );
}

function updateResultAt(results: GenerationResult[], index: number, next: Partial<GenerationResult>) {
    return results.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function imagePreviewAspectRatio(size?: string) {
    const normalized = (size || "").trim().replace(/：/g, ":").toLowerCase();
    if (!normalized || normalized === "auto") return undefined;
    const dimensions = normalized.match(/^(\d+)\s*x\s*(\d+)$/);
    const ratio = dimensions || normalized.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (!ratio) return undefined;
    const width = Number(ratio[1]);
    const height = Number(ratio[2]);
    if (!width || !height) return undefined;
    return `${width} / ${height}`;
}

function LogPanel({
    logs,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onPreviewLog,
    onOpenDetail,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onPreviewLog: (log: GenerationLog) => void;
    onOpenDetail: (log: GenerationLog) => void;
}) {
    const selectableLogs = logs.filter((log) => log.status !== "生成中");
    const allSelected = Boolean(selectableLogs.length) && selectedLogIds.length === selectableLogs.length;
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : selectableLogs.map((log) => log.id));

    return (
        <>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">生成记录</h2>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Free 用户生成记录最多保存 7 天</p>
                </div>
                <Tag className="m-0">{logs.length}</Tag>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
                <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                    新建
                </Button>
                <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!selectableLogs.length} onClick={toggleAll}>
                    {allSelected ? "取消" : "全选"}
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                    删除
                </Button>
            </div>
            <div className="space-y-3">
                {logs.map((log) => (
                    <LogCard
                        key={log.id}
                        log={log}
                        selected={selectedLogIds.includes(log.id)}
                        active={activeLogId === log.id}
                        onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))}
                        onClick={() => onPreviewLog(log)}
                        onOpenDetail={() => onOpenDetail(log)}
                    />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick, onOpenDetail }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void; onOpenDetail: () => void }) {
    const detailMenu = {
        items: [{ key: "detail", disabled: !log.history, icon: <FileText className="size-4" />, label: "详情" }],
        onClick: ({ key }: { key: string }) => {
            if (key === "detail") onOpenDetail();
        },
    };

    if (log.status === "生成中") {
        return (
            <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-stone-300 bg-background p-2 text-stone-900 dark:border-stone-700 dark:text-stone-100">
                <AivroDrawableLoader className="h-20 w-56 text-stone-900 dark:text-stone-100" />
            </div>
        );
    }

    return (
        <Dropdown trigger={["contextMenu"]} menu={detailMenu}>
            <button type="button" className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`} onClick={onClick}>
                <div className="grid grid-cols-[minmax(128px,1fr)_auto] gap-2">
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                        <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-4 text-stone-500 dark:text-stone-400">{log.prompt || "无提示词"}</div>
                            {log.thumbnails?.length ? (
                                <div className="mt-2 grid grid-cols-4 gap-1.5">
                                    {log.thumbnails.slice(0, 4).map((image, index) => (
                                        <img key={`${log.id}-${index}`} src={image} alt="" className="aspect-square min-w-0 rounded-md object-cover" />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="grid justify-items-end gap-2">
                        <div className="flex gap-1">
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="blue">
                                成功 {log.successCount ?? log.imageCount}
                            </Tag>
                            {log.failCount ? (
                                <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="red">
                                    失败 {log.failCount}
                                </Tag>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.imageCount} 张</Tag>
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                                {formatDuration(log.durationMs)}
                            </Tag>
                        </div>
                        <div className="flex justify-end">
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.time}</Tag>
                        </div>
                    </div>
                </div>
            </button>
        </Dropdown>
    );
}

function historyToImageLog(history: GenerationHistory): GenerationLog {
    const config = normalizeLogConfig({
        config: {
            model: history.config?.model,
            imageModel: history.config?.imageModel,
            quality: history.config?.quality,
            size: history.config?.size,
            count: history.config?.count,
        },
        model: history.model,
    });
    const images = history.media.map((item) => ({
        id: item.cloudFileId,
        dataUrl: item.url,
        storageKey: item.storageKey,
        cloudFileId: item.cloudFileId,
        expiresAt: item.expiresAt,
        durationMs: history.durationMs,
        width: item.width || 0,
        height: item.height || 0,
        bytes: item.size || 0,
        mimeType: item.contentType,
    }));
    return {
        id: history.id,
        createdAt: Date.parse(history.createdAt) || Date.now(),
        title: history.title || history.model || "未命名",
        prompt: history.prompt || history.title || "",
        time: formatDateTime(history.createdAt),
        model: history.model || config.imageModel || "",
        config,
        references: (history.references || []).map((item, index) => ({ id: `${history.id}-ref-${index}`, name: item.name, type: item.type, dataUrl: item.url, storageKey: item.storageKey })),
        durationMs: history.durationMs || 0,
        successCount: images.length,
        failCount: 0,
        imageCount: images.length,
        size: config.size || "",
        quality: config.quality || "",
        status: history.status || "成功",
        images,
        thumbnails: images.map((image) => image.dataUrl),
        taskIds: (history.config?.taskIds || "").split(",").filter(Boolean),
        history,
    };
}

function imageToHistoryMedia(image: GeneratedImage): GenerationHistoryMedia | null {
    const cloudFileId = image.cloudFileId || (image.storageKey?.startsWith("cloud:") ? image.storageKey.slice("cloud:".length) : "");
    if (!cloudFileId || !image.storageKey?.startsWith("cloud:")) return null;
    return {
        cloudFileId,
        storageKey: image.storageKey,
        url: image.dataUrl,
        fileType: "image",
        contentType: image.mimeType || "image/png",
        size: image.bytes || 0,
        width: image.width || 0,
        height: image.height || 0,
        expiresAt: image.expiresAt || "",
    };
}

function taskToResult(task: GenerationTaskView | undefined, aspectRatio?: string): GenerationResult {
    if (!task) return { id: nanoid(), status: "failed", aspectRatio, error: "任务不存在或已过期" };
    return {
        id: task.id,
        status: task.status === "queued" || task.status === "executing" ? task.status : task.status === "succeeded" ? "pending" : "failed",
        aspectRatio,
        error: task.error || (task.status === "canceled" ? "任务已撤销" : undefined),
        taskId: task.id,
        queuePosition: task.queuePosition,
        aheadCount: task.aheadCount,
    };
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        imageModel: log.config?.imageModel || log.model || "",
        quality: log.config?.quality || log.quality || "",
        size: log.config?.size || log.size || "",
        count: log.config?.count || String(log.imageCount || log.successCount || 1),
    };
}

function buildPendingLog({ prompt, model, config, references, imageCount }: { prompt: string; model: string; config: GenerationLogConfig; references: ReferenceImage[]; imageCount: number }): GenerationLog {
    const logConfig = {
        model: config.model,
        imageModel: config.imageModel,
        quality: config.quality,
        size: config.size,
        count: config.count,
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: "",
        model,
        config: logConfig,
        references,
        durationMs: 0,
        successCount: 0,
        failCount: 0,
        imageCount,
        size: logConfig.size,
        quality: logConfig.quality,
        status: "生成中",
        images: [],
        thumbnails: [],
    };
}

function buildLog({
    prompt,
    model,
    config,
    references,
    durationMs,
    successCount,
    failCount,
    status,
    images,
    taskIds,
}: {
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    status: Exclude<GenerationLog["status"], "生成中">;
    images: GeneratedImage[];
    taskIds?: string[];
}): GenerationLog {
    const logConfig = {
        model: config.model,
        imageModel: config.imageModel,
        quality: config.quality,
        size: config.size,
        count: config.count,
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: formatDateTime(Date.now()),
        model,
        config: logConfig,
        references,
        durationMs,
        successCount,
        failCount,
        imageCount: Number(logConfig.count) || successCount,
        size: logConfig.size,
        quality: logConfig.quality,
        status,
        images,
        thumbnails: images.map((image) => image.dataUrl),
        taskIds,
    };
}
