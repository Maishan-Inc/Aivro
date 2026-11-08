"use client";

import { useState, type ReactNode } from "react";
import { Dropdown, Popover } from "antd";
import { History, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import styles from "./studio-layout.module.css";

export function StudioHistorySidebar({ items, activeId, onSelect, selectOnDoubleClick, onOpenDetail, onNew, newDisabled, children }: { items: Array<{ id: string; title: string; prompt: string; preview?: string; video?: string; disabled?: boolean }>; activeId?: string; onSelect: (id: string) => void; selectOnDoubleClick?: boolean; onOpenDetail?: (id: string) => void; onNew?: () => void; newDisabled?: boolean; children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const { tr } = useI18n();
    return <aside className={styles.history} data-collapsed={collapsed}>
        {collapsed && onNew ? <div className={styles.historyToggle}><button type="button" disabled={newDisabled} className="disabled:opacity-40" onClick={onNew} aria-label={tr("新建任务")} title={tr("新建任务")}><Plus size={18} /></button></div> : null}
        <div className={styles.historyToggle}>{!collapsed ? <h2 className="text-base font-semibold">{tr("生成记录")}</h2> : null}<button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={tr(collapsed ? "展开生成记录" : "收起生成记录")} title={tr(collapsed ? "展开生成记录" : "收起生成记录")}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}</button></div>
        {collapsed ? <div className={styles.historyRail}>{items.map((item) => <Dropdown key={item.id} trigger={["contextMenu"]} disabled={!onOpenDetail} menu={{ items: [{ key: "detail", label: tr("查看详情"), onClick: () => onOpenDetail?.(item.id) }] }}><Popover placement="left" trigger={["hover", "focus"]} title={<span data-i18n-skip>{item.title}</span>} content={<div className="w-64 max-w-[65vw]" data-i18n-skip>{item.video ? <video src={item.video} controls muted playsInline preload="none" className="mb-3 max-h-60 w-full rounded-lg" /> : item.preview ? <img src={item.preview} alt={item.title} className="mb-3 max-h-60 w-full rounded-lg object-contain" /> : null}<p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.prompt || tr("无提示词")}</p></div>}>
            <button type="button" data-i18n-skip aria-disabled={item.disabled || undefined} aria-label={item.title} title={selectOnDoubleClick && !item.disabled ? tr("双击查看提示词") : undefined} aria-pressed={activeId ? activeId === item.id : undefined} style={activeId === item.id ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 1px var(--foreground)" } : undefined}
                onClick={selectOnDoubleClick || item.disabled ? undefined : () => onSelect(item.id)} onDoubleClick={selectOnDoubleClick && !item.disabled ? () => onSelect(item.id) : undefined}
                onKeyDown={(event) => { if (selectOnDoubleClick && !item.disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(item.id); } }}>{item.preview ? <img src={item.preview} alt="" /> : <History size={18} />}</button>
        </Popover></Dropdown>)}{!items.length ? <History size={18} className="mx-auto text-muted-foreground" /> : null}</div> : children}
    </aside>;
}
