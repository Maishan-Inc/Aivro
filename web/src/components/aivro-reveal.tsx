"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AivroRevealProps = {
    children: ReactNode;
    className?: string;
    itemSelector?: string;
};

type AnimeInstance = {
    cancel?: () => void;
    pause?: () => void;
    revert?: () => void;
};

export function AivroReveal({ children, className, itemSelector = "[data-aivro-reveal]" }: AivroRevealProps) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        let animation: AnimeInstance | undefined;
        void import("animejs").then(({ animate, stagger }) => {
            const targets = Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
            animation = animate(targets.length ? targets : root, {
                opacity: [0, 1],
                translateY: [18, 0],
                filter: ["blur(8px)", "blur(0px)"],
                ease: "outCubic",
                duration: 640,
                delay: targets.length ? stagger(70) : 0,
            });
        });

        return () => {
            animation?.revert?.();
            animation?.cancel?.();
            animation?.pause?.();
        };
    }, [itemSelector]);

    return (
        <div ref={rootRef} className={cn("aivro-reveal", className)}>
            {children}
        </div>
    );
}
