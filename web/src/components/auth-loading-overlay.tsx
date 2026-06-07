"use client";

import { AivroOutlineTitle } from "@/components/aivro-outline-title";

export function AuthLoadingOverlay({ open, label = "处理中" }: { open: boolean; label?: string }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center px-6 pointer-events-none">
            <div className="flex w-full max-w-[28rem] flex-col items-center justify-center text-center">
                <AivroOutlineTitle label="Aivro" className="!w-[min(78vw,22rem)] text-stone-100 drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)]" />
                <div className="mt-5 text-base font-medium text-stone-300">{label}</div>
            </div>
        </div>
    );
}
