"use client";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";

export function AuthLoadingOverlay({ open, label = "处理中" }: { open: boolean; label?: string }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/78 px-6 backdrop-blur-md">
            <div className="flex w-full max-w-[28rem] flex-col items-center rounded-[28px] border border-border/70 bg-background/90 px-8 py-10 text-center shadow-2xl">
                <AivroDrawableLoader className="h-28 w-[19rem] text-stone-950 dark:text-stone-100" />
                <div className="mt-5 text-base font-medium text-stone-600 dark:text-stone-300">{label}</div>
            </div>
        </div>
    );
}
