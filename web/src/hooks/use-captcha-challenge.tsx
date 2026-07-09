"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { HCaptchaField } from "@/components/hcaptcha-field";
import { TurnstileField } from "@/components/turnstile-field";
import type { AdminPublicCaptchaSettings } from "@/services/api/admin";

type ChallengeState = {
    open: boolean;
    resetKey: number;
};

type CaptchaMode = "modal" | "inline";

export function useCaptchaChallenge(captcha?: AdminPublicCaptchaSettings, options: { mode?: CaptchaMode } = {}) {
    const [state, setState] = useState<ChallengeState>({ open: false, resetKey: 0 });
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const resolverRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
    const siteKey = captcha?.enabled ? captcha.siteKey : "";
    const provider = captcha?.provider || "turnstile";
    const mode = options.mode || "modal";

    const reset = useCallback(() => {
        resolverRef.current?.reject(new Error("人机验证已重新开始"));
        resolverRef.current = null;
        setToken("");
        setError("");
        setState((value) => ({ open: false, resetKey: value.resetKey + 1 }));
    }, []);

    useEffect(() => {
        resolverRef.current?.reject(new Error("人机验证已重新开始"));
        resolverRef.current = null;
        setToken("");
        setError("");
        setState((value) => ({ open: false, resetKey: value.resetKey + 1 }));
    }, [provider, siteKey]);

    const verify = useCallback(() => {
        if (!siteKey) return Promise.resolve("");
        if (mode === "inline") {
            if (token) return Promise.resolve(token);
            return Promise.reject(new Error("请先完成人机验证"));
        }
        resolverRef.current?.reject(new Error("人机验证已重新开始"));
        setState((value) => ({ open: true, resetKey: value.resetKey + 1 }));
        return new Promise<string>((resolve, reject) => {
            resolverRef.current = { resolve, reject };
        });
    }, [mode, siteKey, token]);

    const onVerify = useCallback((token: string) => {
        if (!token) return;
        setToken(token);
        setError("");
        resolverRef.current?.resolve(token);
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    const onError = useCallback((message: string) => {
        setToken("");
        setError(message);
        resolverRef.current?.reject(new Error(message));
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    return {
        verify,
        reset,
        field: siteKey ? <CaptchaInlineField provider={provider} siteKey={siteKey} resetKey={state.resetKey} error={error} onVerify={onVerify} onError={onError} onReset={reset} /> : null,
        challenge: mode === "modal" ? (
            <CaptchaChallenge open={state.open} provider={provider} siteKey={siteKey} resetKey={state.resetKey} onVerify={onVerify} onError={onError} />
        ) : null,
    };
}

function CaptchaChallenge({ open, provider, siteKey, resetKey, onVerify, onError }: { open: boolean; provider: "turnstile" | "hcaptcha"; siteKey?: string; resetKey: number; onVerify: (token: string) => void; onError: (message: string) => void }) {
    const [ready, setReady] = useState(false);
    const handleReady = useCallback(() => setReady(true), []);

    // 每次打开或重新挑战时先隐藏外框，等控件渲染完成后再和验证码一起显示。
    useEffect(() => {
        setReady(false);
    }, [open, resetKey]);

    if (!open || !siteKey) return null;
    return (
        <div className="fixed inset-0 z-[2100] grid place-items-center px-6 pointer-events-none">
            <div className={`rounded-2xl border border-dashed border-stone-400 bg-background/95 p-5 shadow-xl transition-opacity duration-200 dark:border-stone-600 ${ready ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
                {provider === "hcaptcha" ? <HCaptchaField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} /> : <TurnstileField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} />}
            </div>
        </div>
    );
}

function CaptchaInlineField({ provider, siteKey, resetKey, error, onVerify, onError, onReset }: { provider: "turnstile" | "hcaptcha"; siteKey: string; resetKey: number; error: string; onVerify: (token: string) => void; onError: (message: string) => void; onReset: () => void }) {
    const [ready, setReady] = useState(false);
    const handleReady = useCallback(() => setReady(true), []);

    useEffect(() => {
        setReady(false);
    }, [provider, resetKey, siteKey]);

    return (
        <div className="relative flex h-[96px] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-400/75 bg-stone-950/[0.03] px-1 dark:border-stone-600 dark:bg-white/[0.03]">
            <div className={`relative z-10 origin-center transition-opacity duration-200 max-[360px]:scale-90 ${ready ? "opacity-100" : "opacity-0"}`}>
                {provider === "hcaptcha" ? <HCaptchaField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} /> : <TurnstileField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} />}
            </div>
            {error ? (
                <div className="absolute inset-x-4 top-1/2 z-20 -translate-y-1/2 text-center text-sm leading-5 text-red-500 dark:text-red-300">
                    <div>{error}</div>
                    <button type="button" className="mt-1 text-xs font-medium text-red-600 underline underline-offset-4 dark:text-red-200" onClick={onReset}>
                        重新验证
                    </button>
                </div>
            ) : null}
        </div>
    );
}
