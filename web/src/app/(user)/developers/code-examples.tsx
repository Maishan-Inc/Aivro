"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useCopyText } from "@/hooks/use-copy-text";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { languageExamples } from "./examples";
import { exampleRequests, localizeExampleCode } from "./example-requests";
import { requestCode } from "./request-code";

export function CodeBlock({ code, label = "请求示例", fixedLines }: { code: string; label?: string; fixedLines?: number }) {
    const copyText = useCopyText();
    const { tr } = useI18n();
    const localizedCode = localizeExampleCode(code, tr);
    return <div className="my-5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground"><span>{tr(label)}</span><button type="button" onClick={() => copyText(localizedCode, "示例代码已复制")} className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-muted hover:text-foreground" aria-label={tr("复制示例代码")}><Copy className="size-3.5" />{tr("复制代码")}</button></div>
        <pre data-native-scroll translate="no" style={fixedLines ? { height: `calc(${fixedLines} * 1.75rem + 2rem)` } : undefined} className={`thin-scrollbar overflow-auto p-4 text-left text-[12px] leading-7 sm:text-[13px] ${fixedLines ? "" : "max-h-[480px] sm:p-5"}`}><code>{localizedCode}</code></pre>
    </div>;
}

// Replaces the native <select>: the popup keeps readable contrast in both themes,
// shows each request method, and closes on outside click or Escape.
function OperationSelect({ value, onChange }: { value: number; onChange: (index: number) => void }) {
    const { tr } = useI18n();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionsRef = useRef<(HTMLLIElement | null)[]>([]);

    useEffect(() => {
        if (!open) return;
        optionsRef.current[value]?.focus();
        const close = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open, value]);

    const select = (index: number) => {
        onChange(index);
        setOpen(false);
        triggerRef.current?.focus();
    };

    return <div ref={rootRef} className="relative ml-auto w-36 shrink-0 sm:w-52">
        <button ref={triggerRef} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-foreground transition hover:border-foreground/25 hover:bg-muted">
            <span className="shrink-0 text-muted-foreground">{tr("调用场景")}</span>
            <span className="truncate font-medium">{tr(exampleRequests[value].title)}</span>
            <ChevronDown className={`ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? <ul role="listbox" aria-label={tr("调用场景")} onKeyDown={(event) => {
            const current = optionsRef.current.findIndex((node) => node === document.activeElement);
            const next = event.key === "ArrowDown" ? Math.min(current + 1, exampleRequests.length - 1) : event.key === "ArrowUp" ? Math.max(current - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? exampleRequests.length - 1 : -1;
            if (next >= 0) { event.preventDefault(); optionsRef.current[next]?.focus(); }
            else if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
        }} className="absolute right-0 top-full z-30 mt-2 max-h-72 w-full min-w-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[0_20px_44px_-20px_rgba(0,0,0,.5)]">
            {exampleRequests.map((item, index) => <li key={item.id} ref={(node) => { optionsRef.current[index] = node; }} role="option" aria-selected={index === value} tabIndex={-1} onClick={() => select(index)} onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                select(index);
            }} className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs outline-none transition ${index === value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"}`}>
                <span className="flex-1 truncate">{tr(item.title)}</span>
                <small className="shrink-0 font-mono text-[10px] opacity-50">{item.method}</small>
                <Check className={`size-3.5 shrink-0 ${index === value ? "opacity-100" : "opacity-0"}`} />
            </li>)}
        </ul> : null}
    </div>;
}

const compactLanguageCount = 8;
const compactCodeLines = Math.max(...languageExamples.flatMap((example) => exampleRequests.map((request) => requestCode(example.name, request).split("\n").length))) * 0.75;
const activeLanguageStyle = { background: "var(--foreground)", color: "var(--background)", borderColor: "var(--foreground)" };

