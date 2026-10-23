"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Modal, Switch } from "antd";
import { useLocalizedPath } from "@/hooks/use-localized-path";

const storageKey = "aivro-cookie-preferences";
const defaults = { functional: false, performance: false, targeting: false };

export function CookiePreferences() {
    const localizedPath = useLocalizedPath();
    const [open, setOpen] = useState(false);
    const [preferences, setPreferences] = useState(defaults);
    const save = (value = preferences) => {
        window.localStorage.setItem(storageKey, JSON.stringify({ ...value, necessary: true }));
        setOpen(false);
    };
    return <>
        <button type="button" onClick={() => {
            let value = defaults;
            try {
                const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null");
                if (stored) value = { functional: stored.functional === true, performance: stored.performance === true, targeting: stored.targeting === true };
            } catch {}
            setPreferences(value);
            setOpen(true);
        }} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><span className="flex overflow-hidden rounded-full border border-blue-600 text-[10px] leading-4" aria-hidden="true"><span className="bg-blue-600 px-1 text-white">✓</span><span className="bg-white px-1 text-blue-600">×</span></span>Cookie 首选项</button>
        <Modal centered open={open} onCancel={() => setOpen(false)} width={620} title={<div className="flex flex-wrap items-center gap-x-5 gap-y-2 pr-7"><span className="flex items-center gap-2 text-xl font-semibold"><span className="size-6 bg-foreground" style={{ mask: "url(/logo.svg) center / contain no-repeat" }} />Aivro</span><span className="text-base font-medium">管理同意偏好设置</span></div>} footer={null} styles={{ body: { maxHeight: "calc(100dvh - 160px)", overflowY: "auto" } }}>
            <div className="py-4"><h3 className="mb-3 text-base font-medium">您的Cookie选项</h3><p className="text-sm leading-7 text-muted-foreground">Aivro 使用以下四种类型的 Cookie。您可以决定希望接受哪类 Cookie，以改善您在我们网站上的体验。如需了解更多关于我们网站上使用的 Cookie 的信息，请阅读我们的<Link href={localizedPath("/privacy")} onClick={() => setOpen(false)} className="text-foreground underline underline-offset-4">隐私政策</Link>。</p></div>
            <div className="divide-y divide-border border-y border-border">
                <div className="flex items-center justify-between gap-4 py-4"><div><strong className="text-sm font-medium">严格必要 Cookie</strong><p className="mt-1 text-xs text-muted-foreground">始终启用</p></div><Switch checked disabled aria-label="严格必要 Cookie，始终启用" /></div>
                {([{ key: "functional", title: "功能性 Cookie", description: "保存偏好设置与基础体验选项" }, { key: "performance", title: "性能 Cookie", description: "用于了解页面性能与访问质量" }, { key: "targeting", title: "定向 Cookie", description: "用于个性化内容与推荐展示" }] as const).map((item) => <div key={item.key} className="flex items-center justify-between gap-4 py-4"><div><strong className="text-sm font-medium">{item.title}</strong><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div><Switch checked={preferences[item.key]} onChange={(checked) => setPreferences((value) => ({ ...value, [item.key]: checked }))} aria-label={item.title} /></div>)}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3"><Button onClick={() => save()}>保存偏好</Button><Button type="primary" onClick={() => save({ functional: true, performance: true, targeting: true })}>全部接受</Button></div>
            <p className="mt-5 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">Powered by Cookie Pro © 2026 Maishan Inc.</p>
        </Modal>
    </>;
}
