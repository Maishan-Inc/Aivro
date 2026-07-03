"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "antd";
import { BadgeDollarSign, BookOpen, Box, FileText, Home, ImagePlus, Images, LayoutDashboard, Link2, Maximize2, SearchCheck, Sparkles, UserCircle, Video, WalletCards, type LucideIcon } from "lucide-react";

import { useLocalizedPath } from "@/hooks/use-localized-path";
import { stripLocalePath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/use-user-store";

type ConsoleNavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
    exact?: boolean;
    external?: boolean;
};

const consoleItems: ConsoleNavItem[] = [
    { href: "/console", label: "控制台首页", icon: LayoutDashboard, exact: true },
    { href: "/canvas", label: "我的工作流", icon: Maximize2 },
    { href: "/console/shares", label: "我的分享", icon: Link2 },
    { href: "/console/community", label: "社区工作流", icon: BookOpen },
    { href: "/console/wallet", label: "我的钱包", icon: WalletCards },
    { href: "/console/profile", label: "个人中心", icon: UserCircle },
];

const toolItems: ConsoleNavItem[] = [
    { href: "/image", label: "生图工作台", icon: ImagePlus },
    { href: "/video", label: "视频创作台", icon: Video },
    { href: "/model-3d", label: "3D 模型工作台", icon: Box },
    { href: "/prompts", label: "提示词库", icon: FileText },
    { href: "/assets", label: "我的素材", icon: Images },
    { href: "https://insigh.aivro.org", label: "提示词反推", icon: SearchCheck, external: true },
    { href: "https://edge.aivro.org", label: "免费生成图片", icon: Sparkles, external: true },
    { href: "/pricing", label: "套餐", icon: BadgeDollarSign },
];

export function ConsoleShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const localizedPath = useLocalizedPath();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const cleanPathname = stripLocalePath(pathname);
    const userName = user?.displayName || user?.username || "";

    useEffect(() => {
        if (!isReady) return;
        if (!token) router.replace(localizedPath(`/login?redirect=${encodeURIComponent(cleanPathname)}`));
    }, [cleanPathname, isReady, localizedPath, router, token]);

    if (!isReady || !token) return <div className="h-full bg-stone-50 dark:bg-stone-950" />;

    return (
        <main className="grid h-full min-h-0 grid-rows-[1fr_auto] overflow-hidden bg-stone-50 text-stone-950 lg:grid-cols-[232px_minmax(0,1fr)] lg:grid-rows-1 dark:bg-stone-950 dark:text-stone-100">
            <aside className="order-2 flex min-h-0 border-t border-stone-200 bg-background lg:order-1 lg:flex-col lg:border-r lg:border-t-0 dark:border-stone-800">
                <div className="hidden h-24 shrink-0 items-center gap-3 border-b border-stone-200 px-5 lg:flex dark:border-stone-800">
                    <Avatar size={40} src={user?.avatarUrl || undefined} className="border border-stone-200 bg-transparent dark:border-stone-700">
                        {(userName[0] || "U").toUpperCase()}
                    </Avatar>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{userName || "Aivro User"}</div>
                    </div>
                </div>
                <nav className="thin-scrollbar flex flex-1 gap-1 overflow-x-auto p-2 lg:block lg:space-y-5 lg:overflow-y-auto lg:p-3">
                    <ConsoleNavGroup items={consoleItems} pathname={cleanPathname} localizedPath={localizedPath} />
                    <div className="hidden border-t border-stone-200 lg:block dark:border-stone-800" />
                    <ConsoleNavGroup items={toolItems} pathname={cleanPathname} localizedPath={localizedPath} />
                </nav>
                <Link href={localizedPath("/")} className="hidden h-12 shrink-0 items-center gap-2 border-t border-stone-200 px-5 text-sm text-stone-500 transition hover:text-stone-950 lg:flex dark:border-stone-800 dark:text-stone-400 dark:hover:text-stone-100">
                    <Home className="size-4" />
                    返回站点首页
                </Link>
            </aside>
            <section className="order-1 min-h-0 overflow-hidden lg:order-2">{children}</section>
        </main>
    );
}

function ConsoleNavGroup({ items, pathname, localizedPath }: { items: ConsoleNavItem[]; pathname: string; localizedPath: (path: string) => string }) {
    return (
        <div className="contents lg:block lg:space-y-1">
            {items.map((item) => {
                const Icon = item.icon;
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const href = item.external ? item.href : localizedPath(item.href);
                return (
                    <Link
                        key={item.href}
                        href={href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noreferrer" : undefined}
                        className={cn(
                            "flex h-[54px] min-w-20 flex-col items-center justify-center gap-1 rounded-md px-2 text-center text-[11px] transition lg:h-10 lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm",
                            active ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-500 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100",
                        )}
                    >
                        <Icon className="size-4 shrink-0" />
                        <span className="w-full truncate leading-4">{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
