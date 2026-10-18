"use client";

import { useEffect, useRef } from "react";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

export function useHomeScroll(paused: boolean) {
    const rootRef = useRef<HTMLElement>(null);
    const pausedRef = useRef(paused);
    const animationsRef = useRef<Array<{ paused: (value: boolean) => unknown }>>([]);
    const snapRef = useRef<ScrollTrigger | null>(null);
    const drawnRef = useRef(false);

    useEffect(() => {
        pausedRef.current = paused;
        animationsRef.current.forEach((animation) => animation.paused(paused));
        if (paused) snapRef.current?.disable();
        else snapRef.current?.enable();
    }, [paused]);

    useEffect(() => {
        const root = rootRef.current;
        const content = root?.querySelector<HTMLElement>("[data-home-content]");
        if (!root || !content) return;
        let disposed = false;
        let cleanup: (() => void) | undefined;
        const measure = () => root.style.setProperty("--hero-height", `${root.clientHeight}px`);
        measure();

        void Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/ScrollToPlugin"), import("gsap/DrawSVGPlugin")]).then(([{ gsap }, { ScrollTrigger }, { ScrollToPlugin }, { DrawSVGPlugin }]) => {
            if (disposed) return;
            gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, DrawSVGPlugin);
            const traces = root.querySelectorAll("[data-wordmark-trace]");
            const media = gsap.matchMedia();
            let anchorTween: ReturnType<typeof gsap.to> | undefined;
            const context = gsap.context(() => {
                media.add({ motion: "(prefers-reduced-motion: no-preference)", reduced: "(prefers-reduced-motion: reduce)" }, ({ conditions }) => {
                    animationsRef.current = [];
                    if (conditions?.reduced) {
                        gsap.set(traces, { autoAlpha: 1, drawSVG: "100%" });
                        return;
                    }
                    root.querySelectorAll("[data-reveal]").forEach((section) => {
                        const reveal = gsap.fromTo(section, { opacity: .45, y: 30 }, { opacity: 1, y: 0, duration: .9, ease: "power3.out", paused: true });
                        ScrollTrigger.create({ scroller: root, trigger: section, start: "top 90%", once: true, onEnter: () => {
                            animationsRef.current.push(reveal);
                            if (pausedRef.current) reveal.progress(1);
                            else reveal.play();
                        } });
                    });
                    gsap.set(traces, { autoAlpha: 1, drawSVG: drawnRef.current ? "100%" : "0%" });
                    if (!drawnRef.current) {
                        const drawing = gsap.to(traces, { drawSVG: "100%", duration: 1.8, stagger: .15, ease: "power2.inOut", paused: true, onComplete: () => { drawnRef.current = true; } });
                        ScrollTrigger.create({ scroller: root, trigger: root.querySelector("[data-wordmark]"), start: "top 92%", once: true, onEnter: () => {
                            animationsRef.current.push(drawing);
                            if (pausedRef.current) drawing.progress(1);
                            else drawing.play();
                        } });
                    }
                    let stops: number[] = [];
                    const updateStops = () => {
                        const max = root.scrollHeight - root.clientHeight;
                        stops = [0, 1, ...Array.from(content.querySelectorAll<HTMLElement>(":scope > section, :scope > footer, #platform")).map((section) => Math.max(0, Math.min(1, (section.offsetTop + content.offsetTop) / Math.max(1, max))))];
                    };
                    updateStops();
                    const snap = ScrollTrigger.create({
                        scroller: root, trigger: content, start: "top top", end: "bottom bottom", onRefresh: updateStops,
                        snap: { snapTo: (value: number) => {
                            const nearest = stops.reduce((result, stop) => Math.abs(stop - value) < Math.abs(result - value) ? stop : result, stops[0]);
                            return Math.abs(nearest - value) * (root.scrollHeight - root.clientHeight) < 56 ? nearest : value;
                        }, inertia: false, delay: .18, duration: { min: .12, max: .32 }, ease: "power2.out" },
                    });
                    snapRef.current = snap;
                    if (pausedRef.current) snap.disable();
                    return () => { snapRef.current = null; animationsRef.current = []; };
                });
            }, root);
            const onAnchor = (event: MouseEvent) => {
                const link = (event.target as Element).closest<HTMLAnchorElement>("a[href^='#']");
                const href = link?.getAttribute("href");
                if (!href || href === "#" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || pausedRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                const target = href === "#top" ? root : root.querySelector(href);
                if (!target) return;
                event.preventDefault();
                anchorTween?.kill();
                anchorTween = gsap.to(root, { scrollTo: { y: href === "#top" ? 0 : target, offsetY: 24, autoKill: true }, duration: .85, ease: "power2.inOut" });
                window.history.replaceState(window.history.state, "", href);
            };
            const stopSnap = () => snapRef.current?.getTween(true)?.kill();
            let frame = 0;
            const resize = new ResizeObserver(() => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => { measure(); ScrollTrigger.refresh(); });
            });
            resize.observe(root);
            resize.observe(content);
            root.addEventListener("click", onAnchor);
            root.addEventListener("pointerdown", stopSnap, { passive: true });
            void document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
            cleanup = () => { cancelAnimationFrame(frame); resize.disconnect(); anchorTween?.kill(); media.revert(); context.revert(); root.removeEventListener("click", onAnchor); root.removeEventListener("pointerdown", stopSnap); };
        });

        return () => { disposed = true; cleanup?.(); };
    }, []);
    return rootRef;
}
