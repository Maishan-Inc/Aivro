"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Drawer, Empty, Popconfirm, Tag } from "antd";
import { CheckSquare, History, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import { fetchGenerationHistories, deleteGenerationHistory, type GenerationHistory } from "@/services/api/generation-history";
import { useGenerationRetention } from "@/hooks/use-generation-retention";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import studio from "@/components/studio-layout.module.css";

type PendingTask = { id: string; name: string; image: string; status: "running" | "error"; error?: string };
type HistoryRecord = { id: string; title: string; prompt: string; preview?: string; status: "running" | "success" | "error"; error?: string; history?: GenerationHistory };

export function ExploreHistory({ type, activeId, onSelect, onNew, newDisabled, pendingTasks = [] }: { type: "free-image" | "prompt-reverse"; activeId?: string; onSelect: (item: GenerationHistory | null) => void; onNew?: () => void; newDisabled?: boolean; pendingTasks?: PendingTask[] }) {
    const token = useUserStore((state) => state.token);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const [open, setOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    useEffect(() => setSelectedIds([]), [token, type]);
    const retention = useGenerationRetention();
    const client = useQueryClient();
    const query = useQuery({ queryKey: ["explore-history", type, token], queryFn: () => fetchGenerationHistories(token, { type, pageSize: 100 }), enabled: Boolean(token), refetchInterval: 30000 });
    const remove = useMutation({ mutationFn: (ids: string[]) => Promise.allSettled(ids.map((id) => deleteGenerationHistory(token, id))), onSuccess: (results, ids) => {
        const removed = ids.filter((_, index) => results[index].status === "fulfilled");
        if (activeId && removed.includes(activeId)) onSelect(null);
        setSelectedIds((selected) => selected.filter((id) => !removed.includes(id)));
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") message.error(tr(failed.reason instanceof Error ? failed.reason.message : "删除失败"));
    }, onError: (error) => message.error(tr(error.message)), onSettled: () => client.invalidateQueries({ queryKey: ["explore-history", type, token] }) });
    const items = query.data?.items || [];
    const records: HistoryRecord[] = [
        ...pendingTasks.map((task) => ({ id: task.id, title: task.name, prompt: "", preview: task.image, status: task.status, error: task.error })),
        ...items.map((item): HistoryRecord => ({ id: item.id, title: item.title, prompt: item.prompt, preview: item.media[0]?.url, status: item.status === "失败" ? "error" : "success", error: item.error, history: item })),
    ];
    const selected = items.filter((item) => selectedIds.includes(item.id)).map((item) => item.id);
    const allSelected = Boolean(items.length) && selected.length === items.length;
    const create = () => { onNew?.(); setOpen(false); };
    const content = <>
        <p data-i18n-skip className={studio.historyRetention}>{tr("新记录保存 {0} 天").replace("{0}", String(retention.data?.days[type] ?? "—"))}</p>
        <div className={studio.historyControls}>
            <div className={studio.historyButtons}>
                {onNew ? <Button size="small" icon={<Plus size={14} />} disabled={newDisabled} onClick={create}>{tr("新建")}</Button> : null}
                <Button size="small" icon={<CheckSquare size={14} />} disabled={!items.length || remove.isPending} onClick={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))}>{tr(allSelected ? "取消" : "全选")}</Button>
                <Popconfirm title={tr("删除选中")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove.mutateAsync(selected)}><Button size="small" danger icon={<Trash2 size={14} />} disabled={!selected.length} loading={remove.isPending}>{tr("删除")}</Button></Popconfirm>
            </div>
            <Tag>{records.length}</Tag>
        </div>
        <div className="space-y-3">
            {query.isError ? <p className="text-xs text-muted-foreground">{tr(query.error.message)}</p> : null}
            {!records.length ? <Empty description={tr("暂无记录")} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : type === "prompt-reverse" ? records.map((record) => <div key={record.id} className={`rounded-lg border p-2 transition ${record.id === activeId ? "border-foreground bg-muted" : "border-border bg-background hover:bg-muted"}`}>
                <div className="flex items-start gap-2">
                    <Checkbox aria-label={tr("选择生成记录")} checked={selected.includes(record.id)} disabled={!record.history || remove.isPending} onChange={(event) => setSelectedIds(event.target.checked ? [...selected, record.id] : selected.filter((id) => id !== record.id))} />
                    <button type="button" className="flex min-w-0 flex-1 cursor-zoom-in items-start gap-2 text-left disabled:cursor-default" disabled={!record.history}
                        onDoubleClick={() => { onSelect(record.history!); setOpen(false); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(record.history!); setOpen(false); } }}
                        aria-label={tr(record.status === "running" ? "正在反推" : record.status === "error" ? "反推失败" : "双击查看提示词")} aria-pressed={record.id === activeId} title={record.history ? tr("双击查看提示词") : undefined}>
                        {record.preview ? <img src={record.preview} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : null}
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium" title={record.title} data-i18n-skip>{record.title}</p>
                            {record.status === "success" ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" data-i18n-skip>{record.prompt}</p> : <p className={`mt-1 flex items-center gap-1.5 text-xs ${record.status === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">{record.status === "running" ? <LoaderCircle size={12} className="shrink-0 animate-spin" /> : null}{tr(record.status === "running" ? "正在反推" : "反推失败")}</p>}
                        </div>
                    </button>
                </div>
                {record.error ? <p className="mt-2 break-words text-xs text-destructive" role="alert">{tr(record.error)}</p> : null}
                {record.history ? <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(record.history.expiresAt))}</span>
                    <Popconfirm title={tr("删除这条记录？")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove.mutateAsync([record.id])}><Button type="text" size="small" icon={<Trash2 size={12} />} aria-label={tr("删除")} disabled={remove.isPending} loading={remove.isPending && Boolean(remove.variables?.includes(record.id))} /></Popconfirm>
                </div> : null}
            </div>) : items.map((item) => <div key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                    <Checkbox aria-label={tr("选择生成记录")} checked={selected.includes(item.id)} disabled={remove.isPending} onChange={(event) => setSelectedIds(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
                    <button data-i18n-skip type="button" className="min-w-0 flex-1 text-left" onClick={() => { onSelect(item); setOpen(false); }} aria-pressed={item.id === activeId}>
                        {item.media[0]?.url ? <img src={item.media[0].url} alt={item.title} className="mb-2 max-h-36 w-full rounded-lg object-contain" /> : null}
                        <p className="truncate text-xs font-medium" data-i18n-skip>{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" data-i18n-skip>{item.prompt}</p>
                    </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(item.expiresAt))}</span>
                    <Popconfirm title={tr("删除这条记录？")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove.mutateAsync([item.id])}><Button type="text" size="small" icon={<Trash2 size={12} />} aria-label={tr("删除")} disabled={remove.isPending} loading={remove.isPending && Boolean(remove.variables?.includes(item.id))} /></Popconfirm>
                </div>
            </div>)}
        </div>
    </>;
    return <>
        <div className={`${studio.historyActions} absolute right-4 top-6 z-10`}><Button type="text" icon={<History size={16} />} onClick={() => setOpen(true)}>{tr("生成记录")}</Button></div>
        <StudioHistorySidebar onNew={onNew ? create : undefined} newDisabled={newDisabled} selectOnDoubleClick={type === "prompt-reverse"} items={records.map((record) => ({ id: record.id, title: record.title, prompt: record.status === "running" ? tr("正在反推") : record.status === "error" ? tr(record.error || "反推失败") : record.prompt, preview: record.preview, disabled: !record.history }))} activeId={activeId} onSelect={(id) => { const record = records.find((item) => item.id === id); if (record?.history) onSelect(record.history); }}>{content}</StudioHistorySidebar>
        <Drawer title={tr("生成记录")} open={open} onClose={() => setOpen(false)} size={360}>{content}</Drawer>
    </>;
}
