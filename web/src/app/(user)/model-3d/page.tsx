"use client";

import { StudioEmptyState } from "@/components/studio-empty-state";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import studio from "@/components/studio-layout.module.css";
import composer from "@/components/image-prompt-composer.module.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { App, Button, Drawer, Dropdown, Empty, Input, InputNumber, Modal, Select, Spin, Tag } from "antd";
import { ArrowUp, ChevronDown, Download, FolderPlus, History, Plus, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { useUserStore } from "@/stores/use-user-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { requestModel3DGeneration, type Model3DGenerationInput, type Model3DGenerationResult } from "@/services/api/model-3d";
import { saveGenerationHistory, deleteGenerationHistory, fetchGenerationHistories, type GenerationHistory } from "@/services/api/generation-history";
import { GenerationHistoryDetailModal } from "@/components/generation-history-detail-modal";
import { uploadImage } from "@/services/image-storage";
import { ModelPicker } from "@/components/model-picker";
import { ModelBilling } from "@/components/model-billing";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { formatBytes, formatDuration, readImageMeta } from "@/lib/image-utils";
import { nanoid } from "nanoid";
import { formatDateTime, formatNumber } from "@/lib/datetime";

type ViewMode = "default" | "wireframe" | "white";

type UploadedReference = {
    id: string;
    name: string;
    type: string;
    url: string;
    dataUrl: string;
    storageKey: string;
    width: number;
    height: number;
};

function ModelPreview({ result, mode }: { result: Model3DGenerationResult | null; mode: ViewMode }) {
    const file = result?.results[0];
    return (
        <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center dark:border-stone-700 dark:bg-stone-900 lg:min-h-[520px]">
            <div className="relative mb-8 h-56 w-56 [perspective:800px]">
                <div
                    className={`absolute inset-8 rotate-45 rounded-2xl border ${mode === "wireframe" ? "border-foreground bg-transparent" : mode === "white" ? "border-stone-300 bg-white dark:border-stone-500 dark:bg-stone-100" : "border-border bg-gradient-to-br from-muted to-background"} [transform:rotateX(55deg)_rotateZ(45deg)]`}
                />
                <div
                    className={`absolute inset-16 rounded-xl border ${mode === "wireframe" ? "border-foreground/60 bg-transparent" : mode === "white" ? "border-stone-200 bg-stone-100" : "border-border bg-gradient-to-br from-background to-muted"} [transform:rotateX(55deg)_rotateZ(45deg)_translateZ(70px)]`}
                />
            </div>
            <div className="rounded-lg border border-stone-200 bg-background px-4 py-2 text-sm text-stone-600 shadow-sm dark:border-stone-800 dark:text-stone-300">
                {file?.url ? "模型已生成，可下载查看" : "上传图片或输入文字后生成 3D 模型"}
            </div>
            {file?.url ? (
                <Button className="mt-4" icon={<Download className="size-4" />} onClick={() => window.open(file.url, "_blank")}>
                    下载模型文件
                </Button>
            ) : null}
        </div>
    );
}

export default function Model3DPage() {
    const searchParams = useSearchParams();
    const { message } = App.useApp();
    const { token } = useUserStore();
    const { addAsset } = useAssetStore();
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const model = effectiveConfig.model3DModel || effectiveConfig.model;

    const [mode, setMode] = useState<"image" | "multi_image" | "text">("text");
    const [prompt, setPrompt] = useState("");
    const [composerFocused, setComposerFocused] = useState(false);
    const [images, setImages] = useState<UploadedReference[]>([]);
    const [textureEnabled, setTextureEnabled] = useState(true);
    const [pbrEnabled, setPbrEnabled] = useState(true);
    const [meshQuality, setMeshQuality] = useState<"standard" | "high" | "ultra">("standard");
    const [targetFaceCount, setTargetFaceCount] = useState(500000);
    const [quantity, setQuantity] = useState(1);

    const [generating, setGenerating] = useState(false);
    const [currentResult, setCurrentResult] = useState<Model3DGenerationResult | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("default");

    const [historyOpen, setHistoryOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [histories, setHistories] = useState<GenerationHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [detailHistory, setDetailHistory] = useState<GenerationHistory | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const urlPrompt = searchParams.get("prompt");
        if (urlPrompt) {
            setPrompt(urlPrompt);
            setMode("text");
        }
    }, [searchParams]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const uploaded = await Promise.all(
            files.map(async (file) => {
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                const meta = await readImageMeta(dataUrl);
                const result = await uploadImage(dataUrl);
                return { id: nanoid(), name: file.name, type: file.type, url: result.url, dataUrl, storageKey: result.storageKey, width: meta.width, height: meta.height };
            }),
        );
        setImages((prev) => [...prev, ...uploaded]);
        setMode(images.length + uploaded.length > 1 ? "multi_image" : "image");
    };

    const handleGenerate = async () => {
        if (!token) return;
        if (mode !== "text" && images.length === 0) {
            Modal.error({ title: "提示", content: "请先上传参考图片" });
            return;
        }
        if (mode === "text" && !prompt.trim()) {
            Modal.error({ title: "提示", content: "请输入文字描述" });
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            Modal.error({ title: "提示", content: "管理员尚未配置可用3D模型" });
            return;
        }

        setGenerating(true);
        try {
            const input: Model3DGenerationInput = {
                model,
                mode,
                prompt,
                images: images.map((img) => ({ name: img.name, type: img.type, url: img.url, storageKey: img.storageKey })),
                textureEnabled,
                pbrEnabled,
                meshQuality,
                targetFaceCount,
                quantity,
            };

            const result = await requestModel3DGeneration(token, input);
            setCurrentResult(result);

            if (result.status === "completed" && result.results.length > 0 && result.results[0].url) {
                await saveGenerationHistory(token, {
                    type: "model3d",
                    title: prompt || "3D 模型",
                    prompt: result.prompt,
                    model: result.model,
                    config: result.config,
                    references: result.references,
                    media: result.results.map((r) => ({
                        cloudFileId: r.cloudFileId,
                        storageKey: r.storageKey,
                        url: r.url,
                        fileType: "model3d",
                        contentType: r.mimeType,
                        size: r.bytes,
                        width: 0,
                        height: 0,
                        expiresAt: r.expiresAt,
                    })),
                    status: "成功",
                    error: "",
                    durationMs: result.durationMs,
                });
                await handleLoadHistory();
            }
        } catch (err) {
            Modal.error({ title: "生成失败", content: err instanceof Error ? err.message : "生成失败，请重试" });
        } finally {
            setGenerating(false);
        }
    };

    const handleLoadHistory = useCallback(async () => {
        if (!token) return;
        setLoadingHistory(true);
        try {
            const result = await fetchGenerationHistories(token, { type: "model3d", page: 1, pageSize: 20 });
            setHistories(result.items);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHistory(false);
        }
    }, [token]);

    useEffect(() => {
        void handleLoadHistory();
    }, [handleLoadHistory]);

    const openHistory = () => {
        setHistoryOpen(true);
        void handleLoadHistory();
    };

    const createSession = () => {
        setPrompt("");
        setImages([]);
        setCurrentResult(null);
    };

    const saveAsset = async (asset: Model3DGenerationResult["results"][number]) => {
        try {
            await addAsset({
                kind: "model3d",
                title: prompt || "3D 模型",
                coverUrl: asset.thumbnailUrl || "",
                tags: [],
                source: "3D 模型",
                data: { url: asset.url, storageKey: asset.storageKey, bytes: asset.bytes, mimeType: asset.mimeType, thumbnailUrl: asset.thumbnailUrl, vertices: asset.vertices, faces: asset.faces },
                metadata: { source: "model-3d-page", prompt, model: currentResult?.model },
            });
            message.success("已加入我的素材");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "素材操作失败，请重试");
        }
    };

    const canGenerate = mode === "text" ? Boolean(prompt.trim()) : images.length > 0;
    const composerExpanded = composerFocused || Boolean(prompt.trim()) || images.length > 0;

    return (
        <div className={studio.studio}>
            <main className={studio.layout}>
                <section className={studio.panels}>
                    <header className={studio.header}>
                        <div><h1>3D 模型工作台</h1><p>从平面灵感，探索三维世界。</p></div>
                        <div className={studio.headerActions}>
                            <Button type="text" icon={<Plus size={15} />} disabled={generating} onClick={createSession}>新建</Button>
                            <div className={studio.historyActions}><Button type="text" icon={<History size={15} />} onClick={openHistory}>记录</Button></div>
                        </div>
                    </header>
                    <div className={studio.results}>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">生成结果</h2>
                            <div className="flex gap-2">
                                <Button type={viewMode === "default" ? "primary" : "default"} onClick={() => setViewMode("default")} size="small">
                                    贴图
                                </Button>
                                <Button type={viewMode === "white" ? "primary" : "default"} onClick={() => setViewMode("white")} size="small">
                                    白模
                                </Button>
                                <Button type={viewMode === "wireframe" ? "primary" : "default"} onClick={() => setViewMode("wireframe")} size="small">
                                    线框
                                </Button>
                            </div>
                        </div>

                        {currentResult ? <ModelPreview result={currentResult} mode={viewMode} /> : <StudioEmptyState kind="model-3d" onUsePrompt={(value) => { setPrompt(value); setMode("text"); }} />}

                        {currentResult ? <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            <div className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold">内容信息</h3>
                                    {currentResult ? <Tag className="m-0">{currentResult.status}</Tag> : null}
                                </div>
                                {currentResult ? (
                                    <div className="space-y-1 text-xs text-stone-500 dark:text-stone-400">
                                        <div>时间：{formatDateTime(currentResult.createdAt)}</div>
                                        <div>模型：{currentResult.model}</div>
                                        <div>耗时：{formatDuration(currentResult.durationMs)}</div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-stone-500 dark:text-stone-400">暂无模型信息</div>
                                )}
                            </div>

                            <div className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold">模型文件</h3>
                                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={createSession}>
                                        新建
                                    </Button>
                                </div>
                                {currentResult?.results.length ? (
                                    <div className="space-y-2">
                                        {currentResult.results.map((asset, index) => (
                                            <div key={asset.id || index} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                                                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                                                    <span className="font-medium">模型 {index + 1}</span>
                                                    <span className="text-stone-500 dark:text-stone-400">{formatBytes(asset.bytes)}</span>
                                                </div>
                                                <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-stone-500 dark:text-stone-400">
                                                    <span>顶点：{formatNumber(asset.vertices)}</span>
                                                    <span>网格面：{formatNumber(asset.faces)}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => saveAsset(asset)}>
                                                        添加到素材
                                                    </Button>
                                                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => window.open(asset.url, "_blank")}>
                                                        下载
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-24 items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成完成后会显示模型文件" />
                                    </div>
                                )}
                            </div>
                        </div> : null}
                    </div>
                    <div className={studio.form}>
                        <div className={composer.composer} data-expanded={composerExpanded} onFocus={() => setComposerFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerFocused(false); }}>
                            {images.length ? <div className={composer.references}>
                                {images.map((img) => <div key={img.id} className={composer.reference}>
                                    <img src={img.dataUrl} alt={img.name} />
                                    <button type="button" onClick={() => setImages((value) => value.filter((item) => item.id !== img.id))} aria-label="移除参考图"><X size={13} /></button>
                                    {img.width < 256 || img.height < 256 ? <span className="absolute inset-x-0 bottom-0 bg-background/90 text-center text-[9px] text-foreground">低于 256</span> : null}
                                </div>)}
                            </div> : null}
                            <div className={composer.main}><div className={composer.body}>
                            <div className={composer.inputRow}>
                            <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} variant="borderless" autoSize={{ minRows: 1 }} disabled={generating} aria-label="模型描述" placeholder={mode === "text" ? "描述你想创造的形体、材质和风格…" : "添加参考图，也可以补充模型描述…"} onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    if (canGenerate && !generating) void handleGenerate();
                                }
                            }} />
                            </div>
                            <div className={composer.controls}><div><div className={composer.toolbar} inert={!composerExpanded}>
                                <div className={composer.toolbarRow}>
                                <Button type="text" shape="circle" icon={<Upload size={17} />} onClick={() => fileInputRef.current?.click()} aria-label="上传参考图" title="上传参考图" />
                                <ModelPicker config={effectiveConfig} kind="model3d" model3D={{ quantity, meshQuality, textureEnabled, pbrEnabled, targetFaceCount }} models={effectiveConfig.model3DModels} value={model} onChange={(value) => updateConfig("model3DModel", value)} onMissingConfig={() => message.warning("管理员尚未配置可用3D模型")} />
                                </div>
                                <div className={composer.toolbarRow}>
                                <Dropdown trigger={["click"]} placement="topLeft" menu={{ selectable: true, selectedKeys: [mode], items: [
                                    { key: "text", label: "文字生成" }, { key: "image", label: "图片生成" }, { key: "multi_image", label: "多图生成 Pro" },
                                ], onClick: ({ key }) => setMode(key as typeof mode) }}>
                                    <Button type="text">{mode === "text" ? "文字生成" : mode === "image" ? "图片生成" : "多图生成"}<ChevronDown size={12} /></Button>
                                </Dropdown>
                                <Dropdown trigger={["click"]} placement="topLeft" menu={{ selectable: true, selectedKeys: [meshQuality], items: [
                                    { key: "standard", label: "标准网格" }, { key: "high", label: "高质量网格" }, { key: "ultra", label: "超高质量网格" },
                                ], onClick: ({ key }) => setMeshQuality(key as typeof meshQuality) }}>
                                    <Button type="text">{meshQuality === "standard" ? "标准" : meshQuality === "high" ? "高质量" : "超高质量"}<ChevronDown size={12} /></Button>
                                </Dropdown>
                                <Dropdown trigger={["click"]} placement="topLeft" menu={{ selectable: true, selectedKeys: [String(quantity)], items: [1, 2, 3, 4].map((value) => ({ key: String(value), label: value > 1 ? `${value} 个 Pro` : "1 个" })), onClick: ({ key }) => setQuantity(Number(key)) }}>
                                    <Button type="text">{quantity} 个<ChevronDown size={12} /></Button>
                                </Dropdown>
                                <Button type="text" icon={<SlidersHorizontal size={14} />} onClick={() => setSettingsOpen(true)} aria-label="调整材质和面数" title="材质和面数" />
                                </div>
                            </div></div></div>
                            </div>
                                <Button className={composer.send} type="primary" shape="circle" icon={<ArrowUp size={20} />} loading={generating} disabled={!canGenerate || generating} onClick={() => void handleGenerate()} aria-label="生成模型" title="生成模型" />
                            </div>
                        </div>
                        <p className={studio.composerHint}><span>Enter 生成 · Shift + Enter 换行</span></p>
                    </div>
                </section>
                <StudioHistorySidebar items={histories.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, preview: item.references[0]?.url }))} onSelect={(id) => { const item = histories.find((history) => history.id === id); if (item) setDetailHistory(item); }}>
                    <HistoryPanel histories={histories} loading={loadingHistory} token={token} onRefresh={handleLoadHistory} onOpenDetail={setDetailHistory} />
                </StudioHistorySidebar>
            </main>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void handleImageUpload(event);
                    event.target.value = "";
                }}
            />

            <Drawer title="生成记录" placement="right" size={340} open={historyOpen} onClose={() => setHistoryOpen(false)}>
                <HistoryPanel histories={histories} loading={loadingHistory} token={token} onRefresh={handleLoadHistory} onOpenDetail={setDetailHistory} />
            </Drawer>
            <Modal centered title="模型生成参数" open={settingsOpen} onCancel={() => setSettingsOpen(false)} footer={<Button type="primary" onClick={() => setSettingsOpen(false)}>完成</Button>} width={500}>
                <div className="grid grid-cols-2 gap-5 py-4">
                    <label className="space-y-2"><span className="block text-sm">纹理</span><Select className="w-full" value={textureEnabled ? "on" : "off"} onChange={(value) => setTextureEnabled(value === "on")} options={[{ value: "on", label: "生成纹理" }, { value: "off", label: "关闭纹理" }]} /></label>
                    <label className="space-y-2"><span className="block text-sm">PBR 材质</span><Select className="w-full" value={pbrEnabled ? "on" : "off"} onChange={(value) => setPbrEnabled(value === "on")} options={[{ value: "on", label: "开启 PBR" }, { value: "off", label: "关闭 PBR" }]} /></label>
                    <label className="col-span-2 space-y-2"><span className="block text-sm">目标面数</span><InputNumber value={targetFaceCount} onChange={(value) => setTargetFaceCount(value || 500000)} min={500000} max={1000000} step={50000} className="!w-full" /></label>
                </div>
                <ModelBilling model={model} kind="model3d" model3D={{ quantity, meshQuality, textureEnabled, pbrEnabled, targetFaceCount }} />
            </Modal>
            <GenerationHistoryDetailModal open={Boolean(detailHistory)} history={detailHistory} onClose={() => setDetailHistory(null)} />
        </div>
    );
}

