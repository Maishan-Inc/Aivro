"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

type AivroDrawableLoaderProps = {
    className?: string;
    compact?: boolean;
    style?: CSSProperties;
};

export function AivroDrawableLoader({ className, compact = false, style }: AivroDrawableLoaderProps) {
    const traceRef = useRef<SVGTextElement>(null);
    const titleId = useId();

    useEffect(() => {
        let animation: { cancel?: () => void; pause?: () => void; revert?: () => void } | undefined;
        const trace = traceRef.current;
        if (!trace || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const length = Math.ceil(trace.getComputedTextLength() * 2.35);
        trace.style.strokeDasharray = `${length}`;
        trace.style.strokeDashoffset = `${length}`;
        trace.style.opacity = "1";

        let disposed = false;

        void (async () => {
            const { animate } = await import("animejs");
            if (disposed) return;
            animation = animate(trace, {
                strokeDashoffset: [length, 0],
                ease: "inOutQuad",
                duration: 2600,
                alternate: true,
                loop: true,
                loopDelay: 900,
            });
        })();

        return () => {
            disposed = true;
            animation?.revert?.();
            animation?.cancel?.();
            animation?.pause?.();
        };
    }, []);

    return (
        <svg
            viewBox="0 0 398 180"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-labelledby={titleId}
            className={cn("mx-auto block shrink-0 text-stone-900 dark:text-stone-100", compact ? "h-8 w-24" : "h-24 w-72", className)}
            style={{ overflow: "visible", ...style }}
        >
            <title id={titleId}>Aivro</title>
            <text className="aivro-outline-title-base" x="28" y="128">
                Aivro
            </text>
            <text ref={traceRef} className="aivro-outline-title-trace" x="28" y="128" aria-hidden="true">
                Aivro
            </text>
        </svg>
    );
}
