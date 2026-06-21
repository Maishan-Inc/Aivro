"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check, Clock3, GitBranch, MessageSquare, Network, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Tag } from "antd";

import type { CloudWorkflow } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useCanvasUiStore } from "../stores/use-canvas-ui-store";
import type { CanvasConnection, CanvasNodeData } from "../types";

export function CanvasProjectCard({ project, onRename, onDelete }: { project: CloudWorkflow; onRename: (project: CloudWorkflow, title: string) => void | Promise<void>; onDelete: (id: string) => void }) {
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const selected = selectedIds.includes(project.id);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState(project.title);
    const open = () => router.push(localizedPath(`/canvas/${project.id}`));

    useEffect(() => {
        setTitleDraft(project.title);
    }, [project.title]);
    const saveTitle = () => {
        const title = titleDraft.trim();
        if (title && title !== project.title) void onRename(project, title);
        setEditing(false);
    };
    const createdAt = formatProjectTime(project.createdAt);
    const updatedAt = formatProjectTime(project.updatedAt);
    const syncLabel = project.sourceSyncMode === "linked" ? "自动更新" : project.sourceSyncMode === "detached" ? "独立副本" : "自建";

    return (
        <>
            <article className={`group relative aspect-[1.18] min-h-[220px] cursor-pointer overflow-hidden rounded-lg border bg-card text-stone-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:text-stone-100 ${selected ? "border-stone-400 ring-2 ring-stone-300/70 dark:border-stone-600 dark:ring-stone-700/70" : "border-stone-200 dark:border-stone-800"}`} onClick={() => setDetailOpen(true)}>
                <WorkflowPreviewBackdrop nodes={project.nodes} connections={project.connections} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/62 dark:from-black/8 dark:to-black/74" />
                <input type="checkbox" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleSelected(project.id, event.target.checked)} className="absolute left-3 top-3 z-10 size-4 accent-stone-900 dark:accent-stone-100" aria-label={`选择 ${project.title}`} />
                <div className="absolute right-3 top-3 max-w-[70%] rounded-md border border-white/30 bg-white/80 px-2.5 py-1 text-right text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-stone-950/72">
                    <span className="block truncate">{project.title}</span>
                </div>
                <div className="absolute inset-x-3 bottom-3 grid grid-cols-4 gap-1.5">
                    <CardMetric label="节点" value={project.nodes.length} />
                    <CardMetric label="连线" value={project.connections.length} />
                    <CardMetric label="会话" value={project.chatSessions.length} />
                    <CardMetric label="消耗" value="1次" />
                </div>
            </article>

            <Modal title="工作流信息" open={detailOpen} centered width={560} onCancel={() => setDetailOpen(false)} footer={null} destroyOnHidden>
                <div className="space-y-4">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
                        <WorkflowPreviewBackdrop nodes={project.nodes} connections={project.connections} />
                    </div>
                    <div className="space-y-3">
                        {editing ? (
                            <div className="flex gap-2">
                                <Input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onPressEnter={saveTitle} autoFocus />
                                <Button type="primary" icon={<Check className="size-4" />} onClick={saveTitle}>保存</Button>
                                <Button icon={<X className="size-4" />} onClick={() => setEditing(false)}>取消</Button>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-xl font-semibold">{project.title}</h2>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <Tag color={project.sourceSyncMode === "linked" ? "magenta" : project.sourceSyncMode === "detached" ? "purple" : "default"}>{syncLabel}</Tag>
                                        <Tag>{project.backgroundMode}</Tag>
                                        <Tag>版本 {project.sourceVersion || 1}</Tag>
                                    </div>
                                </div>
                                <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>修改名称</Button>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 sm:grid-cols-4 dark:text-stone-400">
                            <ProjectMetric icon={<Network className="size-3.5" />} label="节点" value={project.nodes.length} />
                            <ProjectMetric icon={<GitBranch className="size-3.5" />} label="连线" value={project.connections.length} />
                            <ProjectMetric icon={<MessageSquare className="size-3.5" />} label="会话" value={project.chatSessions.length} />
                            <ProjectMetric icon={<Check className="size-3.5" />} label="消耗额度" value={1} suffix="次创建" />
                        </div>
                        <div className="grid gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                            <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />创建于 {createdAt}</div>
                            <div className="flex items-center gap-1.5"><Clock3 className="size-3.5" />更新于 {updatedAt}</div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
                        <Button danger icon={<Trash2 className="size-4" />} onClick={() => onDelete(project.id)}>删除</Button>
                        <Button type="primary" onClick={open}>打开工作流</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

export function WorkflowPreviewBackdrop({ nodes, connections }: { nodes: CanvasNodeData[]; connections?: CanvasConnection[] }) {
    const previewNodes = useMemo(() => {
        const items = nodes.slice(0, 12);
        if (!items.length) return [];
        const minX = Math.min(...items.map((node) => node.position.x));
        const minY = Math.min(...items.map((node) => node.position.y));
        const maxX = Math.max(...items.map((node) => node.position.x + node.width));
        const maxY = Math.max(...items.map((node) => node.position.y + node.height));
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return items.map((node) => ({
            id: node.id,
            type: String(node.type || "node"),
            left: 8 + ((node.position.x - minX) / width) * 72,
            top: 10 + ((node.position.y - minY) / height) * 68,
            width: Math.max(12, Math.min(26, (node.width / width) * 76)),
            height: Math.max(10, Math.min(22, (node.height / height) * 72)),
        }));
    }, [nodes]);
    const previewConnections = useMemo(() => (connections || []).slice(0, 10).map((connection, index) => ({ ...connection, index })), [connections]);

    return (
        <div className="absolute inset-0 overflow-hidden bg-stone-100 dark:bg-stone-950">
            <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(rgba(120,113,108,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(120,113,108,.16) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <svg className="absolute inset-0 size-full opacity-45" viewBox="0 0 100 100" preserveAspectRatio="none">
                {previewConnections.map((connection) => {
                    const from = previewNodes.find((node) => node.id === connection.fromNodeId);
                    const to = previewNodes.find((node) => node.id === connection.toNodeId);
                    if (!from || !to) return null;
                    return <line key={connection.id || connection.index} x1={from.left + from.width / 2} y1={from.top + from.height / 2} x2={to.left + to.width / 2} y2={to.top + to.height / 2} stroke="currentColor" strokeWidth="0.8" />;
                })}
            </svg>
            {previewNodes.length ? previewNodes.map((node) => (
                <div key={node.id} className="absolute rounded border border-stone-300 bg-white/85 shadow-sm dark:border-stone-700 dark:bg-stone-900/88" style={{ left: `${node.left}%`, top: `${node.top}%`, width: `${node.width}%`, height: `${node.height}%` }}>
                    <span className="sr-only">{node.type}</span>
                </div>
            )) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-stone-400">空白工作流</div>
            )}
        </div>
    );
}

function CardMetric({ label, value }: { label: string; value: ReactNode }) {
    return <div className="min-w-0 rounded-md border border-white/25 bg-white/82 px-2 py-1 text-center text-[11px] shadow-sm backdrop-blur dark:border-white/10 dark:bg-stone-950/72"><div className="truncate text-stone-500 dark:text-stone-400">{label}</div><div className="truncate font-semibold text-stone-900 dark:text-stone-100">{value}</div></div>;
}

function ProjectMetric({ icon, label, value, suffix }: { icon: ReactNode; label: string; value: number; suffix?: string }) {
    return (
        <div className="rounded-md bg-stone-50 px-2 py-1.5 dark:bg-stone-900">
            <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400">{icon}{label}</div>
            <div className="mt-0.5 font-semibold text-stone-900 dark:text-stone-100">{value}{suffix ? <span className="ml-1 text-[11px] font-normal text-stone-500 dark:text-stone-400">{suffix}</span> : null}</div>
        </div>
    );
}

function formatProjectTime(value: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
}
