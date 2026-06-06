"use client";

import { useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Center, useGLTF } from "@react-three/drei";
import { Button, Segmented, Slider, InputNumber, Switch, Drawer, Modal, Spin } from "antd";
import { Download, Loader2, Box } from "lucide-react";
import { useUserStore } from "@/stores/use-user-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { requestModel3DGeneration, type Model3DGenerationInput, type Model3DGenerationResult } from "@/services/api/model-3d";
import { saveGenerationHistory, deleteGenerationHistory, fetchGenerationHistories, type GenerationHistory } from "@/services/api/generation-history";
import { uploadImage } from "@/services/image-storage";
import { readImageMeta } from "@/lib/image-utils";
import { nanoid } from "nanoid";

type ViewMode = "default" | "wireframe" | "white";

function Model3DViewer({ url, mode }: { url: string; mode: ViewMode }) {
    const { scene } = useGLTF(url);
    const clonedScene = scene.clone();

    if (mode === "wireframe") {
        clonedScene.traverse((child: any) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.wireframe = true;
            }
        });
    } else if (mode === "white") {
        clonedScene.traverse((child: any) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.color.set("#ffffff");
                child.material.map = null;
                child.material.normalMap = null;
                child.material.roughnessMap = null;
                child.material.metalnessMap = null;
            }
        });
    }

    return <primitive object={clonedScene} />;
}