function HistoryPanel({ histories, loading, token, onRefresh, onOpenDetail }: { histories: GenerationHistory[]; loading: boolean; token: string; onRefresh: () => void; onOpenDetail: (history: GenerationHistory) => void }) {
    return (
        <>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">生成记录</h2>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Free 用户生成记录最多保存 7 天</p>
                </div>
                <Button size="small" onClick={onRefresh}>
                    刷新
                </Button>
            </div>
            {loading ? (
                <div className="flex min-h-48 items-center justify-center">
                    <Spin />
                </div>
            ) : histories.length ? (
                <div className="space-y-3">
                    {histories.map((history) => (
                        <div key={history.id} className="cursor-pointer rounded-lg border border-stone-200 bg-background p-3 transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900" onDoubleClick={() => onOpenDetail(history)}>
                            <div className="truncate text-sm font-semibold">{history.title}</div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-4 text-stone-500 dark:text-stone-400">{history.prompt || "无提示词"}</div>
                            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{formatDateTime(history.createdAt)}</div>
                            <div className="mt-3 flex gap-2">
                                <Button size="small" icon={<Download className="size-3.5" />} onClick={() => history.media[0] && window.open(history.media[0].url, "_blank")}>
                                    下载
                                </Button>
                                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => token && deleteGenerationHistory(token, history.id).then(onRefresh)}>
                                    删除
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div>
            )}
        </>
    );
}
