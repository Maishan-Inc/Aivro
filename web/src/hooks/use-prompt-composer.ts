"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from "react";

const popupSelector = ".ant-select-dropdown, .ant-dropdown, .ant-popover, .ant-modal, .ant-drawer";

export function usePromptComposer(running: boolean, initiallyExpanded = false) {
    const ref = useRef<HTMLDivElement>(null);
    const collapseHeight = useRef<number | null>(null);
    const [expanded, setExpanded] = useState(initiallyExpanded && !running);
    const [previousRunning, setPreviousRunning] = useState(running);
    if (previousRunning !== running) {
        setPreviousRunning(running);
        if (running) setExpanded(false);
    }
    const open = useCallback(() => setExpanded(true), []);
    const close = useCallback(() => {
        collapseHeight.current = ref.current?.offsetHeight ?? null;
        if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
        setExpanded(false);
    }, []);
    useLayoutEffect(() => {
        if (expanded || collapseHeight.current === null || !ref.current) return;
        const element = ref.current;
        const from = collapseHeight.current;
        const to = element.offsetHeight;
        collapseHeight.current = null;
        if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const animation = element.animate([
            { height: `${from}px`, overflow: "hidden" },
            { height: `${to}px`, overflow: "hidden" },
        ], { duration: Math.min(360, 200 + Math.abs(from - to) / 2), easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
        return () => animation.cancel();
    }, [expanded]);
    useEffect(() => {
        if (!expanded) return;
        const outside = (event: PointerEvent) => {
            const target = event.target as Element;
            if (!ref.current?.contains(target) && !target.closest(popupSelector)) close();
        };
        document.addEventListener("pointerdown", outside, true);
        return () => document.removeEventListener("pointerdown", outside, true);
    }, [expanded, close]);
    const onBlur = (event: FocusEvent<HTMLDivElement>) => {
        const target = event.relatedTarget as Element | null;
        if (target && !event.currentTarget.contains(target) && !target.closest(popupSelector)) close();
    };
    return { ref, expanded, open, close, onBlur };
}
