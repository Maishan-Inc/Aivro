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
};

export function TurnstileField({ siteKey, resetKey, onVerify }: TurnstileFieldProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<string>("");

    useEffect(() => {
        if (!siteKey) {
            onVerify("");
            return;
        }
        let canceled = false;
        const render = () => {
            if (canceled || !containerRef.current || !window.turnstile || widgetRef.current) return;
            widgetRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                callback: onVerify,
                "expired-callback": () => onVerify(""),
                "error-callback": () => onVerify(""),
            });
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
            document.head.appendChild(script);
        }
        return () => {
            canceled = true;
            if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
            widgetRef.current = "";
            onVerify("");
        };
    }, [onVerify, resetKey, siteKey]);

    if (!siteKey) return null;
    return <div ref={containerRef} className="min-h-[65px]" />;
}
