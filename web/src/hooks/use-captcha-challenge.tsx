"use client";

import { useCallback, useRef, useState } from "react";

import { HCaptchaField } from "@/components/hcaptcha-field";
import { TurnstileField } from "@/components/turnstile-field";
import type { AdminPublicCaptchaSettings } from "@/services/api/admin";

type ChallengeState = {
    open: boolean;
    resetKey: number;
};

export function useCaptchaChallenge(captcha?: AdminPublicCaptchaSettings) {
    const [state, setState] = useState<ChallengeState>({ open: false, resetKey: 0 });
    const resolverRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
    const siteKey = captcha?.enabled ? captcha.siteKey : "";
    const provider = captcha?.provider || "turnstile";

    const verify = useCallback(() => {
        if (!siteKey) return Promise.resolve("");
        resolverRef.current?.reject(new Error("人机验证已重新开始"));
        setState((value) => ({ open: true, resetKey: value.resetKey + 1 }));
        return new Promise<string>((resolve, reject) => {
            resolverRef.current = { resolve, reject };
        });
    }, [siteKey]);

    const onVerify = useCallback((token: string) => {
        if (!token) return;
        resolverRef.current?.resolve(token);
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    const onError = useCallback((message: string) => {
        resolverRef.current?.reject(new Error(message));
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    return {
        verify,
        challenge: (
            <CaptchaChallenge open={state.open} provider={provider} siteKey={siteKey} resetKey={state.resetKey} onVerify={onVerify} onError={onError} />
        ),
    };
}

function CaptchaChallenge({ open, provider, siteKey, resetKey, onVerify, onError }: { open: boolean; provider: "turnstile" | "hcaptcha"; siteKey?: string; resetKey: number; onVerify: (token: string) => void; onError: (message: string) => void }) {
    if (!open || !siteKey) return null;
    return (
        <div className="fixed inset-0 z-[2100] grid place-items-center px-6 pointer-events-none">
            <div className="pointer-events-auto rounded-2xl border border-dashed border-stone-400 bg-background/95 p-5 shadow-xl dark:border-stone-600">
                {provider === "hcaptcha" ? <HCaptchaField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} /> : <TurnstileField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} />}
            </div>
        </div>
    );
}
