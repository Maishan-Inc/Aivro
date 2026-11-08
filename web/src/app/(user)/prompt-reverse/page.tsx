"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Image, Modal, Skeleton, Tabs, Tag } from "antd";
import { Check, Copy, ImagePlus, LoaderCircle, SearchCheck, X } from "lucide-react";
import { nanoid } from "nanoid";
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
import type { GenerationHistory, GenerationHistoryList } from "@/services/api/generation-history";
import { canAccessPath } from "@/lib/user-sections";
import { formatDateTime } from "@/lib/datetime";
import studio from "@/components/studio-layout.module.css";
import styles from "./prompt-reverse.module.css";

type LocalizedResult = { prompt: string; analysis: string; tags: string[] };
type ReverseImage = { id: string; image: string; name: string };
type ReverseTask = ReverseImage & { status: "running" | "success" | "error"; result?: GenerationHistory; error?: string };

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
    const reading = useRef(false);
    const session = useRef(0);
    const [pending, setPending] = useState<ReverseImage[]>([]);
    const [tasks, setTasks] = useState<ReverseTask[]>([]);
    const [model, setModel] = useState("");
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [selected, setSelected] = useState<GenerationHistory | null>(null);
    const models = useMemo(() => {
        const channel = settings?.modelChannel;
        const tokenModels = new Set(channel?.modelCosts.filter((item) => item.billingType === "token" && item.priceConfigured).map((item) => item.model));
        return (channel?.textModels || []).filter((name) => channel?.availableModels.includes(name) && tokenModels.has(name));
    }, [settings?.modelChannel]);
    const currentModel = models.includes(model) ? model : models.includes(config.textModel) ? config.textModel : models[0] || "";
    const running = tasks.some((task) => task.status === "running");
    const enabled = Boolean(settings?.explore?.promptReverseEnabled && canAccessPath(user, "/prompt-reverse"));
    const result = selected?.result?.[locale] as LocalizedResult | undefined;
    useEffect(() => {
        setPending([]); setTasks([]); setSelected(null); setLoading(false); setDragging(false);
        submitting.current = false; reading.current = false;
        return () => { session.current++; };
    }, [token, user?.id]);
    useRecordExpiry(selected, setSelected);
    useEffect(() => {
        const expires = Math.min(...tasks.flatMap((task) => task.result ? [Date.parse(task.result.expiresAt)] : []).filter(Number.isFinite));
        if (!Number.isFinite(expires)) return;
        const timer = window.setTimeout(() => setTasks((items) => items.filter((item) => !item.result || Date.parse(item.result.expiresAt) > Date.now())), Math.max(0, Math.min(2147483647, expires - Date.now())));
        return () => window.clearTimeout(timer);
    }, [tasks]);

    const readImages = async (files: File[]) => {
        if (!files.length || submitting.current || reading.current || !token) return;
        if (files.length > 6) { message.warning(tr("每次最多上传 6 张图片")); return; }
        if (files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
            message.error(tr("反推图片仅支持 PNG、JPEG、WebP，单张不超过 5MB")); return;
        }
        const currentSession = session.current;
        reading.current = true; setLoading(true);
        try {
            const images = await Promise.all(files.map(async (file) => ({ id: nanoid(), name: file.name, image: await new Promise<string>((resolve, reject) => {
                const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
            }) })));
            if (session.current === currentSession) setPending(images);
        } catch { if (session.current === currentSession) message.error(tr("读取图片失败")); }
        finally { if (session.current === currentSession) { reading.current = false; setLoading(false); } }
    };
    const reverse = async () => {
        if (!pending.length || !currentModel || !token || submitting.current) return;
        const currentSession = session.current;
        const batch = pending;
        submitting.current = true;
        setTasks(batch.map((item) => ({ ...item, status: "running" })));
        setPending([]); setSelected(null);
        await Promise.allSettled(batch.map(async (item) => {
            try {
                const reversed = await reverseImagePrompt(token, currentModel, item.image);
                if (session.current !== currentSession) return;
                client.setQueryData<GenerationHistoryList>(["explore-history", "prompt-reverse", token], (data) => ({
                    items: [reversed, ...(data?.items || []).filter((history) => history.id !== reversed.id)], total: (data?.total || 0) + (data?.items.some((history) => history.id === reversed.id) ? 0 : 1), retentionDays: data?.retentionDays || 0,
                }));
                setTasks((items) => items.map((task) => task.id === item.id ? { ...task, image: reversed.media[0]?.url || task.image, status: "success", result: reversed } : task));
                void client.invalidateQueries({ queryKey: ["explore-history", "prompt-reverse"] });
            } catch (error) {
                if (session.current !== currentSession) return;
                setTasks((items) => items.map((task) => task.id === item.id ? { ...task, status: "error", error: error instanceof Error ? error.message : "反推失败" } : task));
            }
        }));
        if (session.current === currentSession) { submitting.current = false; void useUserStore.getState().hydrateUser(); }
    };
    const newTask = () => { if (!submitting.current) { setTasks([]); setSelected(null); } };

    if (!settings) return <Skeleton active className="p-8" />;
    if (!enabled) return <div className="grid h-full place-items-center"><Empty description={tr("提示词反推尚未开启")} /></div>;
    return <main className={`${studio.studio} relative`}>
        <div className={studio.layout}>
            <div className={`${studio.panels} ${styles.panels}`}>
                <header className={studio.header}><h1>{tr("提示词反推")}</h1></header>
                <section className={`${studio.results} ${styles.workspace}`}>
                    {!token ? <div className={studio.empty}><SearchCheck size={36} /><h3>{tr("登录后使用提示词反推")}</h3><Link href={localizedPath("/login?redirect=/prompt-reverse")}>{tr("登录")}</Link></div> : !tasks.length ? <div className={styles.uploadArea}>
                        <button type="button" className={styles.upload} data-dragging={dragging} disabled={loading} onClick={() => fileInput.current?.click()}
                            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                            onDrop={(event) => { event.preventDefault(); setDragging(false); void readImages(Array.from(event.dataTransfer.files)); }}>
                            <span className={styles.uploadIcon}>{loading ? <LoaderCircle size={32} className="animate-spin" /> : <ImagePlus size={36} strokeWidth={1.5} />}</span>
                            <span className="text-xl font-medium">{tr("上传或拖入图片")}</span>
                            <span className="text-sm text-muted-foreground">{tr("最多 6 张图片 · 每张不超过 5MB")}</span>
                            <span className="text-sm text-muted-foreground" data-i18n-skip>PNG / JPEG / WebP</span>
                        </button>
                    </div> : <div className={styles.taskGrid} data-count={tasks.length}>
                        {tasks.map((task) => <article key={task.id} className={styles.task} data-status={task.status}>
                            <button type="button" className={styles.taskImage} onDoubleClick={() => task.result && setSelected(task.result)} onKeyDown={(event) => { if (task.result && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelected(task.result); } }} aria-label={tr(task.status === "success" ? "双击查看提示词" : task.status === "running" ? "正在反推" : "反推失败")}>
                                <img src={task.image} alt={task.name} data-i18n-skip />
                                {task.status === "running" ? <span className={styles.scanner} aria-hidden="true" /> : task.status === "success" ? <span className={styles.completed} aria-hidden="true"><Check size={52} strokeWidth={3} /></span> : <span className={styles.failed} aria-hidden="true"><X size={32} /></span>}
                            </button>
                            <div className={styles.taskInfo}><p className="truncate text-sm font-medium" title={task.name} data-i18n-skip>{task.name}</p>
                                <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-sm" aria-live="polite">
                                    <span className="flex items-center gap-2 text-muted-foreground">{task.status === "running" ? <LoaderCircle size={14} className="animate-spin" /> : null}{tr(task.status === "running" ? "正在反推" : task.status === "success" ? "反推完成" : "反推失败")}</span>
                                    {task.result ? <Button type="text" size="small" onClick={() => setSelected(task.result!)}>{tr("查看提示词")}</Button> : null}
                                </div>
                                {task.error ? <p className="mt-1 break-words text-sm text-destructive" role="alert">{tr(task.error)}</p> : null}
                            </div>
                        </article>)}
                    </div>}
                </section>
            </div>
            {token ? <ExploreHistory type="prompt-reverse" activeId={selected?.id} onSelect={setSelected} onNew={newTask} newDisabled={running || loading}
                pendingTasks={tasks.flatMap((task) => task.status === "success" ? [] : [{ id: task.id, name: task.name, image: task.image, status: task.status, error: task.error }])} /> : null}
        </div>
        <input ref={fileInput} hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void readImages(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <Modal centered title={tr("确认反推任务")} open={pending.length > 0} width={680} onCancel={() => setPending([])} onOk={() => void reverse()} okText={tr("确认反推 {0} 张图片").replace("{0}", String(pending.length))} cancelText={tr("取消")} okButtonProps={{ disabled: !currentModel }}>
            <div className={styles.previews}>{pending.map((item) => <div key={item.id} className={styles.preview}>
                <Image src={item.image} alt={item.name} data-i18n-skip /><button type="button" aria-label={tr("移除参考图")} onClick={() => setPending((items) => items.filter((image) => image.id !== item.id))}><X size={14} /></button>
            </div>)}</div>
            <div className="my-5"><ModelPicker config={config} kind="text" models={models} value={currentModel} onChange={setModel} fullWidth /></div>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">{tr("每张图片独立计费，按实际使用的 token 四舍五入扣除整数点数。")}</p>
            {!models.length ? <p className="mb-4 text-sm text-destructive">{tr("提示词反推需要按词元计费的文本模型")}</p> : null}
        </Modal>
        <Modal centered title={tr("反推提示词")} open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} width={960} destroyOnHidden styles={{ body: { maxHeight: "72dvh", overflowY: "auto" } }}>
            {selected ? <div className={styles.detail}>
                <Image src={selected.media[0]?.url} alt={tr("反推参考图")} style={{ maxHeight: 420, objectFit: "contain" }} />
                <div className="min-w-0">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(selected.expiresAt))}</span><Button icon={<Copy size={14} />} disabled={!result?.prompt} onClick={() => copyText(result?.prompt || "")}>{tr("复制提示词")}</Button></div>
                    <Tabs items={[
                        { key: "prompt", label: tr("反推提示词"), children: <><p className="whitespace-pre-wrap break-words text-[15px] leading-7" data-i18n-skip>{result?.prompt}</p><div className="mt-4 flex flex-wrap gap-2">{result?.tags?.map((tag) => <Tag key={tag} data-i18n-skip>{tag}</Tag>)}</div>{result?.prompt && canAccessPath(user, "/image") ? <Link className="mt-5 inline-block text-sm underline underline-offset-4" href={localizedPath(`/image?prompt=${encodeURIComponent(result.prompt)}`)}>{tr("用于生图")}</Link> : null}</> },
                        { key: "analysis", label: tr("画面分析"), children: <p className="whitespace-pre-wrap break-words text-[15px] leading-7" data-i18n-skip>{result?.analysis}</p> },
                        { key: "json", label: tr("结构化提示词"), children: <><Button icon={<Copy size={14} />} onClick={() => copyText(JSON.stringify(selected.result, null, 2))}>{tr("复制 JSON")}</Button><pre className="mt-4 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-sm" data-i18n-skip>{JSON.stringify(selected.result, null, 2)}</pre></> },
                    ]} />
                </div>
            </div> : null}
        </Modal>
    </main>;
}
