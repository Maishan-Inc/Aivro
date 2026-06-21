"use client";

import type { ReactNode } from "react";
import { CalendarDays, Check, Clock3, GitBranch, MessageSquare, Network, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Input, Tag } from "antd";

import type { CloudWorkflow } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useCanvasUiStore } from "../stores/use-canvas-ui-store";

export function CanvasProjectCard({ project, onRename, onDelete }: { project: CloudWorkflow; onRename: (project: CloudWorkflow, title: string) => void | Promise<void>; onDelete: (id: string) => void }) {
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const editingId = useCanvasUiStore((state) => state.editingProjectId);
    const editingTitle = useCanvasUiStore((state) => state.editingProjectTitle);
    const startEditing = useCanvasUiStore((state) => state.startEditingProject);
    const setEditingTitle = useCanvasUiStore((state) => state.setEditingProjectTitle);
    const stopEditing = useCanvasUiStore((state) => state.stopEditingProject);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const editing = editingId === project.id;
    const selected = selectedIds.includes(project.id);
    const open = () => router.push(localizedPath(`/canvas/${project.id}`));
    const saveTitle = () => {
        void onRename(project, editingTitle);
        stopEditing();
    };
    const createdAt = formatProjectTime(project.createdAt);
    const updatedAt = formatProjectTime(project.updatedAt);
    const syncLabel = project.sourceSyncMode === "linked" ? "自动更新" : project.sourceSyncMode === "detached" ? "独立副本" : "自建";

    return (
        <article className="group flex min-h-[286px] cursor-pointer flex-col rounded-lg border border-stone-200 bg-card p-4 text-stone-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:text-stone-100" onClick={() => !editing && open()}>
            <div className="mb-4 h-24 overflow-hidden rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-900">
                <div className="grid h-full grid-cols-3 gap-2">
                    {project.nodes.slice(0, 6).map((node, index) => (
                        <div key={node.id || index} className="flex min-w-0 items-center justify-center rounded border border-stone-200 bg-card px-2 text-[10px] text-stone-500 dark:border-stone-800 dark:text-stone-400">
                            <span className="truncate">{String(node.type || "node")}</span>
                        </div>
                    ))}
                    {!project.nodes.length ? (
                        <div className="col-span-3 flex h-full items-center justify-center text-xs text-stone-500 dark:text-stone-400">空白工作流</div>
                    ) : null}
                </div>
            </div>
            <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleSelected(project.id, event.target.checked)} className="mt-1 size-4 accent-stone-900 dark:accent-stone-100" aria-label={`选择 ${project.title}`} />
                {editing ? (
                    <Input className="min-w-0" value={editingTitle} onClick={(event) => event.stopPropagation()} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveTitle()} autoFocus />
                ) : (
                    <button
                        type="button"
                        className="min-w-0 cursor-pointer text-left"
                        onClick={(event) => {
                            event.stopPropagation();
                            open();
                        }}
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-lg font-semibold">{project.title}</h2>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <Tag color={project.sourceSyncMode === "linked" ? "magenta" : project.sourceSyncMode === "detached" ? "purple" : "default"}>{syncLabel}</Tag>
                            <Tag>{project.backgroundMode}</Tag>
                        </div>
                    </button>
                )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-stone-500 dark:text-stone-400">
                <ProjectMetric icon={<Network className="size-3.5" />} label="节点" value={project.nodes.length} />
                <ProjectMetric icon={<GitBranch className="size-3.5" />} label="连线" value={project.connections.length} />
                <ProjectMetric icon={<MessageSquare className="size-3.5" />} label="会话" value={project.chatSessions.length} />
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />创建于 {createdAt}</div>
                <div className="flex items-center gap-1.5"><Clock3 className="size-3.5" />更新于 {updatedAt}</div>
            </div>
            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                <p className="text-xs text-stone-500 dark:text-stone-400">版本 {project.sourceVersion || 1}</p>
                <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    {editing ? (
                        <>
                            <Button type="text" size="small" shape="circle" icon={<Check className="size-4" />} onClick={saveTitle} aria-label="保存名称" />
                            <Button type="text" size="small" shape="circle" icon={<X className="size-4" />} onClick={stopEditing} aria-label="取消重命名" />
                        </>
                    ) : (
                        <>
                            <Button type="text" size="small" shape="circle" icon={<Pencil className="size-4" />} onClick={() => startEditing(project.id, project.title)} aria-label="重命名" />
                            <Button type="text" size="small" shape="circle" icon={<Trash2 className="size-4" />} onClick={() => onDelete(project.id)} aria-label="删除" />
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}

function ProjectMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return (
        <div className="rounded-md bg-stone-50 px-2 py-1.5 dark:bg-stone-900">
            <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400">{icon}{label}</div>
            <div className="mt-0.5 font-semibold text-stone-900 dark:text-stone-100">{value}</div>
        </div>
    );
}

function formatProjectTime(value: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
}
