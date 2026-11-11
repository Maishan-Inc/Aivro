"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

const popupSelector = ".ant-select-dropdown, .ant-dropdown, .ant-popover, .ant-modal, .ant-drawer";

export function usePromptComposer(running: boolean, initiallyExpanded = false) {
    const ref = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(initiallyExpanded && !running);
    const [previousRunning, setPreviousRunning] = useState(running);
    if (previousRunning !== running) {
        setPreviousRunning(running);
        if (running) setExpanded(false);
    }
    const open = useCallback(() => setExpanded(true), []);
    const close = useCallback(() => {
        if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
        setExpanded(false);
    }, []);
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
