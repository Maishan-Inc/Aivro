"use client";

import { useEffect, useRef } from "react";

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, unknown>) => string;
            remove: (widgetId: string) => void;
        };
    }
}

const turnstileScriptId = "cf-turnstile-script";

type TurnstileFieldProps = {
    siteKey?: string;
    resetKey: number;
    onVerify: (token: string) => void;
    onError: (message: string) => void;
    onReady?: () => void;
};

export function TurnstileField({ siteKey, resetKey, onVerify, onError, onReady }: TurnstileFieldProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<string>("");

    useEffect(() => {
        if (!siteKey) {
            onVerify("");
            return;
        }
        let rendered = false;
        let canceled = false;
        const render = () => {
            if (canceled || !containerRef.current || !window.turnstile || widgetRef.current) return;
            try {
                widgetRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: onVerify,
                    "expired-callback": () => onError("人机验证已过期，请重试"),
                    "error-callback": () => onError("人机验证加载失败，请重试"),
                });
                rendered = true;
                onReady?.();
            } catch {
                onError("人机验证渲染失败，请检查 Site Key 和域名配置");
            }
        };
        const existing = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
        if (existing) {
            if (window.turnstile) render();
            else existing.addEventListener("load", render, { once: true });
        } else {
            const script = document.createElement("script");
            script.id = turnstileScriptId;
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            script.addEventListener("load", render, { once: true });
            script.addEventListener("error", () => {
                script.remove();
                onError("人机验证脚本加载失败，请检查网络或域名配置");
            }, { once: true });
            document.head.appendChild(script);
        }
        const timer = window.setTimeout(() => {
            if (!canceled && !rendered) {
                document.getElementById(turnstileScriptId)?.remove();
                onError("人机验证加载超时，请重试");
            }
        }, 10000);
        return () => {
            canceled = true;
            window.clearTimeout(timer);
            if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
            widgetRef.current = "";
        };
    }, [onError, onVerify, onReady, resetKey, siteKey]);

    if (!siteKey) return null;
    return <div ref={containerRef} className="h-[65px] w-[300px]" />;
}
