"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
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

    return (
        <article className="group flex min-h-44 cursor-pointer flex-col justify-between rounded-2xl bg-[#f1eee8] p-5 transition hover:bg-[#ebe6dc] dark:bg-white/5 dark:hover:bg-white/10" onClick={() => !editing && open()}>
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => toggleSelected(project.id, event.target.checked)}
                    className="mt-1 size-4 accent-stone-950 dark:accent-stone-100"
                    aria-label={`选择 ${project.title}`}
                />
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
                            <h2 className="truncate text-xl font-semibold">{project.title}</h2>
                            {project.sourceSyncMode === "linked" ? <Tag color="processing">跟随分享更新</Tag> : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
                            {project.nodes.length} 个节点 · {project.connections.length} 条连线
                        </p>
                    </button>
                )}
            </div>
            <div className="mt-8 flex items-end justify-between gap-3">
                <p className="text-xs text-stone-500">云端更新于 {new Date(project.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
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
