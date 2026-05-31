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
                delay: stagger(100),
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
            viewBox="0 0 304 112"
            role="img"
            aria-labelledby={titleId}
            className={cn("block text-stone-900 dark:text-stone-100", compact ? "h-8 w-24" : "h-24 w-72", className)}
        >
            <title id={titleId}>Aivro</title>
            <g stroke="currentColor" fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                <path className="aivro-loader-line" d="M59 90V56.136C58.66 46.48 51.225 39 42 39c-9.389 0-17 7.611-17 17s7.611 17 17 17h8.5v17H42C23.222 90 8 74.778 8 56s15.222-34 34-34c18.61 0 33.433 14.994 34 33.875V90H59z" />
                <polyline className="aivro-loader-line" points="59 22.035 59 90 76 90 76 22 59 22" />
                <path className="aivro-loader-line" d="M59 90V55.74C59.567 36.993 74.39 22 93 22c18.778 0 34 15.222 34 34v34h-17V56c0-9.389-7.611-17-17-17-9.225 0-16.66 7.48-17 17.136V90H59z" />
                <polyline className="aivro-loader-line" points="127 22.055 127 90 144 90 144 22 127 22" />
                <path className="aivro-loader-line" d="M127 90V55.74C127.567 36.993 142.39 22 161 22c18.778 0 34 15.222 34 34v34h-17V56c0-9.389-7.611-17-17-17-9.225 0-16.66 7.48-17 17.136V90h-17z" />
                <path className="aivro-loader-line" d="M118.5 22a8.5 8.5 0 1 1-8.477 9.067v-1.134c.283-4.42 3.966-7.933 8.477-7.933z" />
                <path className="aivro-loader-line" d="M144 73c-9.389 0-17-7.611-17-17v-8.5h-17V56c0 18.778 15.222 34 34 34V73z" />
                <path className="aivro-loader-line" d="M178 90V55.74C178.567 36.993 193.39 22 212 22c18.778 0 34 15.222 34 34v34h-17V56c0-9.389-7.611-17-17-17-9.225 0-16.66 7.48-17 17.136V90h-17z" />
                <path className="aivro-loader-line" d="M263 73c-9.389 0-17-7.611-17-17s7.611-17 17-17c9.18 0 16.58 7.4 17 17h-17v17h34V55.875C296.433 36.994 281.61 22 263 22c-18.778 0-34 15.222-34 34s15.222 34 34 34V73z" />
                <path className="aivro-loader-line" d="M288.477 73A8.5 8.5 0 1 1 280 82.067v-1.134c.295-4.42 3.967-7.933 8.477-7.933z" />
            </g>
        </svg>
    );
}