export default function Model3DPage() {
    const { user, token } = useUserStore();
    const { addAsset } = useAssetStore();

    const [mode, setMode] = useState<"image" | "multi_image" | "text">("image");
    const [prompt, setPrompt] = useState("");
    const [images, setImages] = useState<{ id: string; name: string; type: string; url: string; dataUrl: string; storageKey: string; width: number; height: number }[]>([]);
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
            })
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
                        fileType: "model3d" as any,
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
        } catch (err: any) {
            Modal.error({ title: "生成失败", content: err.message || "生成失败，请重试" });
        } finally {
            setGenerating(false);
        }
    };

    const handleLoadHistory = async () => {
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
    };

    const estimatedEnergy = Math.round(30 * quantity * (meshQuality === "high" ? 1.6 : meshQuality === "ultra" ? 2.5 : 1) * (textureEnabled ? 1.2 : 1) * (pbrEnabled ? 1.3 : 1));

    return (
        <div className="relative h-screen w-full overflow-hidden bg-black">
            <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
                <color attach="background" args={["#0a0a0a"]} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <Suspense fallback={null}>
                    {currentResult?.results[0]?.url ? (
                        <Center>
                            <Model3DViewer url={currentResult.results[0].url} mode={viewMode} />
                        </Center>
                    ) : (
                        <mesh>
                            <boxGeometry args={[1, 1, 1]} />
                            <meshStandardMaterial color="#333333" wireframe />
                        </mesh>
                    )}
                </Suspense>
                <OrbitControls />
                <Environment preset="studio" />
            </Canvas>

            <div className="absolute left-6 top-6 bottom-6 w-96 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-lg overflow-y-auto">
                <h2 className="mb-4 text-xl font-bold text-white">生成模型 Pro</h2>
                <Segmented
                    value={mode}
                    onChange={(v) => setMode(v as any)}
                    options={[
                        { label: "图片生成", value: "image" },
                        { label: "多图生成 Pro", value: "multi_image" },
                        { label: "文字生成", value: "text" },
                    ]}
                    block
                    className="mb-4"
                />

                {mode !== "text" && (
                    <div className="mb-4">
                        <Button onClick={() => fileInputRef.current?.click()} block>上传图片</Button>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
                        <p className="mt-2 text-xs text-white/60">建议图片分辨率不小于 256×256 像素</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {images.map((img) => (
                                <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded border border-white/20">
                                    <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                                    <button onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))} className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white">×</button>
                                    {(img.width < 256 || img.height < 256) && <div className="absolute bottom-0 left-0 right-0 bg-yellow-600/80 px-1 text-xs text-white">低于256</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {mode === "text" && (
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="输入文字描述..."
                        className="mb-4 w-full rounded border border-white/20 bg-white/5 p-3 text-white placeholder-white/40"
                        rows={4}
                    />
                )}

                <div className="mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white">纹理</span>
                        <Switch checked={textureEnabled} onChange={setTextureEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white">PBR</span>
                        <Switch checked={pbrEnabled} onChange={setPbrEnabled} />
                    </div>
                </div>

                <div className="mb-4">
                    <div className="mb-2 text-sm text-white">网格质量</div>
                    <Segmented value={meshQuality} onChange={(v) => setMeshQuality(v as any)} options={[{ label: "标准", value: "standard" }, { label: "高", value: "high" }, { label: "超高", value: "ultra" }]} block />
                </div>

                <div className="mb-4">
                    <div className="mb-2 text-sm text-white">面数</div>
                    <Slider value={targetFaceCount} onChange={(v) => setTargetFaceCount(v)} min={100000} max={1000000} step={50000} />
                    <InputNumber value={targetFaceCount} onChange={(v) => setTargetFaceCount(v || 500000)} min={1} max={1000000} className="mt-2 w-full" />
                    <p className="mt-1 text-xs text-white/60">目标面数范围：500,000 至 1,000,000</p>
                </div>

                <div className="mb-4">
                    <div className="mb-2 text-sm text-white">数量</div>
                    <Segmented value={quantity} onChange={(v) => setQuantity(v as number)} options={[1, 2, 3, 4].map((n) => ({ label: n > 1 ? `${n} Pro` : String(n), value: n }))} block />
                </div>

                <Button type="primary" onClick={handleGenerate} loading={generating} block size="large" icon={generating ? <Loader2 className="animate-spin" /> : <Box />}>
                    生成模型
                </Button>
                <div className="mt-2 text-center text-sm text-white/80">消耗电量 ⚡ {estimatedEnergy}</div>
            </div>

            <div className="absolute right-6 top-6 w-80 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-lg">
                <h3 className="mb-2 text-sm font-semibold text-white">内容信息</h3>
                {currentResult && (
                    <div className="space-y-1 text-xs text-white/80">
                        <div>时间：{new Date(currentResult.createdAt).toLocaleString()}</div>
                        {currentResult.results[0] && (
                            <>
                                <div>顶点：{currentResult.results[0].vertices.toLocaleString()}</div>
                                <div>网格面：{currentResult.results[0].faces.toLocaleString()}</div>
                                <div>文件大小：{(currentResult.results[0].bytes / 1024 / 1024).toFixed(2)} MB</div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute right-6 top-32 bottom-6 w-80 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-lg overflow-y-auto">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">资产</h3>
                    <Button size="small" onClick={() => { setHistoryOpen(true); handleLoadHistory(); }}>查看历史</Button>
                </div>
                {currentResult?.results[0] && (
                    <div className="rounded border border-white/20 p-2">
                        <div className="mb-1 text-xs text-white">当前模型</div>
                        <Button size="small" onClick={() => { if (currentResult.results[0].url) window.open(currentResult.results[0].url); }}>下载</Button>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-lg">
                <Button type={viewMode === "default" ? "primary" : "default"} onClick={() => setViewMode("default")} size="small">贴图</Button>
                <Button type={viewMode === "white" ? "primary" : "default"} onClick={() => setViewMode("white")} size="small">白模</Button>
                <Button type={viewMode === "wireframe" ? "primary" : "default"} onClick={() => setViewMode("wireframe")} size="small">线框</Button>
            </div>

            <Drawer title="生成历史" open={historyOpen} onClose={() => setHistoryOpen(false)} width={480}>
                {loadingHistory ? <Spin /> : histories.map((h) => (
                    <div key={h.id} className="mb-4 rounded border p-3">
                        <div className="font-semibold">{h.title}</div>
                        <div className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</div>
                        <Button size="small" className="mt-2" onClick={() => { if (h.media[0]) window.open(h.media[0].url); }}>下载</Button>
                    </div>
                ))}
            </Drawer>
        </div>
    );
}
