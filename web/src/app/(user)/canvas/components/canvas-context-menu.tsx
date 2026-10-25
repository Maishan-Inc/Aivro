"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ConfigProvider, Menu, type MenuProps, type MenuRef } from "antd";
import { canvasThemes } from "@/lib/canvas-theme";
import { useI18n } from "@/hooks/use-i18n";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ContextMenuState } from "../types";

export function CanvasContextMenu({ menu, items, onClose }: { menu: ContextMenuState; items: MenuProps["items"]; onClose: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<MenuRef>(null);

    useLayoutEffect(() => {
        const container = containerRef.current!;
        const rect = container.getBoundingClientRect();
        container.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))}px`;
        container.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))}px`;
        const previousFocus = document.activeElement;
        menuRef.current?.focus();
        const closeOutside = (event: PointerEvent) => { if (!container.contains(event.target as Node)) onClose(); };
        window.addEventListener("pointerdown", closeOutside);
        window.addEventListener("resize", onClose);
        return () => {
            window.removeEventListener("pointerdown", closeOutside);
            window.removeEventListener("resize", onClose);
            if (container.contains(document.activeElement) && previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
        };
    }, [menu.x, menu.y, onClose]);

    return createPortal(<div
        ref={containerRef}
        className="thin-scrollbar fixed z-[1200] w-72 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border p-1 shadow-2xl"
        style={{ left: menu.x, top: menu.y, maxHeight: "calc(100dvh - 16px)", background: theme.node.panel, borderColor: theme.toolbar.border }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); onClose(); }
        }}
    >
        <ConfigProvider theme={{ components: { Menu: { itemBg: theme.node.panel, itemColor: theme.node.text, itemHoverBg: theme.toolbar.itemHover, itemHoverColor: theme.node.text, itemHeight: 36 } } }}>
            <Menu ref={menuRef} aria-label={tr("画布右键菜单")} selectable={false} items={items} onClick={onClose} style={{ border: 0, background: theme.node.panel }} />
        </ConfigProvider>
    </div>, document.body);
}
