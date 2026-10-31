"use client";

import { StudioEmptyState } from "@/components/studio-empty-state";
import { StudioGenerationSettings } from "@/components/studio-generation-settings";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import studio from "@/components/studio-layout.module.css";
import composer from "@/components/image-prompt-composer.module.css";

import { ArrowUp, BookOpen, CheckSquare, ClipboardPaste, Download, FileText, FolderPlus, History, LoaderCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { App, Button, Checkbox, Drawer, Dropdown, Input, Modal, Tag, Typography } from "antd";
import { useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";

import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { GenerationHistoryDetailModal } from "@/components/generation-history-detail-modal";
import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { normalizeVideoResolutionValue, normalizeVideoSizeValue } from "@/components/video-settings-panel";
import { formatDateTime } from "@/lib/datetime";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { uploadMediaFile } from "@/services/file-storage";
import { deleteGenerationHistory, fetchGenerationHistories, saveGenerationHistory, type GenerationHistory, type GenerationHistoryMedia } from "@/services/api/generation-history";
import { uploadImage } from "@/services/image-storage";
import { requestVideoGeneration } from "@/services/api/video";
import { useAssetStore } from "@/stores/use-asset-store";
import { useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    cloudFileId?: string;
    expiresAt?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    video?: GeneratedVideo;
    error?: string;
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
    size: string;
    resolution: string;
    seconds: string;
    status: "成功" | "失败";
    video?: GeneratedVideo;
    error?: string;
    history?: GenerationHistory;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "size" | "vquality" | "videoSeconds">;

export default function VideoPage() {
    const searchParams = useSearchParams();
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const addAsset = useAssetStore((state) => state.addAsset);
    const token = useUserStore((state) => state.token);
    const [prompt, setPrompt] = useState("");
    const [composerFocused, setComposerFocused] = useState(false);
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [running, setRunning] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [detailHistory, setDetailHistory] = useState<GenerationHistory | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const model = effectiveConfig.videoModel;
    const canGenerate = Boolean(prompt.trim());
    const composerExpanded = composerFocused || canGenerate || references.length > 0;

    useEffect(() => {
        const urlPrompt = searchParams.get("prompt");
        if (urlPrompt) setPrompt(urlPrompt);
    }, [searchParams]);

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, [token]);

    const addReferences = async (files?: FileList | File[] | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/")).slice(0, 7 - references.length);
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => [...value, ...nextReferences].slice(0, 7));
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, 7 - references.length).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, 7));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };

    const generate = async () => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setElapsedMs(0);
        setRunning(true);
        setPreviewLog(null);
        setResults([{ id: nanoid(), status: "pending" }]);
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);
        try {
            const media = await requestVideoGeneration(snapshot.config, snapshot.text, snapshot.references);
            const stored = await uploadMediaFile(media, "video");
            const nextVideo: GeneratedVideo = {
                id: nanoid(),
                url: stored.url,
                storageKey: stored.storageKey,
                cloudFileId: stored.cloudFileId,
                expiresAt: stored.expiresAt,
                durationMs: performance.now() - batchStartedAt,
                width: stored.width || 1280,
                height: stored.height || 720,
                bytes: stored.bytes,
                mimeType: stored.mimeType,
            };
            setResults([{ id: nextVideo.id, status: "success", video: nextVideo }]);
            saveLog(buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: nextVideo.durationMs, status: "成功", video: nextVideo }));
            message.success("视频已生成");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            setResults([{ id: nanoid(), status: "failed", error: errorMessage }]);
            saveLog(buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: performance.now() - batchStartedAt, status: "失败", error: errorMessage }));
            message.error(errorMessage);
        } finally {
            setRunning(false);
        }
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入视频提示词");
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("管理员尚未配置可用模型");
            return null;
        }
        return { text, config: buildVideoConfig(effectiveConfig, model), references: [...references] };
    };

    const retryResult = () => {
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const saveResultToAssets = async (video: GeneratedVideo) => {
        try {
            await addAsset({
                kind: "video",
                title: "生成视频",
                coverUrl: "",
                tags: [],
                source: "视频创作台",
                data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
                metadata: { source: "video-page", prompt },
            });
            message.success("已加入我的素材");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "素材操作失败，请重试");
        }
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, 7));
        }
        setAssetPickerOpen(false);
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

    const saveLog = (log: GenerationLog) => {
        if (!token || !log.video) {
            if (!token && log.video) message.warning("请先登录后再保存云端生成记录");
            return;
        }
        const media = videoToHistoryMedia(log.video);
        if (!media) {
            message.warning("生成结果未转存到云端，无法同步生成记录");
            return;
        }
        void saveGenerationHistory(token, {
            type: "video",
            title: log.title,
            prompt: log.prompt,
            model: log.model,
            config: {
                model: log.config.model || "",
                videoModel: log.config.videoModel || "",
                size: log.config.size || "",
                vquality: log.config.vquality || "",
                videoSeconds: log.config.videoSeconds || "",
            },
            references: log.references.map((item) => ({ name: item.name, type: item.type, url: item.dataUrl, storageKey: item.storageKey || "" })),
            media: [media],
            status: log.status,
            error: log.error || "",
            durationMs: Math.round(log.durationMs),
        }).then(refreshLogs);
    };

    const refreshLogs = async () => {
        if (!token) {
            setLogs([]);
            return;
        }
        const data = await fetchGenerationHistories(token, { type: "video", pageSize: 100 });
        setLogs(data.items.map(historyToVideoLog));
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        if (log.config.videoModel || log.model) updateConfig("videoModel", log.config.videoModel || log.model);
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        setResults(log.video ? [{ id: log.video.id, status: "success", video: log.video }] : [{ id: log.id, status: "failed", error: log.error || "生成失败" }]);
    };

    return (
        <div className={studio.studio}>
            <main className={studio.layout}>
                <section className={studio.panels}>
                    <header className={studio.header}>
                        <div><h1>视频创作台</h1><p>让画面拥有时间，让故事继续发生。</p></div>
                        <div className={studio.headerActions}>
                            <Button type="text" icon={<Plus size={15} />} disabled={running} onClick={createSession}>新建</Button>
                            <div className={studio.historyActions}><Button type="text" icon={<History size={15} />} onClick={() => setLogsOpen(true)}>记录</Button></div>
                        </div>
                    </header>
                    <div className={studio.results}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">生成结果</h2>
                            {running ? <Tag className="m-0 px-2 py-1">等待 {formatDuration(elapsedMs)}</Tag> : null}
                        </div>
                        {results.length ? (
                            <div className="grid gap-4">
                                {results.map((result) => (result.status === "success" && result.video ? <ResultVideoCard key={result.id} video={result.video} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} /> : result.status === "failed" ? <FailedVideoCard key={result.id} error={result.error || "生成失败"} onRetry={retryResult} /> : <PendingVideoCard key={result.id} />))}
                            </div>
                        ) : (
                            <StudioEmptyState kind="video" onUsePrompt={setPrompt} />
                        )}
                    </div>
                    <div className={studio.form}>
                        <div className={composer.composer} data-expanded={composerExpanded} onFocus={() => setComposerFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerFocused(false); }}>
                            {references.length ? <div className={composer.references}>
                                {references.map((item) => <div key={item.id} className={composer.reference}>
                                    <img src={item.dataUrl} alt={item.name} />
                                    <button type="button" onClick={() => setReferences((value) => value.filter((ref) => ref.id !== item.id))} aria-label="移除参考图"><X size={13} /></button>
                                </div>)}
                            </div> : null}
                            <div className={composer.main}><div className={composer.body}>
                            <div className={composer.inputRow}>
                            <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} variant="borderless" autoSize={{ minRows: 1 }} disabled={running} aria-label="视频提示词" placeholder="描述你的故事、镜头运动和场景氛围…" onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    if (canGenerate && !running) void generate();
                                }
                            }} onPaste={(event) => {
                                const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                                if (files.length) { event.preventDefault(); void addReferences(files); }
                            }} />
                            </div>
                            <div className={composer.controls}><div><div className={composer.toolbar} inert={!composerExpanded}>
                                <div className={composer.toolbarRow}>
                                <Dropdown trigger={["click"]} placement="topLeft" disabled={running} menu={{ items: [
                                    { key: "upload", icon: <Upload size={15} />, label: "上传参考图" },
                                    { key: "clipboard", icon: <ClipboardPaste size={15} />, label: "读取剪切板图片" },
                                    { key: "assets", icon: <FolderPlus size={15} />, label: "我的素材" },
                                    { key: "prompts", icon: <BookOpen size={15} />, label: "提示词库" },
                                ], onClick: ({ key }) => {
                                    if (key === "upload") fileInputRef.current?.click();
                                    if (key === "clipboard") void addReferencesFromClipboard();
                                    if (key === "assets") setAssetPickerOpen(true);
                                    if (key === "prompts") setPromptDialogOpen(true);
                                } }}>
                                    <Button type="text" shape="circle" icon={<Plus size={19} />} aria-label="添加参考图或选择灵感" />
                                </Dropdown>
                                <StudioGenerationSettings kind="video" part="model" />
                                </div>
                                <div className={composer.toolbarRow}><StudioGenerationSettings kind="video" part="settings" /></div>
                            </div></div></div>
                            </div>
                                <Button className={composer.send} type="primary" shape="circle" icon={<ArrowUp size={20} />} loading={running} disabled={!canGenerate || running} onClick={() => void generate()} aria-label="开始生成" title="开始生成" />
                            </div>
                        </div>
                        <p className={studio.composerHint}>Enter 生成 · Shift + Enter 换行 · 最多 7 张参考图</p>
                    </div>
                </section>
                <StudioHistorySidebar items={logs.map((log) => ({ id: log.id, title: log.title, prompt: log.prompt, preview: log.references[0]?.dataUrl, video: log.video?.url }))} onSelect={(id) => { const log = logs.find((item) => item.id === id); if (log) previewGenerationLog(log); }}>
                    <LogPanel logs={logs} selectedLogIds={selectedLogIds} activeLogId={previewLog?.id} onSelectedLogIdsChange={setSelectedLogIds} onCreateSession={createSession} onDeleteSelected={() => setDeleteConfirmOpen(true)} onPreviewLog={previewGenerationLog} onOpenDetail={(log) => log.history && setDetailHistory(log.history)} />
                </StudioHistorySidebar>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title="生成记录" placement="right" size={340} open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel logs={logs} selectedLogIds={selectedLogIds} activeLogId={previewLog?.id} onSelectedLogIdsChange={setSelectedLogIds} onCreateSession={createSession} onDeleteSelected={() => setDeleteConfirmOpen(true)} onPreviewLog={previewGenerationLog} onOpenDetail={(log) => log.history && setDetailHistory(log.history)} />
            </Drawer>

            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？
            </Modal>
            <GenerationHistoryDetailModal open={Boolean(detailHistory)} history={detailHistory} onClose={() => setDetailHistory(null)} />
        </div>
    );
}

