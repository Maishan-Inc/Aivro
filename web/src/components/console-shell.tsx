"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Drawer } from "antd";
import { ArrowUpRight, BookOpen, ChevronRight, Home, KeyRound, LayoutDashboard, Link2, Menu, PanelLeftClose, PanelLeftOpen, UserCircle, WalletCards } from "lucide-react";

import { LocaleMenu } from "@/components/layout/locale-menu";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { navigationTools } from "@/constant/navigation-tools";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { stripLocalePath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/datetime";
import { useUserStore } from "@/stores/use-user-store";

const accountItems = [
    { href: "/console", label: "控制台", icon: LayoutDashboard },
    { href: "/console/shares", label: "我的分享", icon: Link2 },
    { href: "/console/community", label: "社区工作流", icon: BookOpen },
    { href: "/console/wallet", label: "我的钱包", icon: WalletCards },
    { href: "/console/api-keys", label: "密钥管理", icon: KeyRound },
    { href: "/console/profile", label: "个人中心", icon: UserCircle },
];

export function ConsoleShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const localizedPath = useLocalizedPath();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const cleanPathname = stripLocalePath(pathname);
    const requiresLogin = cleanPathname === "/canvas" || cleanPathname === "/console" || cleanPathname.startsWith("/console/");
    const title = navigationTools.find((item) => cleanPathname === `/${item.slug}`)?.label || accountItems.find((item) => item.href === cleanPathname)?.label || "素材广场";
    const loginPath = localizedPath(`/login?redirect=${encodeURIComponent(cleanPathname)}`);

    useEffect(() => {
        if (requiresLogin && isReady && !token) router.replace(loginPath);
    }, [isReady, requiresLogin, loginPath, router, token]);

    if (requiresLogin && (!isReady || !token)) return <div className="grid h-full place-items-center bg-background text-sm text-muted-foreground" role="status">正在打开工作空间…</div>;

    return (
        <div className="flex h-full min-h-0 bg-background text-foreground">
            <aside className={cn("hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-[224px]")}>
                <Link href={localizedPath("/")} aria-label="Aivro 首页" className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5", collapsed && "justify-center px-0")}>
                    <span className="size-7 shrink-0 bg-foreground" style={{ mask: "url(/logo.svg) center / contain no-repeat" }} />
                    {!collapsed ? <span className="whitespace-nowrap text-lg font-semibold tracking-[-0.04em]">Aivro Studio</span> : null}
                </Link>
                <ConsoleNavigation collapsed={collapsed} />
                <div className="flex h-14 shrink-0 items-center justify-between border-t border-border px-5">
                    {!collapsed ? <Link href={localizedPath("/pricing")} className="text-xs text-muted-foreground transition hover:text-foreground">探索套餐 <ArrowUpRight className="ml-1 inline size-3" /></Link> : null}
                    <button type="button" onClick={() => setCollapsed((value) => !value)} className="text-muted-foreground hover:text-foreground" aria-label={collapsed ? "展开侧栏" : "收起侧栏"} title={collapsed ? "展开侧栏" : "收起侧栏"}>
                        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                    </button>
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:h-16 lg:px-6">
                    <div className="flex min-w-0 items-center gap-3 text-sm">
                        <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted lg:hidden" aria-label="打开导航"><Menu className="size-5" /></button>
                        <span className="hidden text-muted-foreground sm:inline">工作空间</span><ChevronRight className="hidden size-3 text-muted-foreground sm:block" /><span className="truncate font-medium">{title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {user ? <Link href={localizedPath("/console/wallet")} className="mr-2 hidden text-xs tabular-nums text-muted-foreground sm:block">{formatNumber(user.credits ?? 0)} 算力点</Link> : null}
                        <LocaleMenu /><UserStatusActions />
                    </div>
                </header>
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            <Drawer title="Aivro · 创作空间" placement="left" size={280} open={mobileOpen} onClose={() => setMobileOpen(false)} styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }} destroyOnHidden>
                <ConsoleNavigation onNavigate={() => setMobileOpen(false)} />
                <Link href={localizedPath("/pricing")} onClick={() => setMobileOpen(false)} className="border-t border-border p-5 text-sm">探索套餐 <ArrowUpRight className="ml-1 inline size-4" /></Link>
            </Drawer>
        </div>
    );
}

function ConsoleNavigation({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    const pathname = stripLocalePath(usePathname());
    const localizedPath = useLocalizedPath();
    const { locale, t } = useI18n();
    const groups = [
        { title: "创作工具", items: navigationTools.filter((tool) => !tool.external).map((tool) => ({ href: `/${tool.slug}`, label: t(tool.labelKey), icon: tool.icon, external: false })) },
        { title: "探索更多", items: navigationTools.filter((tool) => tool.external).map((tool) => ({ href: tool.href + ("localeAware" in tool && tool.localeAware && locale === "zh-CN" ? "/zh-CN" : ""), label: t(tool.labelKey), icon: tool.icon, external: true })) },
        { title: "我的空间", items: accountItems.map((item) => ({ ...item, external: false })) },
    ];
    return (
        <nav className="thin-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="工作空间导航">
            <Link href={localizedPath("/")} onClick={onNavigate} title={collapsed ? "首页" : undefined} className={cn("flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", collapsed && "justify-center px-0")}><Home className="size-4 shrink-0" />{!collapsed ? "首页" : null}</Link>
            {groups.map((group) => <div key={group.title}>
                {!collapsed ? <p className="mb-2 px-3 text-[10px] tracking-wider text-muted-foreground">{group.title}</p> : <div className="mx-3 mb-3 border-t border-border" />}
                <div className="space-y-1">{group.items.map(({ href, label, icon: Icon, external }) => <Link key={href} href={external ? href : localizedPath(href)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} aria-current={pathname === href ? "page" : undefined} className={cn("flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition", collapsed && "justify-center px-0", pathname === href ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className="size-4 shrink-0" />{!collapsed ? <><span className="truncate">{label}</span>{external ? <ArrowUpRight className="ml-auto size-3 opacity-50" /> : null}</> : null}
                </Link>)}</div>
            </div>)}
        </nav>
    );
}
