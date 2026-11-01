"use client";

import { useState, type ReactNode } from "react";
import { Dropdown, Popover } from "antd";
import { History, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import styles from "./studio-layout.module.css";

export function StudioHistorySidebar({ items, activeId, onSelect, onOpenDetail, children }: { items: Array<{ id: string; title: string; prompt: string; preview?: string; video?: string }>; activeId?: string; onSelect: (id: string) => void; onOpenDetail?: (id: string) => void; children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const { tr } = useI18n();
    return <aside className={styles.history} data-collapsed={collapsed}>
        <div className={styles.historyToggle}><button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "展开生成记录" : "收起生成记录"} title={collapsed ? "展开生成记录" : "收起生成记录"}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}</button></div>
        {collapsed ? <div className={styles.historyRail}>{items.map((item) => <Dropdown key={item.id} trigger={["contextMenu"]} disabled={!onOpenDetail} menu={{ items: [{ key: "detail", label: tr("查看详情"), onClick: () => onOpenDetail?.(item.id) }] }}><Popover placement="left" trigger={["hover", "focus"]} title={item.title} content={<div className="w-64 max-w-[65vw]">{item.video ? <video src={item.video} controls muted playsInline preload="none" className="mb-3 max-h-60 w-full rounded-lg" /> : item.preview ? <img src={item.preview} alt={item.title} className="mb-3 max-h-60 w-full rounded-lg object-contain" /> : null}<p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.prompt || "无提示词"}</p></div>}>
            <button type="button" aria-label={item.title} aria-pressed={activeId ? activeId === item.id : undefined} style={activeId === item.id ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 1px var(--foreground)" } : undefined} onClick={() => onSelect(item.id)}>{item.preview ? <img src={item.preview} alt="" /> : <History size={18} />}</button>
        </Popover></Dropdown>)}{!items.length ? <History size={18} className="mx-auto text-muted-foreground" /> : null}</div> : children}
    </aside>;
}
