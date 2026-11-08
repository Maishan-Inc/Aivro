"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Drawer, Empty, Popconfirm } from "antd";
import { History, Plus, Trash2 } from "lucide-react";
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
    const retention = useGenerationRetention();
    const client = useQueryClient();
    const query = useQuery({ queryKey: ["explore-history", type, token], queryFn: () => fetchGenerationHistories(token, { type, pageSize: 100 }), enabled: Boolean(token), refetchInterval: 30000 });
    const remove = useMutation({ mutationFn: (id: string) => deleteGenerationHistory(token, id), onSuccess: async (_, id) => {
        if (activeId === id) onSelect(null);
        await client.invalidateQueries({ queryKey: ["explore-history", type] });
    }, onError: (error) => message.error(tr(error.message)) });
    const items = query.data?.items || [];
    const create = () => { onNew?.(); setOpen(false); };
    const content = <div className="space-y-3">
        <h2 className="text-sm font-medium">{tr("生成记录")}</h2>
        {onNew ? <Button block icon={<Plus size={16} />} disabled={newDisabled} onClick={create}>{tr("新建任务")}</Button> : null}
        <p className="text-sm text-muted-foreground">{tr("新记录保存 {0} 天").replace("{0}", String(retention.data?.days[type] ?? "—"))}</p>
        {query.isError ? <p className="text-xs text-muted-foreground">{tr(query.error.message)}</p> : null}
        {!items.length ? <Empty description={tr("暂无记录")} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : items.map((item) => <div key={item.id} className="rounded-xl border border-border p-3">
            <button type="button" className="w-full text-left" onClick={() => { onSelect(item); setOpen(false); }} aria-pressed={item.id === activeId}>
                {item.media[0]?.url ? <img src={item.media[0].url} alt={item.title} className="mb-2 max-h-36 w-full rounded-lg object-contain" /> : null}
                <p className="truncate text-xs font-medium" data-i18n-skip>{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" data-i18n-skip>{item.prompt}</p>
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground" data-i18n-skip>{tr("保存至 {0}").replace("{0}", formatDateTime(item.expiresAt))}</span>
                <Popconfirm title={tr("删除这条记录？")} okText={tr("删除")} cancelText={tr("取消")} onConfirm={() => remove.mutate(item.id)}><Button type="text" size="small" icon={<Trash2 size={12} />} aria-label={tr("删除记录")} loading={remove.isPending && remove.variables === item.id} /></Popconfirm>
            </div>
        </div>)}
    </div>;
    return <>
        <Button type="text" className={`${studio.historyActions} absolute right-4 top-6 z-10`} icon={<History size={16} />} onClick={() => setOpen(true)}>{tr("生成记录")}</Button>
        <StudioHistorySidebar onNew={onNew ? create : undefined} newDisabled={newDisabled} items={items.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, preview: item.media[0]?.url }))} activeId={activeId} onSelect={(id) => onSelect(items.find((item) => item.id === id) || null)}>{content}</StudioHistorySidebar>
        <Drawer title={tr("生成记录")} open={open} onClose={() => setOpen(false)} size={360}>{content}</Drawer>
    </>;
}
