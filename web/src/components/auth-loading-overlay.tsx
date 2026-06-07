"use client";

import { useEffect, useRef } from "react";

export function AuthLoadingOverlay({ open, label = "处理中" }: { open: boolean; label?: string }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center px-6 pointer-events-none">
            <div className="flex w-full max-w-[28rem] flex-col items-center justify-center text-center">
                <AuthAivroMark />
                <div className="mt-5 text-base font-medium text-stone-300">{label}</div>
            </div>
        </div>
    );
}

type AnimeInstance = {
    cancel?: () => void;
    pause?: () => void;
    revert?: () => void;
};

function AuthAivroMark() {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        let animation: AnimeInstance | undefined;
        void import("animejs").then(({ animate, stagger }) => {
            const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-auth-aivro]"));
            animation = animate(targets, {
                opacity: [0.2, 1, 0.72],
                translateY: [10, 0, 0],
                scale: [0.96, 1.04, 1],
                ease: "outCubic",
                duration: 1250,
                delay: stagger(75),
                loop: true,
                loopDelay: 120,
            });
        });

        return () => {
            animation?.revert?.();
            animation?.cancel?.();
            animation?.pause?.();
        };
    }, []);

    return (
        <div ref={rootRef} className="flex items-center justify-center gap-3 text-stone-100 drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)]" aria-label="Aivro">
            {"Aivro".split("").map((letter, index) => (
                <span key={`${letter}-${index}`} data-auth-aivro className="text-6xl font-semibold leading-none tracking-normal">
                    {letter}
                </span>
            ))}
            <span data-auth-aivro className="ml-1 block size-12 bg-current" style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }} />
        </div>
    );
}
