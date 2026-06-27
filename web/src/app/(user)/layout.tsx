"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppTopNav } from "@/components/layout/app-top-nav";
import { stripLocalePath } from "@/i18n/routing";

export default function UserLayout({ children }: { children: ReactNode }) {
    const cleanPathname = stripLocalePath(usePathname());
    const immersivePath = cleanPathname === "/pricing";
    const showTopNav = !immersivePath && cleanPathname !== "/canvas" && cleanPathname !== "/console" && !/^\/(canvas|console)\//.test(cleanPathname);

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            {showTopNav ? <AppTopNav /> : null}
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            {immersivePath ? null : <footer className="shrink-0 border-t border-stone-200 bg-background px-6 py-3 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">Copyright © 2026 Maishan Inc. All rights reserved Aivro</footer>}
        </div>
    );
}
