"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Spin } from "antd";

import { HCaptchaField } from "@/components/hcaptcha-field";
import { TurnstileField } from "@/components/turnstile-field";
import type { AdminPublicCaptchaSettings } from "@/services/api/admin";
import { fetchCaptchaSession, type CaptchaSession } from "@/services/api/auth";

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

    useEffect(() => () => {
        resolverRef.current?.reject(new Error("人机验证已取消"));
        resolverRef.current = null;
    }, []);

    const verify = useCallback(() => {
        if (!siteKey) return Promise.resolve("");
        if (mode === "inline") {
            if (token) return Promise.resolve(token);
            return Promise.reject(new Error("请先完成人机验证"));
        }
        resolverRef.current?.reject(new Error("人机验证已重新开始"));
        setError("");
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
    }, []);

    const cancel = useCallback(() => {
        resolverRef.current?.reject(new Error("人机验证已取消"));
        resolverRef.current = null;
        setState((value) => ({ ...value, open: false }));
    }, []);

    return {
        verify,
        reset,
        field: siteKey ? <CaptchaInlineField provider={provider} siteKey={siteKey} resetKey={state.resetKey} error={error} onVerify={onVerify} onError={onError} onReset={reset} /> : null,
        challenge: mode === "modal" ? (
            <CaptchaChallenge open={state.open} provider={provider} siteKey={siteKey} resetKey={state.resetKey} error={error} onVerify={onVerify} onError={onError} onCancel={cancel} onRetry={() => { setError(""); setState((value) => ({ ...value, resetKey: value.resetKey + 1 })); }} />
        ) : null,
    };
}

function CaptchaChallenge({ open, provider, siteKey, resetKey, error, onVerify, onError, onCancel, onRetry }: { open: boolean; provider: "turnstile" | "hcaptcha"; siteKey?: string; resetKey: number; error: string; onVerify: (token: string) => void; onError: (message: string) => void; onCancel: () => void; onRetry: () => void }) {
    const [ready, setReady] = useState(false);
    const [session, setSession] = useState<CaptchaSession | null>(null);
    const handleReady = useCallback(() => setReady(true), []);

    useEffect(() => {
        setReady(false);
    }, [open, resetKey]);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setSession(null);
        void fetchCaptchaSession().then((value) => { if (active) setSession(value); }).catch(() => undefined);
        return () => { active = false; };
    }, [open]);

    const code = session?.country.toUpperCase() || "";
    const country = /^[A-Z]{2}$/.test(code) && code !== "XX" ? new Intl.DisplayNames("zh-CN", { type: "region" }).of(code) : "未知";

    if (!open || !siteKey) return null;
    return (
        <Modal centered open={open} zIndex={2100} title="人机验证" onCancel={onCancel} footer={null} width={460} destroyOnHidden>
            <p className="mb-4 text-center text-sm leading-6 text-muted-foreground">请完成验证后继续，帮助我们保障账户安全。</p>
            <div className="mb-5 grid gap-1 break-all text-center text-[11px] leading-5 text-muted-foreground"><span>会话编号：{session?.sessionId || "—"}</span><div className="flex flex-wrap justify-center gap-x-4"><span>国家/地区：{country}</span><span>IP：{session?.clientIP || "—"}</span></div></div>
            <div className="relative flex min-h-24 items-center justify-center">
                {!ready && !error ? <Spin className="absolute" /> : null}
                <div className={`origin-center max-[360px]:scale-90 ${ready ? "opacity-100" : "opacity-0"}`}>
                {provider === "hcaptcha" ? <HCaptchaField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} /> : <TurnstileField siteKey={siteKey} resetKey={resetKey} onVerify={onVerify} onError={onError} onReady={handleReady} />}
                </div>
            </div>
            {error ? <div className="mt-3 text-center text-sm text-red-500"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 underline underline-offset-4">重新验证</button></div> : null}
        </Modal>
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
