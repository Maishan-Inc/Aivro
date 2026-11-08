"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Empty, Image, Input, Modal, Select, Skeleton, Spin } from "antd";
import { ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModelPicker } from "@/components/model-picker";
import { ExploreHistory } from "@/components/explore-history";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useRecordExpiry } from "@/hooks/use-record-expiry";
import { fetchFreeImageState, freeImageAgreementVersion } from "@/services/api/explore";
import { requestFreeGeneration, type GenerationQueueUpdate, type ImageApiResult } from "@/services/api/image";
import type { GenerationHistory } from "@/services/api/generation-history";
import { formatDateTime } from "@/lib/datetime";
import { canAccessPath } from "@/lib/user-sections";
import studio from "@/components/studio-layout.module.css";
import composer from "@/components/image-prompt-composer.module.css";

export default function FreeImagePage() {
    const { tr } = useI18n();
    const { message } = App.useApp();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const client = useQueryClient();
    const settings = useConfigStore((state) => state.publicSettings);
    const config = useEffectiveConfig();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const enabled = Boolean(settings?.explore?.freeImageEnabled && canAccessPath(user, "/free-image"));
    const [accepted, setAccepted] = useState(false);
    const [checked, setChecked] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [model, setModel] = useState("");
    const [size, setSize] = useState("1024x1024");
    const [focused, setFocused] = useState(false);
    const [modelOpen, setModelOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const submitting = useRef(false);
    const [images, setImages] = useState<ImageApiResult[]>([]);
    const [queue, setQueue] = useState<GenerationQueueUpdate | null>(null);
    const [selected, setSelected] = useState<GenerationHistory | null>(null);
    const state = useQuery({ queryKey: ["free-image-state", token], queryFn: () => fetchFreeImageState(token), enabled: Boolean(token && enabled && accepted), refetchInterval: 15000 });
    const campaign = state.data?.campaign;
    const models = campaign?.models || [];
    const currentModel = models.includes(model) ? model : models[0] || "";
    const resolutions = settings?.modelChannel.modelCosts.find((item) => item.model === currentModel)?.resolutions || [];
    const sizes = [{ value: "1024x1024", label: "1K", resolution: "1k" }, { value: "2048x2048", label: "2K", resolution: "2k" }, { value: "4096x4096", label: "4K", resolution: "4k" }, { value: "8192x8192", label: "8K", resolution: "8k" }].filter((item) => resolutions.includes(item.resolution));
    const requestSize = sizes.some((item) => item.value === size) ? size : sizes[0]?.value || "";
    const [at, setAt] = useState(Date.now);
    const active = Boolean(campaign && Date.parse(campaign.endsAt) > at);
    useEffect(() => {
        if (!campaign) return;
        const timer = window.setTimeout(() => { setAt(Date.now()); void state.refetch(); void useConfigStore.getState().loadPublicSettings(); }, Math.max(0, Math.min(2147483647, Date.parse(campaign.endsAt) - Date.now() + 50)));
        return () => window.clearTimeout(timer);
    }, [campaign, state.refetch]);
    useEffect(() => { setImages([]); setSelected(null); setAccepted(false); setChecked(false); }, [token]);
    useRecordExpiry(selected, setSelected);
    const generate = async () => {
        if (submitting.current || !accepted || !active || !state.data?.remaining || !currentModel || !requestSize || !prompt.trim()) return;
        submitting.current = true;
        setRunning(true); setQueue(null); setSelected(null);
        try {
            const generated = await requestFreeGeneration({ ...config, model: currentModel }, { campaignId: campaign!.id, agreement: freeImageAgreementVersion, model: currentModel, prompt: prompt.trim(), size: requestSize, quality: "" }, setQueue);
            if (useUserStore.getState().token !== token) return;
            setImages(generated);
            await client.invalidateQueries({ queryKey: ["explore-history", "free-image"] });
        } catch (error) { message.error(tr(error instanceof Error ? error.message : "生成失败")); }
        finally { submitting.current = false; setRunning(false); setQueue(null); await state.refetch(); }
    };
    const preview = selected ? selected.media.map((item) => item.url) : images.map((item) => item.dataUrl);
    if (!settings) return <Skeleton active className="p-8" />;
    if (!enabled) return <div className="grid h-full place-items-center"><Empty description={tr("免费生成图片尚未开启")} /></div>;
    return <main className={`${studio.studio} relative`}>
        <div className={studio.layout}>
            <div className={studio.panels}>
                <header className={studio.header}><div><h1>{tr("免费生成图片")}</h1></div><Button type="text" className="mr-24" onClick={() => { setAccepted(false); setChecked(false); }}>{tr("查看协议")}</Button></header>
                <section className={studio.results}>
                    {!token ? <div className={studio.empty}><Sparkles size={36} /><h3>{tr("登录后参加免费活动")}</h3><Link href={localizedPath("/login?redirect=/free-image")}>{tr("登录")}</Link></div> : !accepted ? null : state.isLoading ? <Spin /> : state.isError ? <Empty description={tr(state.error.message)} /> : !active && !preview.length ? <div className={studio.empty}><Sparkles size={36} /><h3>{tr("当前暂未免费活动")}</h3></div> : <div>
                        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
                            <div><h2 data-i18n-skip>{active ? campaign?.name : tr("当前暂未免费活动")}</h2>{active ? <p className="mt-2 text-xs text-muted-foreground" data-i18n-skip>{tr("活动结束：{0}").replace("{0}", formatDateTime(campaign!.endsAt))}</p> : null}</div>
                            <p className="text-sm tabular-nums" data-i18n-skip>{tr("本期剩余 {0} / {1} 次").replace("{0}", String(state.data?.remaining ?? 0)).replace("{1}", String(state.data?.limit ?? 0))}</p>
                        </div>
                        {running ? <p className="mb-5 flex items-center gap-3 text-sm text-muted-foreground"><Spin size="small" />{queue?.status === "queued" ? tr("排队中，前方 {0} 个任务").replace("{0}", String(queue.aheadCount)) : tr("生成中")}</p> : null}
                        {preview.length ? <Image.PreviewGroup>{preview.map((url) => <div key={url} className="mb-5"><Image src={url} alt={tr("生成结果")} style={{ maxHeight: 560, objectFit: "contain" }} /><a href={url} download className="mt-2 block text-xs text-muted-foreground">{tr("下载图片")}</a></div>)}</Image.PreviewGroup> : <div className={studio.empty}><Sparkles size={40} /><h3>{tr("用一段提示词，开启本期创作")}</h3><p>{tr("本期额度按会员等级分配，每次生成一张图片。")}</p></div>}
                        {!models.length ? <p className="text-xs text-muted-foreground">{tr("本期暂无可用图片模型")}</p> : state.data?.remaining === 0 ? <p className="text-xs text-muted-foreground">{tr("本期免费次数已用完")}</p> : null}
                    </div>}
                </section>
                <div className={studio.form}>
                    {token && accepted && active ? <div className={composer.composer} data-expanded={modelOpen || focused || Boolean(prompt.trim())} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
                        <div className={composer.main}><div className={composer.body}>
                            <div className={composer.inputRow}><Input.TextArea variant="borderless" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={running} autoSize={{ minRows: 1, maxRows: 6 }} aria-label={tr("生图提示词")} placeholder={tr("描述你想免费生成的画面...")} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void generate(); } }} /></div>
                            <div className={composer.controls}><div><div className={composer.toolbar} inert={!modelOpen && !focused && !prompt.trim()}><div className={composer.toolbarRow}><ModelPicker onOpenChange={setModelOpen} config={config} kind="image" models={models} value={currentModel} onChange={setModel} billingLabel="Free [限量]" /></div><div className={composer.toolbarRow}><Select value={requestSize || undefined} onChange={setSize} aria-label={tr("分辨率")} options={sizes} disabled={running} /></div></div></div></div>
                        </div><Button className={composer.send} shape="circle" type="primary" icon={<ArrowUp size={18} />} loading={running} disabled={!prompt.trim() || !currentModel || !requestSize || !state.data?.remaining} aria-label={tr("免费生成图片")} onClick={() => void generate()} /></div>
                    </div> : null}
                </div>
            </div>
            {token && accepted ? <ExploreHistory type="free-image" activeId={selected?.id} onSelect={setSelected} /> : null}
        </div>
        <Modal title={tr("免费生成图片协议")} open={!accepted} closable={false} maskClosable={false} okText={tr("同意并继续")} cancelText={tr("取消")} okButtonProps={{ disabled: !checked }} onOk={() => setAccepted(true)} onCancel={() => router.push(localizedPath("/home"))}>
            <p className="mb-5 leading-7">{tr("免费生成图片：Aivro 会根据你图片的质量公开你生成的图片和提示词。公开后，你将获得一定的奖励额度。")}</p>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">{tr("公开与奖励由管理员审核决定，奖励额度在审核后发放。请仅提交你有权公开的内容。")}</p>
            <Checkbox checked={checked} onChange={(event) => setChecked(event.target.checked)}>{tr("我已阅读并同意公开图片和提示词")}</Checkbox>
        </Modal>
    </main>;
}
