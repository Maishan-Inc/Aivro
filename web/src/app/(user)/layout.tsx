"use client";

import type { ReactNode } from "react";

import { AppTopNav } from "@/components/layout/app-top-nav";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <AppTopNav />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            <footer className="shrink-0 border-t border-stone-200 bg-background px-6 py-3 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">Copyright © 2026 Maishan Inc. All rights reserved Aivro</footer>
        </div>
    );
}
