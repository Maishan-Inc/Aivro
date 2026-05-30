"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

type AivroDrawableLoaderProps = {
    className?: string;
    compact?: boolean;
};

export function AivroDrawableLoader({ className, compact = false }: AivroDrawableLoaderProps) {
    const rootRef = useRef<SVGSVGElement>(null);
    const titleId = useId();

    useEffect(() => {
        let animation: { cancel?: () => void; pause?: () => void } | undefined;
        let disposed = false;

        void (async () => {
            const { animate, svg, stagger } = await import("animejs");
            if (disposed || !rootRef.current) return;
            const lines = Array.from(rootRef.current.querySelectorAll<SVGPathElement | SVGPolylineElement>(".aivro-loader-line"));
            const drawables = lines.flatMap((line) => svg.createDrawable(line));
            animation = animate(drawables, {
                draw: ["0 0", "0 1", "1 1"],
                ease: "inOutQuad",
                duration: 2000,
                delay: stagger(90),
                loop: true,
            });
        })();

        return () => {
            disposed = true;
            animation?.cancel?.();
            animation?.pause?.();
        };
    }, []);

    return (
        <svg
            ref={rootRef}
            viewBox="0 0 230 80"
            role="img"
            aria-labelledby={titleId}
            className={cn("block text-stone-900 dark:text-stone-100", compact ? "h-6 w-20" : "h-20 w-56", className)}
        >
            <title id={titleId}>Aivro 加载中</title>
            <g stroke="currentColor" fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" strokeWidth={compact ? 5 : 4}>
                <polyline className="aivro-loader-line" points="18 64 35 16 52 64" />
                <path className="aivro-loader-line" d="M24 49h22" />
                <path className="aivro-loader-line" d="M72 34v30" />
                <path className="aivro-loader-line" d="M72 19.5a2.5 2.5 0 1 1-.01 0" />
                <polyline className="aivro-loader-line" points="92 34 107 64 122 34" />
                <path className="aivro-loader-line" d="M145 64V34" />
                <path className="aivro-loader-line" d="M145 39c6.5-7 16.5-7 24-1.5" />
                <path className="aivro-loader-line" d="M207 49a17 17 0 1 1-34 0 17 17 0 0 1 34 0z" />
            </g>
        </svg>
    );
}
