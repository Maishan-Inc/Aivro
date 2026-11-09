"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppTopNav } from "@/components/layout/app-top-nav";
import { SiteBanner } from "@/components/layout/site-banner";
import { ConsoleShell } from "@/components/console-shell";
import { stripLocalePath } from "@/i18n/routing";

export default function UserLayout({ children }: { children: ReactNode }) {
    const cleanPathname = stripLocalePath(usePathname());
    const workspacePath = ["/canvas", "/image", "/video", "/model-3d", "/prompts", "/assets", "/asset-library", "/console", "/free-image", "/prompt-reverse"].includes(cleanPathname) || cleanPathname.startsWith("/console/");
    const immersivePath = cleanPathname === "/pricing" || cleanPathname.startsWith("/canvas/");

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <SiteBanner />
            {workspacePath ? <div className="min-h-0 flex-1 overflow-hidden"><ConsoleShell>{children}</ConsoleShell></div> : <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {immersivePath ? null : <AppTopNav />}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
                {immersivePath || cleanPathname === "/" || cleanPathname === "/home" ? null : <footer lang="en" data-i18n-skip className="shrink-0 border-t border-border bg-background px-6 py-3 text-center text-xs text-muted-foreground">© 2026 Maishan Inc. · Aivro. All rights reserved.</footer>}
            </div>}
        </div>
    );
}
