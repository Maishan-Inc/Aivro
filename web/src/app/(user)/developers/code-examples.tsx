"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useCopyText } from "@/hooks/use-copy-text";
import { useI18n } from "@/hooks/use-i18n";
import { languageExamples } from "./examples";

export function CodeBlock({ code, label = "请求示例" }: { code: string; label?: string }) {
    const copyText = useCopyText();
    const { tr } = useI18n();
    return <div className="my-5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground"><span>{tr(label)}</span><button type="button" onClick={() => copyText(code, "示例代码已复制")} className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-muted hover:text-foreground" aria-label={tr("复制示例代码")}><Copy className="size-3.5" />{tr("复制代码")}</button></div>
        <pre className="thin-scrollbar max-h-[600px] overflow-auto p-4 text-[12px] leading-7 sm:p-5 sm:text-[13px]"><code>{code}</code></pre>
    </div>;
}

export function CodeExamples() {
    const { tr } = useI18n();
    const [selected, setSelected] = useState(0);
    const example = languageExamples[selected];
    return <div>
        <div className="my-5 flex flex-wrap gap-1.5" role="tablist" aria-label={tr("示例编程语言")}>{languageExamples.map((item, index) => <button key={item.name} id={`language-${index}`} type="button" role="tab" aria-selected={selected === index} aria-controls="language-example" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % languageExamples.length : event.key === "ArrowLeft" ? (index + languageExamples.length - 1) % languageExamples.length : event.key === "Home" ? 0 : event.key === "End" ? languageExamples.length - 1 : null;
            if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(`language-${next}`)?.focus(); }
        }} className={`rounded-md border px-3 py-1.5 text-xs transition ${selected === index ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.name}</button>)}</div>
        <div role="tabpanel" id="language-example" aria-labelledby={`language-${selected}`}><p className="text-sm leading-7 text-muted-foreground">{tr(example.setup)}</p><CodeBlock label={`${example.name} · 对话调用示例`} code={example.code} /></div>
    </div>;
}