export function CodeExamples({ compact = false }: { compact?: boolean }) {
    const { tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const id = useId();
    const [selected, setSelected] = useState(0);
    const [operation, setOperation] = useState(0);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const moreTriggerRef = useRef<HTMLButtonElement>(null);
    const example = languageExamples[selected];
    const request = exampleRequests[operation];
    const visibleLanguages = compact ? languageExamples.slice(0, compactLanguageCount) : languageExamples;

    useEffect(() => {
        if (!moreOpen) return;
        const popup = moreRef.current;
        (popup?.querySelector<HTMLLIElement>('[role="option"][aria-selected="true"]') || popup?.querySelector<HTMLLIElement>('[role="option"]'))?.focus();
        const close = (event: MouseEvent) => {
            if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [moreOpen]);

    const languageKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const count = visibleLanguages.length;
        const next = event.key === "ArrowRight" ? (index + 1) % count : event.key === "ArrowLeft" ? (index + count - 1) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
        if (next === null) return;
        event.preventDefault();
        setSelected(next);
        document.getElementById(`${id}-language-${next}`)?.focus();
    };
    const chooseMoreLanguage = (index: number) => {
        setSelected(index);
        setMoreOpen(false);
        moreTriggerRef.current?.focus();
    };
    return <div className="min-w-0 text-left">
        <p className="mb-3 text-[11px] text-muted-foreground">{tr("22 种语言 · 9 类调用")}</p>
        <div className={compact ? "flex items-center gap-1.5" : "flex flex-wrap items-end gap-x-3 gap-y-2"}>
            <div className={compact ? "thin-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto" : "flex min-w-0 flex-1 basis-[260px] flex-wrap gap-1.5"} data-native-scroll role="tablist" aria-label={tr("示例编程语言")}>{visibleLanguages.map((item, index) => <button key={item.name} id={`${id}-language-${index}`} type="button" role="tab" aria-selected={selected === index} aria-controls={`${id}-example`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => languageKeyboard(event, index)} style={selected === index ? activeLanguageStyle : undefined} className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs transition ${selected === index ? "font-medium" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.name}</button>)}</div>
            {compact ? <div ref={moreRef} className="relative shrink-0">
                <button ref={moreTriggerRef} id={`${id}-more`} type="button" aria-haspopup="listbox" aria-expanded={moreOpen} aria-label={tr("更多语言")} onClick={() => setMoreOpen((current) => !current)} style={selected >= compactLanguageCount ? activeLanguageStyle : undefined} className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
                    {selected >= compactLanguageCount ? <span className="max-w-12 truncate sm:max-w-24">{languageExamples[selected].name}</span> : null}<span className={selected >= compactLanguageCount ? "hidden sm:inline" : ""}>+{languageExamples.length - compactLanguageCount}</span><ChevronDown className={`size-3.5 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen ? <ul role="listbox" aria-label={tr("更多语言")} onKeyDown={(event) => {
                    const options = Array.from(event.currentTarget.querySelectorAll<HTMLLIElement>("[role=option]"));
                    const current = options.indexOf(document.activeElement as HTMLLIElement);
                    const next = event.key === "ArrowDown" ? Math.min(current + 1, options.length - 1) : event.key === "ArrowUp" ? Math.max(current - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
                    if (next >= 0) { event.preventDefault(); options[next].focus(); }
                    else if (event.key === "Escape") { event.preventDefault(); setMoreOpen(false); moreTriggerRef.current?.focus(); }
                }} className="absolute left-0 top-full z-30 mt-2 max-h-72 w-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[0_20px_44px_-20px_rgba(0,0,0,.5)]">
                    {languageExamples.slice(compactLanguageCount).map((item, offset) => {
                        const index = offset + compactLanguageCount;
                        return <li key={item.name} id={`${id}-language-${index}`} role="option" aria-selected={selected === index} aria-controls={`${id}-example`} tabIndex={selected === index ? 0 : -1} onClick={() => chooseMoreLanguage(index)} onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            chooseMoreLanguage(index);
                        }} className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs outline-none transition ${selected === index ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"}`}><span className="flex-1">{item.name}</span><Check className={`size-3.5 ${selected === index ? "opacity-100" : "opacity-0"}`} /></li>;
                    })}
                </ul> : null}
            </div> : null}
            <OperationSelect value={operation} onChange={setOperation} />
        </div>
        <div className="mt-5" role="tabpanel" id={`${id}-example`} aria-labelledby={compact && selected >= compactLanguageCount ? `${id}-more` : `${id}-language-${selected}`} tabIndex={0}>{compact ? null : <p className="text-sm leading-7 text-muted-foreground">{tr(example.setup)}</p>}<CodeBlock fixedLines={compact ? compactCodeLines : undefined} label={`${example.name} · ${request.method} ${request.path}`} code={requestCode(example.name, request)} /></div>
        <p className="text-xs leading-6 text-muted-foreground">{tr("先设置 AIVRO_BASE_URL 与 AIVRO_API_KEY，并替换模型与任务编号。注释随界面语言切换，协议字段与示例提示词保持原样。")}</p>
        {compact ? <Link href={`${localizedPath("/developers")}#quick-start`} className="mt-2 inline-block text-xs underline underline-offset-4">{tr("配置环境变量与运行依赖")}</Link> : null}
        {request.id === "videos" ? <p className="mt-2 text-xs leading-6 text-muted-foreground">{tr("视频 JSON 请求的支持情况取决于渠道；带参考图的 multipart 请求与完整轮询示例见开发文档。")} <Link href={`${localizedPath("/developers")}#video-workflow`} className="text-foreground underline underline-offset-4">{tr("从参考图到视频下载")}</Link></p> : null}
    </div>;
}
