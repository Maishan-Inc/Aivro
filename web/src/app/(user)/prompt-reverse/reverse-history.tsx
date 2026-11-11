"use client";

import { useState } from "react";
import { App, Button, Checkbox, Drawer, Empty, Popconfirm } from "antd";
import { CheckSquare, History, Plus, Trash2 } from "lucide-react";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { useGenerationRetention } from "@/hooks/use-generation-retention";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";
import { deleteGenerationHistory } from "@/services/api/generation-history";
import { formatDateTime } from "@/lib/datetime";
import { reverseRunning, type ReverseRecord } from "./use-reverse-records";
import studio from "@/components/studio-layout.module.css";

export function ReverseHistory({ records, activeId, onSelect, onNew, refresh }: { records: ReverseRecord[]; activeId?: string; onSelect: (id: string) => void; onNew: () => void; refresh: () => Promise<void> }) {
    const { tr } = useI18n();
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const retention = useGenerationRetention();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [removing, setRemoving] = useState(false);
    const deletable = records.filter((record) => record.history);
    const select = (id: string) => { onSelect(id); setOpen(false); };
    const create = () => { onNew(); setOpen(false); };
    const remove = async (ids: string[]) => {
        setRemoving(true);
        const results = await Promise.allSettled(ids.map((id) => deleteGenerationHistory(token, id)));
        setSelected((previous) => previous.filter((id) => !ids.some((removed, index) => removed === id && results[index].status === "fulfilled")));
        if (results.some((result) => result.status === "rejected")) message.error(tr("删除失败"));
        await refresh(); setRemoving(false);
    };
    const content = <>
        <p className={studio.historyRetention} data-i18n-skip>{tr("新记录保存 {0} 天").replace("{0}", String(retention.data?.days["prompt-reverse"] ?? "—"))}</p>
        <div className={studio.historyControls}><div className={studio.historyButtons}>
            <Button size="small" icon={<Plus size={14} />} onClick={create}>{tr("新建")}</Button>
            <Button size="small" icon={<CheckSquare size={14} />} onClick={() => setSelected(selected.length === deletable.length ? [] : deletable.map((record) => record.id))}>{tr(selected.length && selected.length === deletable.length ? "取消" : "全选")}</Button>
            <Popconfirm title={tr("删除选中")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove(selected)}><Button size="small" danger icon={<Trash2 size={14} />} disabled={!selected.length} loading={removing}>{tr("删除")}</Button></Popconfirm>
        </div><span className="text-xs text-muted-foreground">{records.length}</span></div>
        <div className="space-y-3">{records.map((record) => <article key={record.id} className={`rounded-xl border p-3 ${activeId === record.id ? "border-foreground bg-muted" : "border-border"}`}>
            <div className="mb-2 flex items-center gap-2"><Checkbox aria-label={tr("选择生成记录")} disabled={!record.history || removing} checked={selected.includes(record.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, record.id] : ids.filter((id) => id !== record.id))} /><span className="truncate text-xs" data-i18n-skip>{record.model}</span></div>
            <button type="button" onClick={() => select(record.id)} className="block w-full text-left" aria-label={tr("查看详情")} aria-pressed={activeId === record.id}>
                <div className="grid grid-cols-3 gap-1.5">{record.items.map((item, index) => <div key={index} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                    {item.media?.url ? <img src={item.media.url} alt="" className="size-full object-cover" /> : null}
                    {reverseRunning(record.status) && reverseRunning(item.status) ? <div className="absolute inset-0 grid place-items-center bg-background/70"><AivroDrawableLoader compact className="w-10" /></div> : null}
                </div>)}</div>
                <p className="mt-2 text-xs text-muted-foreground" data-i18n-skip>{reverseRunning(record.status) ? `${tr(record.status === "submitting" ? "提交中" : record.status === "queued" ? "排队中" : "正在反推")} · ${record.items.filter((item) => !reverseRunning(item.status)).length}/${record.items.length}` : tr(record.status === "succeeded" ? "反推完成" : "反推失败")}</p>
            </button>
            {record.error ? <p className="mt-2 break-words text-xs text-destructive">{tr(record.error)}</p> : null}
            {record.history ? <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(record.history.expiresAt))}</span><Popconfirm title={tr("删除这条记录？")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove([record.id])}><Button type="text" size="small" disabled={removing} icon={<Trash2 size={12} />} aria-label={tr("删除")} /></Popconfirm></div> : null}
        </article>)}{!records.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr("暂无记录")} /> : null}</div>
    </>;
    return <>
        <div className={`${studio.historyActions} absolute right-3 top-5 z-10`}><Button type="text" icon={<History size={16} />} onClick={() => setOpen(true)}>{tr("生成记录")}</Button></div>
        <StudioHistorySidebar items={records.map((record) => ({ id: record.id, title: record.model, prompt: tr(reverseRunning(record.status) ? "正在反推" : record.status === "succeeded" ? "反推完成" : "反推失败"), preview: record.items[0]?.media?.url }))} activeId={activeId} onSelect={select} onNew={create}>{content}</StudioHistorySidebar>
        <Drawer title={tr("生成记录")} open={open} onClose={() => setOpen(false)} size="min(360px, 100vw)">{content}</Drawer>
    </>;
}
