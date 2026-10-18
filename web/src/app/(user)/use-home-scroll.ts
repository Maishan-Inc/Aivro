"use client";

import { useEffect, useRef } from "react";
import type Lenis from "lenis";

export function useHomeScroll(paused: boolean) {
    const rootRef = useRef<HTMLElement>(null);
    useEffect(() => {
        const root = rootRef.current;
        const content = root?.querySelector<HTMLElement>("[data-home-content]");
        const wordmark = root?.querySelector<SVGSVGElement>("[data-wordmark]");
        const trace = wordmark?.querySelector<SVGTextElement>("[data-wordmark-trace]");
        if (!root || !content || !wordmark || !trace) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        let lenis: Lenis | undefined;
        let disposed = false;
        let frame = 0;
        let motionVersion = 0;
        const length = 2600;
        const update = () => {
            frame = 0;
            root.style.setProperty("--hero-height", `${root.clientHeight}px`);
            const rect = wordmark.getBoundingClientRect();
            const start = root.scrollTop + rect.top - root.getBoundingClientRect().top - root.clientHeight;
            const end = root.scrollHeight - root.clientHeight;
            const progress = root.scrollTop >= end - 1 ? 1 : Math.max(0, Math.min(1, (root.scrollTop - start) / Math.max(1, end - start)));
            trace.style.strokeDashoffset = `${length * (1 - (reduced.matches || paused ? 1 : progress))}`;
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
        const syncMotion = () => {
            const version = ++motionVersion;
            lenis?.destroy();
            lenis = undefined;
            root.removeAttribute("data-smooth");
            if (!reduced.matches && !paused) void import("lenis").then(({ default: Lenis }) => {
                if (disposed || reduced.matches || version !== motionVersion) return;
                root.setAttribute("data-smooth", "true");
                lenis = new Lenis({ wrapper: root, content, lerp: 0.065, smoothWheel: true, autoRaf: true, anchors: true, prevent: (node) => node.hasAttribute("data-native-scroll") });
            });
            update();
        };
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            if (entry.isIntersecting) { entry.target.setAttribute("data-visible", "true"); observer.unobserve(entry.target); }
        }), { root, threshold: 0.08 });
        root.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
        const resize = new ResizeObserver(onScroll);
        resize.observe(content);
        resize.observe(root);
        root.addEventListener("scroll", onScroll, { passive: true });
        reduced.addEventListener("change", syncMotion);
        syncMotion();
        void document.fonts.ready.then(() => { if (!disposed) onScroll(); });
        return () => { disposed = true; lenis?.destroy(); root.removeAttribute("data-smooth"); observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); root.removeEventListener("scroll", onScroll); reduced.removeEventListener("change", syncMotion); };
    }, [paused]);
    return rootRef;
}
