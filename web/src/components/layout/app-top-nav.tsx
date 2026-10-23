"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LocaleMenu } from "@/components/layout/locale-menu";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useI18n } from "@/hooks/use-i18n";
import { navigationTools } from "@/constant/navigation-tools";
import { stripLocalePath } from "@/i18n/routing";
import { useUserStore } from "@/stores/use-user-store";

export function AppTopNav() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const localizedPath = useLocalizedPath();
    const { locale } = useI18n();
    const pathname = usePathname();
    const home = stripLocalePath(pathname) === "/";
    const user = useUserStore((state) => state.user);
    useEffect(() => {
        if (!home) return;
        const update = (event?: Event) => {
            const target = event?.target instanceof HTMLElement && event.target.hasAttribute("data-home-scroll") ? event.target : document.querySelector<HTMLElement>("[data-home-scroll]");
            setScrolled((target?.scrollTop || 0) > 24);
            setVideoEnabled(target?.querySelector("[data-video]")?.getAttribute("data-video") === "true");
        };
        update();
        const root = document.querySelector("[data-home-scroll]");
        const observer = new MutationObserver(() => update());
        if (root) observer.observe(root, { attributes: true, subtree: true, attributeFilter: ["data-video"] });
        document.addEventListener("scroll", update, { capture: true, passive: true });
        return () => { observer.disconnect(); document.removeEventListener("scroll", update, true); };
    }, [home]);
    return <>
        <header className={`${home ? "absolute inset-x-0 top-0" : "relative"} z-30 h-16 shrink-0 border-b transition-[background-color,border-color,backdrop-filter,color] duration-300 ${home && !scrolled ? `border-transparent bg-transparent ${videoEnabled ? "text-white" : "text-foreground"}` : "border-border bg-background/95 text-foreground backdrop-blur-xl"}`}>
            <div className="mx-auto flex h-full w-full max-w-[1960px] items-center justify-between gap-3 px-6 min-[1001px]:px-[clamp(32px,5vw,64px)] min-[1401px]:w-[77%] min-[1401px]:px-0">
                    <Link href={localizedPath("/")} className="flex shrink-0 items-center gap-2.5 text-xl font-semibold tracking-[-0.06em]" aria-label="Aivro 首页"><span className="size-7 bg-current" style={{ mask: "url(/logo.svg) center / contain no-repeat" }} />Aivro</Link>
                    <nav aria-label="站点导航" className="hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap text-[12px] [scrollbar-width:none] [&>a]:shrink-0 lg:flex">
                        <Link href={localizedPath("/#platform")} className="transition hover:opacity-70">创作平台</Link>
                        <Link href={localizedPath("/#showcase")} className="transition hover:opacity-70">灵感探索</Link>
                        <Link href={localizedPath("/pricing")} className="transition hover:opacity-70">套餐</Link>
                        <Link href={localizedPath("/#faq")} className="transition hover:opacity-70">常见问题</Link>
                        {navigationTools.filter((tool) => tool.slug !== "assets").map((tool) => <Link key={tool.slug} href={tool.external ? tool.href + ("localeAware" in tool && tool.localeAware && locale === "zh-CN" ? "/zh-CN" : "") : localizedPath(`/${tool.slug}`)} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noopener noreferrer" : undefined} className="transition hover:opacity-70">{tool.label}</Link>)}
                        <Link href={localizedPath("/console/community")} className="transition hover:opacity-70">社区工作流</Link>
                    </nav>
                <div className={`flex shrink-0 items-center gap-2 sm:gap-3 ${home && !scrolled && videoEnabled ? "[&_button]:!text-white [&_a]:!text-white" : ""}`}>
                    <LocaleMenu /><UserStatusActions />
                    {user ? <Link href={localizedPath("/canvas")} className="ml-2 hidden h-8 items-center gap-2 rounded-md border border-current/20 px-3 text-xs font-medium sm:inline-flex">进入工作空间 <ArrowUpRight className="size-3.5" /></Link> : null}
                    <button type="button" onClick={() => setMobileOpen(true)} aria-label="打开导航" className="inline-flex size-8 items-center justify-center min-[2200px]:hidden"><Menu className="size-5" /></button>
                </div>
            </div>
        </header>
        <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>;
}
