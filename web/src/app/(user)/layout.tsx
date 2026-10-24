"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppTopNav } from "@/components/layout/app-top-nav";
import { ConsoleShell } from "@/components/console-shell";
import { stripLocalePath } from "@/i18n/routing";

export default function UserLayout({ children }: { children: ReactNode }) {
    const cleanPathname = stripLocalePath(usePathname());
    const workspacePath = ["/canvas", "/image", "/video", "/model-3d", "/prompts", "/assets", "/asset-library", "/console"].includes(cleanPathname) || cleanPathname.startsWith("/console/");
    const immersivePath = cleanPathname === "/pricing" || cleanPathname.startsWith("/canvas/");

    if (workspacePath) return <div className="h-dvh overflow-hidden"><ConsoleShell>{children}</ConsoleShell></div>;

    return (
        <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            {immersivePath ? null : <AppTopNav />}
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            {immersivePath || cleanPathname === "/" ? null : <footer className="shrink-0 border-t border-border bg-background px-6 py-3 text-center text-xs text-muted-foreground">© 2026 Maishan Inc. · Aivro 版权所有</footer>}
        </div>
    );
}
