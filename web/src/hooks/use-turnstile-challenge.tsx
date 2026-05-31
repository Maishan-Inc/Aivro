"use client";

import { useCallback, useRef, useState } from "react";

import { TurnstileField } from "@/components/turnstile-field";

type ChallengeState = {
    open: boolean;
    resetKey: number;
};

export function useTurnstileChallenge(siteKey?: string) {
    const [state, setState] = useState<ChallengeState>({ open: false, resetKey: 0 });
    const resolverRef = useRef<((token: string) => void) | null>(null);

    const verify = useCallback(() => {
        if (!siteKey) return Promise.resolve("");
        setState((value) => ({ open: true, resetKey: value.resetKey + 1 }));
        return new Promise<string>((resolve) => {
            resolverRef.current = resolve;
        });
    }, [siteKey]);

    const onVerify = useCallback((token: string) => {
        if (!token) return;
        resolverRef.current?.(token);
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    return {
        verify,
        challenge: (
            <TurnstileChallenge open={state.open} siteKey={siteKey} resetKey={state.resetKey} onVerify={onVerify} />
        ),
    };
}

function TurnstileChallenge({ open, siteKey, resetKey, onVerify }: { open: boolean; siteKey?: string; resetKey: number; onVerify: (token: string) => void }) {
    if (!open || !siteKey) return null;
    return (
        <div className="fixed inset-0 z-[2100] grid place-items-center px-6 pointer-events-none">
            <div className="pointer-events-auto rounded-2xl border border-dashed border-stone-400 bg-background/95 p-5 shadow-xl dark:border-stone-600">
                <TurnstileField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} />
            </div>
        </div>
    );
}
