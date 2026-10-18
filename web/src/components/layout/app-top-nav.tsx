"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useState } from "react";
import { LocaleMenu } from "@/components/layout/locale-menu";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { useLocalizedPath } from "@/hooks/use-localized-path";

export function AppTopNav() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const localizedPath = useLocalizedPath();
    return <>
        <header className="relative z-30 h-16 shrink-0 border-b border-border bg-background/90 backdrop-blur-xl">
            <div className="mx-auto flex h-full w-full max-w-[1960px] items-center justify-between gap-5 px-6 lg:w-[77%] lg:px-0">
                <div className="flex items-center gap-10">
                    <Link href={localizedPath("/")} className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.06em]" aria-label="Aivro 首页"><span className="size-7 bg-foreground" style={{ mask: "url(/logo.svg) center / contain no-repeat" }} />Aivro</Link>
                    <nav aria-label="站点导航" className="hidden items-center gap-7 text-[13px] text-muted-foreground lg:flex">
                        <Link href={localizedPath("/#platform")} className="transition hover:text-foreground">创作平台</Link>
                        <Link href={localizedPath("/#showcase")} className="transition hover:text-foreground">灵感探索</Link>
                        <Link href={localizedPath("/pricing")} className="transition hover:text-foreground">套餐</Link>
                        <Link href={localizedPath("/#faq")} className="transition hover:text-foreground">常见问题</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <LocaleMenu /><UserStatusActions />
                    <Link href={localizedPath("/canvas")} className="ml-2 hidden h-8 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background sm:inline-flex">进入工作空间 <ArrowUpRight className="size-3.5" /></Link>
                    <button type="button" onClick={() => setMobileOpen(true)} aria-label="打开导航" className="inline-flex size-8 items-center justify-center lg:hidden"><Menu className="size-5" /></button>
                </div>
            </div>
        </header>
        <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>;
}
