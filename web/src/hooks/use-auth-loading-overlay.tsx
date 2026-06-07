"use client";

import { useCallback, useState } from "react";

import { AuthLoadingOverlay } from "@/components/auth-loading-overlay";

export function useAuthLoadingOverlay(minDurationMs = 1450) {
    const [state, setState] = useState<{ open: boolean; label: string }>({ open: false, label: "" });

    const runWithOverlay = useCallback(
        async <T,>(label: string, task: () => Promise<T>) => {
            const startedAt = performance.now();
            setState({ open: true, label });
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            try {
                return await task();
            } finally {
                const elapsed = performance.now() - startedAt;
                const waitMs = Math.max(0, minDurationMs - elapsed);
                if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
                setState({ open: false, label: "" });
            }
        },
        [minDurationMs],
    );

    return {
        overlay: <AuthLoadingOverlay open={state.open} label={state.label} />,
        runWithOverlay,
    };
}
