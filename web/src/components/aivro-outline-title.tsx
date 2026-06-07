"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

type AivroOutlineTitleProps = {
    label?: string;
    className?: string;
};

type AnimeInstance = {
    cancel?: () => void;
    pause?: () => void;
    revert?: () => void;
};

export function AivroOutlineTitle({ label = "Aivro", className }: AivroOutlineTitleProps) {
    const traceRef = useRef<SVGTextElement>(null);
    const titleId = useId();

    useEffect(() => {
        const trace = traceRef.current;
        if (!trace || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const length = Math.ceil(trace.getComputedTextLength() * 2.35);
        trace.style.strokeDasharray = `${length}`;
        trace.style.strokeDashoffset = `${length}`;
        trace.style.opacity = "1";

        let animation: AnimeInstance | undefined;
        void import("animejs").then(({ animate }) => {
            animation = animate(trace, {
                strokeDashoffset: [length, 0],
                ease: "inOutQuad",
                duration: 2600,
                alternate: true,
                loop: true,
                loopDelay: 900,
            });
        });

        return () => {
            animation?.revert?.();
            animation?.cancel?.();
            animation?.pause?.();
        };
    }, []);

    return (
        <span className={cn("aivro-outline-title", className)} aria-label={label}>
            <svg viewBox="0 0 620 180" role="img" aria-labelledby={titleId} focusable="false">
                <title id={titleId}>{label}</title>
                <text className="aivro-outline-title-base" x="28" y="128">
                    {label}
                </text>
                <text ref={traceRef} className="aivro-outline-title-trace" x="28" y="128" aria-hidden="true">
                    {label}
                </text>
            </svg>
        </span>
    );
}
