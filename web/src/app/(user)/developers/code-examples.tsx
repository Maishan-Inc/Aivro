"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { useCopyText } from "@/hooks/use-copy-text";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { languageExamples } from "./examples";
import { exampleRequests, localizeExampleCode } from "./example-requests";
import { requestCode } from "./request-code";

export function CodeBlock({ code, label = "请求示例" }: { code: string; label?: string }) {
    const copyText = useCopyText();
    const { tr } = useI18n();
    const localizedCode = localizeExampleCode(code, tr);
    return <div className="my-5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground"><span>{tr(label)}</span><button type="button" onClick={() => copyText(localizedCode, "示例代码已复制")} className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-muted hover:text-foreground" aria-label={tr("复制示例代码")}><Copy className="size-3.5" />{tr("复制代码")}</button></div>
        <pre data-native-scroll translate="no" className="thin-scrollbar max-h-[480px] overflow-auto p-4 text-left text-[12px] leading-7 sm:p-5 sm:text-[13px]"><code>{localizedCode}</code></pre>
    </div>;
}

export function CodeExamples({ compact = false }: { compact?: boolean }) {
    const { tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const id = useId();
    const [selected, setSelected] = useState(0);
    const [operation, setOperation] = useState(0);
    const example = languageExamples[selected];
    const request = exampleRequests[operation];
    return <div className="min-w-0 text-left">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{tr("22 种语言 · 9 类调用")}</span><label className="flex items-center gap-2">{tr("调用场景")}<select value={operation} onChange={(event) => setOperation(Number(event.target.value))} className="rounded-md border border-border bg-background px-3 py-2 text-foreground">{exampleRequests.map((item, index) => <option key={item.id} value={index}>{tr(item.title)}</option>)}</select></label></div>
        <div className="my-5 flex flex-wrap gap-1.5" role="tablist" aria-label={tr("示例编程语言")}>{languageExamples.map((item, index) => <button key={item.name} id={`${id}-language-${index}`} type="button" role="tab" aria-selected={selected === index} aria-controls={`${id}-example`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % languageExamples.length : event.key === "ArrowLeft" ? (index + languageExamples.length - 1) % languageExamples.length : event.key === "Home" ? 0 : event.key === "End" ? languageExamples.length - 1 : null;
            if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(`${id}-language-${next}`)?.focus(); }
        }} className={`rounded-md border px-3 py-1.5 text-xs transition ${selected === index ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.name}</button>)}</div>
        <div role="tabpanel" id={`${id}-example`} aria-labelledby={`${id}-language-${selected}`} tabIndex={0}>{compact ? null : <p className="text-sm leading-7 text-muted-foreground">{tr(example.setup)}</p>}<CodeBlock label={`${example.name} · ${request.method} ${request.path}`} code={requestCode(example.name, request)} /></div>
        <p className="text-xs leading-6 text-muted-foreground">{tr("先设置 AIVRO_BASE_URL 与 AIVRO_API_KEY，并替换模型与任务编号。注释随界面语言切换，协议字段与示例提示词保持原样。")}</p>
        {compact ? <Link href={`${localizedPath("/developers")}#quick-start`} className="mt-2 inline-block text-xs underline underline-offset-4">{tr("配置环境变量与运行依赖")}</Link> : null}
        {request.id === "videos" ? <p className="mt-2 text-xs leading-6 text-muted-foreground">{tr("视频 JSON 请求的支持情况取决于渠道；带参考图的 multipart 请求与完整轮询示例见开发文档。")} <Link href={`${localizedPath("/developers")}#video-workflow`} className="text-foreground underline underline-offset-4">{tr("从参考图到视频下载")}</Link></p> : null}
    </div>;
}
