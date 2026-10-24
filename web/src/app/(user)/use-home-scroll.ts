"use client";

import { useEffect, useRef } from "react";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

export function useHomeScroll() {
    const rootRef = useRef<HTMLElement>(null);

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
            let snap: ScrollTrigger | undefined;
            const context = gsap.context(() => {
                root.querySelectorAll("[data-reveal]").forEach((section) => {
                    gsap.fromTo(section, { opacity: .45, y: 30 }, { opacity: 1, y: 0, duration: .9, ease: "power3.out", scrollTrigger: { scroller: root, trigger: section, start: "top 90%", once: true } });
                });
                gsap.timeline({ repeat: -1, repeatDelay: .6 })
                    .fromTo(traces, { autoAlpha: 1, drawSVG: "0%" }, { drawSVG: "100%", duration: 2, stagger: .12, ease: "power2.inOut" })
                    .to(traces, { drawSVG: "0%", duration: 1, stagger: .08, ease: "power2.inOut" }, "+=1.4");
                media.add("(min-width: 1401px) and (pointer: fine)", () => {
                    let stops: number[] = [];
                    const updateStops = () => {
                        const max = root.scrollHeight - root.clientHeight;
                        stops = [0, 1, ...Array.from(content.querySelectorAll<HTMLElement>(":scope > section, :scope > footer")).map((section) => Math.max(0, Math.min(1, (section.offsetTop + content.offsetTop) / Math.max(1, max))))];
                    };
                    updateStops();
                    snap = ScrollTrigger.create({
                        scroller: root, trigger: content, start: "top top", end: "bottom bottom", onRefresh: updateStops,
                        snap: { snapTo: (value: number) => {
                            const nearest = stops.reduce((result, stop) => Math.abs(stop - value) < Math.abs(result - value) ? stop : result, stops[0]);
                            return Math.abs(nearest - value) * (root.scrollHeight - root.clientHeight) < 56 ? nearest : value;
                        }, inertia: false, delay: .18, duration: { min: .12, max: .32 }, ease: "power2.out" },
                    });
                    return () => { snap = undefined; };
                });
            }, root);
            const onAnchor = (event: MouseEvent) => {
                const link = (event.target as Element).closest<HTMLAnchorElement>("a[href^='#']");
                const href = link?.getAttribute("href");
                if (!href || href === "#" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
                const target = href === "#top" ? root : root.querySelector(href);
                if (!target) return;
                event.preventDefault();
                anchorTween?.kill();
                anchorTween = gsap.to(root, { scrollTo: { y: href === "#top" ? 0 : target, offsetY: 88, autoKill: true }, duration: .85, ease: "power2.inOut" });
                window.history.replaceState(window.history.state, "", href);
            };
            const stopSnap = () => snap?.getTween(true)?.kill();
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
