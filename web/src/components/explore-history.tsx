"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Drawer, Empty, Popconfirm, Tag } from "antd";
import { CheckSquare, History, Plus, Trash2 } from "lucide-react";
import { StudioHistorySidebar } from "@/components/studio-history-sidebar";
import { fetchGenerationHistories, deleteGenerationHistory, type GenerationHistory } from "@/services/api/generation-history";
import { useGenerationRetention } from "@/hooks/use-generation-retention";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import studio from "@/components/studio-layout.module.css";

export function ExploreHistory({ type, activeId, onSelect, onNew, newDisabled }: { type: "free-image" | "prompt-reverse"; activeId?: string; onSelect: (item: GenerationHistory | null) => void; onNew?: () => void; newDisabled?: boolean }) {
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
            <Tag>{items.length}</Tag>
        </div>
        <div className="space-y-3">
            {query.isError ? <p className="text-xs text-muted-foreground">{tr(query.error.message)}</p> : null}
            {!items.length ? <Empty description={tr("暂无记录")} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : items.map((item) => <div key={item.id} className="rounded-xl border border-border p-3">
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
        <Button type="text" className={`${studio.historyActions} absolute right-4 top-6 z-10`} icon={<History size={16} />} onClick={() => setOpen(true)}>{tr("生成记录")}</Button>
        <StudioHistorySidebar onNew={onNew ? create : undefined} newDisabled={newDisabled} items={items.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, preview: item.media[0]?.url }))} activeId={activeId} onSelect={(id) => onSelect(items.find((item) => item.id === id) || null)}>{content}</StudioHistorySidebar>
        <Drawer title={tr("生成记录")} open={open} onClose={() => setOpen(false)} size={360}>{content}</Drawer>
    </>;
}
