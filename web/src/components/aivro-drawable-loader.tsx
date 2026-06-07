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
        let animation: { cancel?: () => void; pause?: () => void; revert?: () => void } | undefined;
        let disposed = false;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        void (async () => {
            const { animate, svg, stagger } = await import("animejs");
            if (disposed || !rootRef.current) return;
            const lines = Array.from(rootRef.current.querySelectorAll<SVGPathElement | SVGPolylineElement>(".aivro-loader-line"));
            const drawables = lines.flatMap((line) => svg.createDrawable(line));
            animation = animate(drawables, {
                draw: ["0 0", "0 1", "1 1"],
                ease: "inOutQuad",
                duration: 1200,
                delay: stagger(60),
                loop: true,
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
            ref={rootRef}
            viewBox="0 0 304 112"
            role="img"
            aria-labelledby={titleId}
            className={cn("mx-auto block shrink-0 text-stone-900 dark:text-stone-100", compact ? "h-8 w-24" : "h-24 w-72", className)}
        >
            <title id={titleId}>Aivro</title>
            <g stroke="currentColor" fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" strokeWidth={6}>
                <path className="aivro-loader-line" d="M18 88L45 24L72 88M30 62H60" />
                <path className="aivro-loader-line" d="M100 45V88M98 28H102" />
                <path className="aivro-loader-line" d="M124 45L149 88L174 45" />
                <path className="aivro-loader-line" d="M202 88V46" />
                <path className="aivro-loader-line" d="M202 61C211 48 226 44 238 53" />
                <path className="aivro-loader-line" d="M267 45C283 45 296 58 296 67.5C296 78 283 90 267 90C251 90 238 78 238 67.5C238 58 251 45 267 45Z" />
            </g>
        </svg>
    );
}
