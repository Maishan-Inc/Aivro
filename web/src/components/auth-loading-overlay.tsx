"use client";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";

export function AuthLoadingOverlay({ open, label = "处理中" }: { open: boolean; label?: string }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center px-6 pointer-events-none">
            <div className="flex w-full max-w-[28rem] flex-col items-center justify-center text-center">
                <AivroDrawableLoader className="h-28 w-[19rem] text-stone-950 dark:text-stone-100" />
                <div className="mt-5 text-base font-medium text-stone-600 dark:text-stone-300">{label}</div>
            </div>
        </div>
    );
}
