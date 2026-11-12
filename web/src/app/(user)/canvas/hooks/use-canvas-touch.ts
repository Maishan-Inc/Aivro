import { useEffect, useRef, type RefObject } from "react";

import type { ViewportTransform } from "../types";

export function useCanvasTouch({ containerRef, viewport, onViewportChange, onCanvasDeselect, onGestureStart }: {
    containerRef: RefObject<HTMLDivElement | null>;
    viewport: ViewportTransform;
    onViewportChange: (viewport: ViewportTransform) => void;
    onCanvasDeselect?: () => void;
    onGestureStart?: () => void;
}) {
    const latest = useRef({ viewport, onViewportChange, onCanvasDeselect, onGestureStart });
    latest.current = { viewport, onViewportChange, onCanvasDeselect, onGestureStart };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const touchIds = new Set<number>();
        let gesture: { x: number; y: number; distance: number; viewport: ViewportTransform; moved: boolean; background: boolean } | null = null;
        let frame: number | null = null;
        let pending: ViewportTransform | null = null;

        const points = (event: TouchEvent) => Array.from(event.touches).filter((touch) => touchIds.has(touch.identifier)).slice(0, 2);
        const center = (touches: Touch[]) => {
            const rect = container.getBoundingClientRect();
            const x = touches.reduce((sum, touch) => sum + touch.clientX, 0) / touches.length;
            const y = touches.reduce((sum, touch) => sum + touch.clientY, 0) / touches.length;
            return { x: (x - rect.left) * container.clientWidth / rect.width, y: (y - rect.top) * container.clientHeight / rect.height };
        };
        const distance = (touches: Touch[]) => touches.length === 2 ? Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY) : 0;
        const flush = () => {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            if (pending) {
                latest.current.viewport = pending;
                latest.current.onViewportChange(pending);
            }
            pending = null;
        };
        const start = (event: TouchEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest("[data-canvas-no-zoom],[data-canvas-prompt-panel],[data-connection-create-menu],input,textarea,button,a,select,[contenteditable='true'],video,.ant-popover,.ant-dropdown,.ant-select-dropdown")) return;
            Array.from(event.changedTouches).forEach((touch) => touchIds.add(touch.identifier));
            const touches = points(event);
            const background = !target?.closest("[data-node-id],[data-connection-id]");
            gesture = { ...center(touches), distance: distance(touches), viewport: pending || latest.current.viewport, moved: gesture?.moved || touches.length > 1, background };
            if (touches.length > 1) latest.current.onGestureStart?.();
            // Preserve native taps on nodes; cancel scrolling before a canvas drag starts.
            if (background || touches.length > 1) event.preventDefault();
        };
        const move = (event: TouchEvent) => {
            const touches = points(event);
            if (!gesture || !touches.length) return;
            event.preventDefault();
            const point = center(touches);
            const dx = point.x - gesture.x;
            const dy = point.y - gesture.y;
            if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
            if (!gesture.moved) latest.current.onGestureStart?.();
            gesture.moved = true;
            const initial = gesture.viewport;
            const k = gesture.distance ? Math.min(5, Math.max(0.05, initial.k * distance(touches) / gesture.distance)) : initial.k;
            pending = { x: point.x - (gesture.x - initial.x) / initial.k * k, y: point.y - (gesture.y - initial.y) / initial.k * k, k };
            if (frame === null) frame = requestAnimationFrame(flush);
        };
        const end = (event: TouchEvent) => {
            if (gesture?.moved) event.preventDefault();
            Array.from(event.changedTouches).forEach((touch) => touchIds.delete(touch.identifier));
            const touches = points(event);
            flush();
            if (gesture && touches.length) {
                gesture = { ...center(touches), distance: distance(touches), viewport: latest.current.viewport, moved: true, background: false };
            } else {
                if (gesture?.background && !gesture.moved) latest.current.onCanvasDeselect?.();
                gesture = null;
            }
        };
        const cancel = () => {
            touchIds.clear();
            gesture = null;
            flush();
        };

        container.addEventListener("touchstart", start, { passive: false });
        container.addEventListener("touchmove", move, { passive: false });
        container.addEventListener("touchend", end, { passive: false });
        container.addEventListener("touchcancel", cancel);
        window.addEventListener("blur", cancel);
        return () => {
            container.removeEventListener("touchstart", start);
            container.removeEventListener("touchmove", move);
            container.removeEventListener("touchend", end);
            container.removeEventListener("touchcancel", cancel);
            window.removeEventListener("blur", cancel);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [containerRef]);
}