function ResultVideoCard({ video, onDownload, onSaveAsset }: { video: GeneratedVideo; onDownload: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <video src={video.url} controls className="aspect-video w-full bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {video.width}x{video.height}
                    </span>
                    <span>{formatBytes(video.bytes)}</span>
                    <span>{formatDuration(video.durationMs)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(video)}>
                        添加到素材
                    </Button>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                        下载
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard() {
    return (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-stone-500 dark:text-stone-400">
                <AivroDrawableLoader className="h-24 w-72 text-stone-900 dark:text-stone-100" />
                <span>生成中</span>
            </div>
        </div>
    );
}

function FailedVideoCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" danger onClick={onRetry}>
                    重试
                </Button>
            </div>
        </div>
    );
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
    const allSelected = Boolean(logs.length) && selectedLogIds.length === logs.length;
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : logs.map((log) => log.id));

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
                <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!logs.length} onClick={toggleAll}>
                    {allSelected ? "取消" : "全选"}
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                    删除
                </Button>
            </div>
            <div className="space-y-3">
                {logs.map((log) => (
                    <LogCard key={log.id} log={log} selected={selectedLogIds.includes(log.id)} active={activeLogId === log.id} onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))} onClick={() => onPreviewLog(log)} onOpenDetail={() => onOpenDetail(log)} />
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

    return (
        <Dropdown trigger={["contextMenu"]} menu={detailMenu}>
            <button type="button" className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`} onClick={onClick}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                    <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                        <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-4 text-stone-500 dark:text-stone-400">{log.prompt || "无提示词"}</div>
                        {log.video?.url ? (
                            <video src={log.video.url} className="mt-2 aspect-video w-full rounded-md bg-stone-100 object-cover dark:bg-stone-900" muted playsInline preload="metadata" />
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.size}</Tag>
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.resolution}p</Tag>
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.seconds}s</Tag>
                        </div>
                    </div>
                    <div className="grid justify-items-end gap-2">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color={log.status === "成功" ? "blue" : "red"}>
                            {log.status}
                        </Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                            {formatDuration(log.durationMs)}
                        </Tag>
                    </div>
                </div>
            </button>
        </Dropdown>
    );
}

function historyToVideoLog(history: GenerationHistory): GenerationLog {
    const config = normalizeLogConfig({
        config: {
            model: history.config?.model,
            videoModel: history.config?.videoModel,
            size: history.config?.size,
            vquality: history.config?.vquality,
            videoSeconds: history.config?.videoSeconds,
        },
        model: history.model,
    });
    const media = history.media[0];
    const video = media
        ? {
              id: media.cloudFileId,
              url: media.url,
              storageKey: media.storageKey,
              cloudFileId: media.cloudFileId,
              expiresAt: media.expiresAt,
              durationMs: history.durationMs,
              width: media.width || 1280,
              height: media.height || 720,
              bytes: media.size || 0,
              mimeType: media.contentType || "video/mp4",
          }
        : undefined;
    return {
        id: history.id,
        createdAt: Date.parse(history.createdAt) || Date.now(),
        title: history.title || history.model || "未命名",
        prompt: history.prompt || "",
        time: formatDateTime(history.createdAt),
        model: history.model || config.videoModel || "",
        config,
        references: (history.references || []).map((item, index) => ({ id: `${history.id}-ref-${index}`, name: item.name, type: item.type, dataUrl: item.url, storageKey: item.storageKey })),
        durationMs: history.durationMs || 0,
        size: config.size || "",
        resolution: normalizeResolution(config.vquality || ""),
        seconds: config.videoSeconds || "",
        status: history.status || "成功",
        video,
        error: history.error,
        history,
    };
}

function videoToHistoryMedia(video: GeneratedVideo): GenerationHistoryMedia | null {
    const cloudFileId = video.cloudFileId || (video.storageKey?.startsWith("cloud:") ? video.storageKey.slice("cloud:".length) : "");
    if (!cloudFileId || !video.storageKey?.startsWith("cloud:")) return null;
    return {
        cloudFileId,
        storageKey: video.storageKey,
        url: video.url,
        fileType: "video",
        contentType: video.mimeType || "video/mp4",
        size: video.bytes || 0,
        width: video.width || 0,
        height: video.height || 0,
        expiresAt: video.expiresAt || "",
    };
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
    };
}

function buildLog({ prompt, model, config, references, durationMs, status, video, error }: { prompt: string; model: string; config: AiConfig; references: ReferenceImage[]; durationMs: number; status: GenerationLog["status"]; video?: GeneratedVideo; error?: string }): GenerationLog {
    const logConfig = {
        model: config.model,
        videoModel: config.videoModel,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
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
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        video,
        error,
    };
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    return {
        ...config,
        model,
        videoModel: model,
        size: normalizeVideoSize(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: normalizeResolution(config.vquality),
    };
}

function normalizeVideoSeconds(value: string) {
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(20, seconds)));
}

function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}
