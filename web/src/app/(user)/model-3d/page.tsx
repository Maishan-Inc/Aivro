"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Button, Drawer, Empty, InputNumber, Modal, Segmented, Slider, Spin, Switch, Tag } from "antd";
import { Box, Download, FolderPlus, History, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useUserStore } from "@/stores/use-user-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { requestModel3DGeneration, type Model3DGenerationInput, type Model3DGenerationResult } from "@/services/api/model-3d";
import { saveGenerationHistory, deleteGenerationHistory, fetchGenerationHistories, type GenerationHistory } from "@/services/api/generation-history";
import { uploadImage } from "@/services/image-storage";
import { formatBytes, formatDuration, readImageMeta } from "@/lib/image-utils";
import { nanoid } from "nanoid";

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
                    className={`absolute inset-8 rotate-45 rounded-2xl border ${mode === "wireframe" ? "border-cyan-500 bg-transparent" : mode === "white" ? "border-stone-300 bg-white dark:border-stone-500 dark:bg-stone-100" : "border-emerald-300 bg-gradient-to-br from-emerald-300 via-cyan-400 to-blue-600"} shadow-xl shadow-cyan-500/10 [transform:rotateX(55deg)_rotateZ(45deg)]`}
                />
                <div
                    className={`absolute inset-16 rounded-xl border ${mode === "wireframe" ? "border-cyan-400 bg-transparent" : mode === "white" ? "border-stone-200 bg-stone-100" : "border-blue-200 bg-gradient-to-br from-blue-300 to-indigo-600"} [transform:rotateX(55deg)_rotateZ(45deg)_translateZ(70px)]`}
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
    const { message } = App.useApp();
    const { token } = useUserStore();
    const { addAsset } = useAssetStore();

    const [mode, setMode] = useState<"image" | "multi_image" | "text">("image");
    const [prompt, setPrompt] = useState("");
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
    const [histories, setHistories] = useState<GenerationHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

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

        setGenerating(true);
        try {
            const input: Model3DGenerationInput = {
                model: "hunyuan3d",
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

    const saveAsset = (asset: Model3DGenerationResult["results"][number]) => {
        addAsset({
            kind: "model3d",
            title: prompt || "3D 模型",
            coverUrl: asset.thumbnailUrl || "",
            tags: [],
            source: "3D 模型",
            data: { url: asset.url, storageKey: asset.storageKey, bytes: asset.bytes, mimeType: asset.mimeType, thumbnailUrl: asset.thumbnailUrl, vertices: asset.vertices, faces: asset.faces },
            metadata: { source: "model-3d-page", prompt, model: currentResult?.model },
        });
        message.success("已加入我的素材");
    };

    const estimatedEnergy = Math.round(30 * quantity * (meshQuality === "high" ? 1.6 : meshQuality === "ultra" ? 2.5 : 1) * (textureEnabled ? 1.2 : 1) * (pbrEnabled ? 1.3 : 1));

    return (
        <div className="flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="thin-scrollbar hidden min-h-0 overflow-y-auto rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <HistoryPanel histories={histories} loading={loadingHistory} token={token} onRefresh={handleLoadHistory} />
                </aside>

                <section className="grid gap-3 lg:min-h-0 lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="thin-scrollbar flex flex-col rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto">
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">3D 模型创作台</h1>
                            <div className="flex shrink-0 gap-2 lg:hidden">
                                <Button icon={<History className="size-4" />} onClick={openHistory}>
                                    记录
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6 space-y-5">
                            <div>
                                <span className="mb-2 block text-base font-semibold">生成方式</span>
                                <Segmented
                                    value={mode}
                                    onChange={(v) => setMode(v as typeof mode)}
                                    options={[
                                        { label: "图片生成", value: "image" },
                                        { label: "多图生成 Pro", value: "multi_image" },
                                        { label: "文字生成", value: "text" },
                                    ]}
                                    block
                                />
                            </div>

                            {mode !== "text" ? (
                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <span className="text-base font-semibold">参考图</span>
                                        <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
                                            上传
                                        </Button>
                                    </div>
                                    <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                        {images.map((img) => (
                                            <div key={img.id} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
                                                <img src={img.dataUrl} alt={img.name} className="size-full object-cover" />
                                                <button type="button" onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))} className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" aria-label="移除参考图">
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                                {(img.width < 256 || img.height < 256) && <div className="absolute inset-x-0 bottom-0 bg-yellow-600/90 px-1 text-xs text-white">低于 256</div>}
                                            </div>
                                        ))}
                                        {!images.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图，建议不低于 256x256</div> : null}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <span className="mb-2 block text-base font-semibold">提示词</span>
                                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述要生成的模型主体、材质和风格" className="w-full rounded-lg border border-stone-200 bg-background p-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-stone-800 dark:focus:border-stone-600" rows={7} />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900">
                                    <span className="font-medium">纹理</span>
                                    <Switch checked={textureEnabled} onChange={setTextureEnabled} />
                                </label>
                                <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900">
                                    <span className="font-medium">PBR</span>
                                    <Switch checked={pbrEnabled} onChange={setPbrEnabled} />
                                </label>
                            </div>

                            <div>
                                <span className="mb-2 block text-base font-semibold">网格质量</span>
                                <Segmented value={meshQuality} onChange={(v) => setMeshQuality(v as typeof meshQuality)} options={[{ label: "标准", value: "standard" }, { label: "高", value: "high" }, { label: "超高", value: "ultra" }]} block />
                            </div>

                            <div>
                                <span className="mb-2 block text-base font-semibold">面数</span>
                                <Slider value={targetFaceCount} onChange={(v) => setTargetFaceCount(v)} min={500000} max={1000000} step={50000} />
                                <InputNumber value={targetFaceCount} onChange={(v) => setTargetFaceCount(v || 500000)} min={500000} max={1000000} className="mt-2 w-full" />
                            </div>

                            <div>
                                <span className="mb-2 block text-base font-semibold">数量</span>
                                <Segmented value={quantity} onChange={(v) => setQuantity(v as number)} options={[1, 2, 3, 4].map((n) => ({ label: n > 1 ? `${n} Pro` : String(n), value: n }))} block />
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
                            <Button type="primary" onClick={handleGenerate} loading={generating} block size="large" icon={generating ? <Loader2 className="animate-spin" /> : <Box />}>
                                生成模型
                            </Button>
                            <div className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">预计消耗 {estimatedEnergy} 电量</div>
                        </div>
                    </div>

                    <div className="thin-scrollbar rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto lg:p-5">
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

                        <ModelPreview result={currentResult} mode={viewMode} />

                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            <div className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold">内容信息</h3>
                                    {currentResult ? <Tag className="m-0">{currentResult.status}</Tag> : null}
                                </div>
                                {currentResult ? (
                                    <div className="space-y-1 text-xs text-stone-500 dark:text-stone-400">
                                        <div>时间：{new Date(currentResult.createdAt).toLocaleString()}</div>
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
                                                    <span>顶点：{asset.vertices.toLocaleString()}</span>
                                                    <span>网格面：{asset.faces.toLocaleString()}</span>
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
                        </div>
                    </div>
                </section>
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

            <Drawer title="生成历史" placement="bottom" size="large" open={historyOpen} onClose={() => setHistoryOpen(false)}>
                <HistoryPanel histories={histories} loading={loadingHistory} token={token} onRefresh={handleLoadHistory} />
            </Drawer>
        </div>
    );
}

function HistoryPanel({ histories, loading, token, onRefresh }: { histories: GenerationHistory[]; loading: boolean; token: string; onRefresh: () => void }) {
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
                        <div key={history.id} className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                            <div className="truncate text-sm font-semibold">{history.title}</div>
                            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{new Date(history.createdAt).toLocaleString()}</div>
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
