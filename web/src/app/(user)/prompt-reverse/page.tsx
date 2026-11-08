"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Image, Skeleton, Tabs, Tag } from "antd";
import { Copy, ImagePlus, SearchCheck, Upload, X } from "lucide-react";
import Link from "next/link";
import { ModelPicker } from "@/components/model-picker";
import { ExploreHistory } from "@/components/explore-history";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { useCopyText } from "@/hooks/use-copy-text";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useRecordExpiry } from "@/hooks/use-record-expiry";
import { reverseImagePrompt } from "@/services/api/explore";
import type { GenerationHistory } from "@/services/api/generation-history";
import { canAccessPath } from "@/lib/user-sections";
import { formatDateTime } from "@/lib/datetime";
import studio from "@/components/studio-layout.module.css";

type LocalizedResult = { prompt: string; analysis: string; tags: string[] };

export default function PromptReversePage() {
    const { tr, locale } = useI18n();
    const { message } = App.useApp();
    const copyText = useCopyText();
    const localizedPath = useLocalizedPath();
    const client = useQueryClient();
    const config = useEffectiveConfig();
    const settings = useConfigStore((state) => state.publicSettings);
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const fileInput = useRef<HTMLInputElement>(null);
    const submitting = useRef(false);
    const [image, setImage] = useState("");
    const [filename, setFilename] = useState("");
    const [model, setModel] = useState("");
    const [running, setRunning] = useState(false);
    const [selected, setSelected] = useState<GenerationHistory | null>(null);
    const models = (settings?.modelChannel.textModels || []).filter((name) => settings?.modelChannel.availableModels.includes(name));
    const currentModel = models.includes(model) ? model : models.includes(config.textModel) ? config.textModel : models[0] || "";
    const enabled = Boolean(settings?.explore?.promptReverseEnabled && canAccessPath(user, "/prompt-reverse"));
    const result = selected?.result?.[locale] as LocalizedResult | undefined;
    useEffect(() => { setImage(""); setFilename(""); setSelected(null); }, [token]);
    useRecordExpiry(selected, setSelected);
    const readImage = async (file?: File) => {
        if (!file || running) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { message.error(tr("反推图片仅支持 PNG、JPEG、WebP，单张不超过 5MB")); return; }
        try {
            const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
            setImage(data); setFilename(file.name); setSelected(null);
        } catch { message.error(tr("读取图片失败")); }
    };
    const reverse = async () => {
        if (!image || !currentModel || !token || submitting.current) return;
        submitting.current = true; setRunning(true);
        try {
            const reversed = await reverseImagePrompt(token, currentModel, image);
            if (useUserStore.getState().token !== token) return;
            setSelected(reversed);
            await Promise.all([client.invalidateQueries({ queryKey: ["explore-history", "prompt-reverse"] }), useUserStore.getState().hydrateUser()]);
        } catch (error) { message.error(tr(error instanceof Error ? error.message : "反推失败")); }
        finally { submitting.current = false; setRunning(false); }
    };
    if (!settings) return <Skeleton active className="p-8" />;
    if (!enabled) return <div className="grid h-full place-items-center"><Empty description={tr("提示词反推尚未开启")} /></div>;
    return <main className={`${studio.studio} relative`}>
        <div className={studio.layout}>
            <div className={studio.panels}>
                <header className={studio.header}><div><h1>{tr("提示词反推")}</h1><p className="mt-1 text-xs text-muted-foreground">{tr("从图片中还原主体、构图、光线和风格")}</p></div></header>
                <section className={studio.results}>
                    {!token ? <div className={studio.empty}><SearchCheck size={36} /><h3>{tr("登录后使用提示词反推")}</h3><Link href={localizedPath("/login?redirect=/prompt-reverse")}>{tr("登录")}</Link></div> : <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <div className="min-w-0 rounded-2xl border border-border p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readImage(event.dataTransfer.files[0]); }}>
                            {selected?.media[0]?.url || image ? <><Image src={selected?.media[0]?.url || image} alt={filename || tr("反推参考图")} style={{ maxHeight: 500, objectFit: "contain" }} /><div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground" data-i18n-skip>{filename}</span><Button type="text" disabled={running} icon={<X size={14} />} aria-label={tr("移除参考图")} onClick={() => { setImage(""); setFilename(""); setSelected(null); }} /></div></> : <button type="button" disabled={running} className="flex min-h-72 w-full flex-col items-center justify-center gap-4 text-muted-foreground" onClick={() => fileInput.current?.click()}><ImagePlus size={36} /><span className="text-sm">{tr("上传或拖入图片")}</span><span className="text-xs">{tr("PNG、JPEG、WebP，最大 5MB")}</span></button>}
                            <Button className="mt-4" icon={<Upload size={14} />} onClick={() => fileInput.current?.click()} disabled={running}>{tr("选择图片")}</Button>
                            <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void readImage(event.target.files?.[0]); event.target.value = ""; }} />
                        </div>
                        <div className="min-w-0">
                            {!selected ? <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center text-muted-foreground"><SearchCheck size={36} /><p>{tr("选择图片和文本模型，开始反推提示词")}</p></div> : <>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(selected.expiresAt))}</span><Button size="small" icon={<Copy size={13} />} disabled={!result?.prompt} onClick={() => copyText(result?.prompt || "")}>{tr("复制提示词")}</Button></div>
                                <Tabs items={[
                                    { key: "prompt", label: tr("反推提示词"), children: <><p className="whitespace-pre-wrap break-words text-sm leading-7" data-i18n-skip>{result?.prompt}</p><div className="mt-4 flex flex-wrap gap-2">{result?.tags?.map((tag) => <Tag key={tag} data-i18n-skip>{tag}</Tag>)}</div>{result?.prompt && canAccessPath(user, "/image") ? <Link className="mt-5 inline-block text-sm underline underline-offset-4" href={localizedPath(`/image?prompt=${encodeURIComponent(result.prompt)}`)}>{tr("用于生图")}</Link> : null}</> },
                                    { key: "analysis", label: tr("画面分析"), children: <p className="whitespace-pre-wrap break-words text-sm leading-7" data-i18n-skip>{result?.analysis}</p> },
                                    { key: "json", label: tr("结构化提示词"), children: <><Button size="small" icon={<Copy size={13} />} onClick={() => copyText(JSON.stringify(selected.result, null, 2))}>{tr("复制 JSON")}</Button><pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-xs" data-i18n-skip>{JSON.stringify(selected.result, null, 2)}</pre></> },
                                ]} />
                            </>}
                        </div>
                    </div>}
                </section>
                <div className={studio.form}>{token ? <div className="flex flex-wrap items-center justify-center gap-3"><ModelPicker config={config} kind="text" models={models} value={currentModel} onChange={setModel} placeholder="选择文本模型" /><Button type="primary" loading={running} disabled={!image || !currentModel} onClick={() => void reverse()}>{tr("开始反推")}</Button><p className="w-full text-center text-xs text-muted-foreground">{tr(models.length ? "按所选文本模型计费，反推记录到期后自动删除。" : "暂无已开放的文本模型")}</p></div> : null}</div>
            </div>
            {token ? <ExploreHistory type="prompt-reverse" activeId={selected?.id} onSelect={(item) => { setSelected(item); setImage(""); setFilename(""); }} /> : null}
        </div>
    </main>;
}
