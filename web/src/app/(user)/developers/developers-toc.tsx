"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/use-i18n";

const sections = [
    { id: "quick-start", title: "快速开始" },
    { id: "authentication", title: "密钥与鉴权" },
    { id: "languages", title: "多语言代码示例" },
    { id: "reference", title: "接口参考" },
    { id: "queue", title: "异步任务处理" },
    { id: "video-workflow", title: "从参考图到视频下载" },
    { id: "responses", title: "响应与错误处理" },
    { id: "billing", title: "计费与使用建议" },
];

export function DevelopersToc({ endpoints }: { endpoints: { id: string; title: string }[] }) {
    const { tr, locale } = useI18n();
    const navRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [current, setCurrent] = useState({ id: sections[0].id, top: 0, height: 0 });

    useEffect(() => {
        const nav = navRef.current;
        const content = contentRef.current;
        const container = nav?.closest("main");
        const article = container?.querySelector("article");
        if (!nav || !content || !container || !article) return;
        const ids = new Set([...sections, ...endpoints].map((item) => item.id));
        const targets = Array.from(article.querySelectorAll<HTMLElement>("[id]")).filter((element) => ids.has(element.id));
        const desktop = window.matchMedia("(min-width: 1024px)");
        let frame = 0;
        const update = () => {
            frame = 0;
            const top = container.getBoundingClientRect().top + 33;
            let id = sections[0].id;
            for (const target of targets) {
                if (target.getBoundingClientRect().top > top) break;
                id = target.id;
            }
            if (container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 2) id = targets.at(-1)?.id || id;
            if (!desktop.matches && endpoints.some((item) => item.id === id)) id = "reference";
            const link = content.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
            if (!link) return;
            const next = { id, top: link.offsetTop, height: link.offsetHeight };
            setCurrent((previous) => previous.id === id && previous.top === next.top && previous.height === next.height ? previous : next);
            if (desktop.matches) {
                if (next.top < nav.scrollTop + 8) nav.scrollTo({ top: next.top - 8 });
                else if (next.top + next.height > nav.scrollTop + nav.clientHeight - 8) nav.scrollTo({ top: next.top + next.height - nav.clientHeight + 8 });
            }
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        const resize = new ResizeObserver(schedule);
        resize.observe(article);
        resize.observe(content);
        resize.observe(container);
        resize.observe(nav);
        targets.forEach((target) => resize.observe(target));
        container.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("hashchange", schedule);
        schedule();
        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            container.removeEventListener("scroll", schedule);
            window.removeEventListener("hashchange", schedule);
        };
    }, [endpoints, locale]);

    return <nav ref={navRef} aria-label={tr("开发文档目录")} className="thin-scrollbar max-h-[calc(100dvh-180px)] overflow-y-auto overscroll-contain text-sm lg:max-h-[calc(100dvh-250px)]">
        <div ref={contentRef} className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden w-0.5 rounded-full bg-foreground transition-[transform,height] duration-200 motion-reduce:transition-none lg:block" style={{ height: current.height, transform: `translateY(${current.top}px)` }} />
            <p className="mb-4 text-[11px] text-muted-foreground lg:pl-3">{tr("接入指南")}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 lg:flex-col">{sections.map((item, index) => <a key={item.id} href={`#${item.id}`} aria-current={current.id === item.id ? "location" : undefined} className={`inline-flex items-center gap-3 rounded-r-md px-3 py-2 font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${current.id === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}><span className="shrink-0 font-mono text-[10px] opacity-50">{String(index + 1).padStart(2, "0")}</span>{tr(item.title)}</a>)}</div>
            <div className="mt-7 hidden border-t border-border pt-5 lg:block"><p className="mb-3 pl-3 text-[11px] text-muted-foreground">{tr("模型与任务接口")}</p><div className="space-y-1">{endpoints.map((item) => <a key={item.id} href={`#${item.id}`} aria-current={current.id === item.id ? "location" : undefined} className={`block rounded-r-md px-3 py-2 text-xs font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${current.id === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>{tr(item.title)}</a>)}</div></div>
        </div>
    </nav>;
}
