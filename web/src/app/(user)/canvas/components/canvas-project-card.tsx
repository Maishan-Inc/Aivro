"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Check, Clock3, FileText, GitBranch, MoreHorizontal, Network, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Input, Modal, Tag, type MenuProps } from "antd";

import type { CloudWorkflow } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { formatShortDateTime } from "@/lib/datetime";
import { useCanvasUiStore } from "../stores/use-canvas-ui-store";
import type { CanvasConnection, CanvasNodeData } from "../types";
import { canAccessPath } from "@/lib/user-sections";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasProjectCard({ project, onRename, onDelete }: { project: CloudWorkflow; onRename: (project: CloudWorkflow, title: string) => void | Promise<void>; onDelete: (id: string) => void }) {
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const { tr } = useI18n();
    const workflowEnabled = useUserStore((state) => canAccessPath(state.user, "/canvas"));
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const selected = selectedIds.includes(project.id);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState(project.title);
    const open = () => workflowEnabled ? router.push(localizedPath(`/canvas/${project.id}`)) : setDetailOpen(true);

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
    const menu: MenuProps = {
        items: [
            { key: "rename", disabled: !workflowEnabled, icon: <Pencil className="size-4" />, label: tr("修改名称") },
            { key: "open", disabled: !workflowEnabled, icon: <GitBranch className="size-4" />, label: tr("打开工作流") },
            { key: "delete", disabled: !workflowEnabled, danger: true, icon: <Trash2 className="size-4" />, label: tr("删除工作流") },
            { type: "divider" },
            { key: "info", icon: <FileText className="size-4" />, label: tr("工作流信息") },
        ],
        onClick: ({ key }) => {
            if (key === "rename") { setDetailOpen(true); setEditing(true); }
            if (key === "open") open();
            if (key === "delete") onDelete(project.id);
            if (key === "info") setDetailOpen(true);
        },
    };

    return (
        <>
            <Dropdown
                trigger={["contextMenu"]}
                menu={menu}
            >
                <article className={`group relative overflow-hidden rounded-2xl border bg-card transition hover:border-foreground/25 ${selected ? "border-foreground/50 ring-2 ring-foreground/15" : "border-border"}`}>
                    <div className="relative aspect-[16/10] overflow-hidden border-b border-border">
                        <button type="button" className="absolute inset-0 cursor-pointer text-left" onClick={open} aria-label={tr("打开工作流")}>
                            <WorkflowPreviewBackdrop nodes={project.nodes} connections={project.connections} />
                        </button>
                        <label className="absolute left-2 top-2 flex size-10 cursor-pointer items-center justify-center rounded-lg bg-background/85 backdrop-blur">
                            <input type="checkbox" data-i18n-skip disabled={!workflowEnabled} checked={selected} onChange={(event) => toggleSelected(project.id, event.target.checked)} className="size-4 accent-foreground" aria-label={`${tr("选择工作流")} ${project.title}`} />
                        </label>
                        <Dropdown trigger={["click"]} placement="bottomRight" menu={menu}>
                            <button type="button" className="absolute right-2 top-2 grid size-10 place-items-center rounded-lg bg-background/85 text-foreground backdrop-blur transition hover:bg-background" aria-label={tr("工作流操作")}><MoreHorizontal className="size-5" /></button>
                        </Dropdown>
                    </div>
                    <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold" data-i18n-skip onClick={open}>{project.title}</button>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{tr(syncLabel)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Network className="size-3.5" />{project.nodes.length} {tr("节点")}</span>
                            <span className="flex items-center gap-1.5"><GitBranch className="size-3.5" />{project.connections.length} {tr("连线")}</span>
                            <button type="button" className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 hover:text-foreground" onClick={() => setDetailOpen(true)}>{tr("工作流信息")}<ArrowUpRight className="size-3.5" /></button>
                        </div>
                        <p className="truncate border-t border-border pt-3 text-[11px] text-muted-foreground">{tr("更新于")} {updatedAt}</p>
                    </div>
                </article>
            </Dropdown>

            <Modal title="工作流信息" open={detailOpen} centered width={920} onCancel={() => setDetailOpen(false)} footer={null} destroyOnHidden>
                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border md:aspect-auto md:min-h-80">
                        <WorkflowPreviewBackdrop nodes={project.nodes} connections={project.connections} />
                    </div>
                    <div className="space-y-3">
                        {editing ? (
                            <div className="flex gap-2">
                                <Input disabled={!workflowEnabled} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onPressEnter={saveTitle} autoFocus />
                                <Button disabled={!workflowEnabled} type="primary" icon={<Check className="size-4" />} onClick={saveTitle}>保存</Button>
                                <Button icon={<X className="size-4" />} onClick={() => setEditing(false)}>取消</Button>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="break-all text-lg font-semibold" data-i18n-skip>{project.title}</h2>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <Tag color={project.sourceSyncMode === "linked" ? "magenta" : project.sourceSyncMode === "detached" ? "purple" : "default"}>{syncLabel}</Tag>
                                        <Tag>{tr(project.backgroundMode === "dots" ? "点" : project.backgroundMode === "blank" ? "空白" : "线")}</Tag>
                                        <Tag>版本 {project.sourceVersion || 1}</Tag>
                                    </div>
                                </div>
                                <Button disabled={!workflowEnabled} type="text" icon={<Pencil className="size-4" />} aria-label={tr("修改名称")} onClick={() => setEditing(true)} />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 sm:grid-cols-3 dark:text-stone-400">
                            <ProjectMetric icon={<Network className="size-3.5" />} label="节点" value={project.nodes.length} />
                            <ProjectMetric icon={<GitBranch className="size-3.5" />} label="连线" value={project.connections.length} />
                            <ProjectMetric icon={<Check className="size-3.5" />} label="消耗额度" value={1} suffix="次创建" />
                        </div>
                        <div className="grid gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                            <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />创建于 {createdAt}</div>
                            <div className="flex items-center gap-1.5"><Clock3 className="size-3.5" />更新于 {updatedAt}</div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-border pt-4 md:col-span-2">
                        <Button disabled={!workflowEnabled} danger icon={<Trash2 className="size-4" />} onClick={() => onDelete(project.id)}>删除</Button>
                        <Button disabled={!workflowEnabled} type="primary" onClick={open}>打开工作流</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

export function WorkflowPreviewBackdrop({ nodes, connections }: { nodes: CanvasNodeData[]; connections?: CanvasConnection[] }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const { items, byId, viewBox } = useMemo(() => {
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const items = nodes.filter((node) => {
            const parent = byId.get(node.metadata?.batchRootId || "");
            return !parent || (parent.type !== "custom" && parent.metadata?.imageBatchExpanded);
        });
        const left = items.length ? Math.min(...items.map((node) => node.position.x)) : 0;
        const top = items.length ? Math.min(...items.map((node) => node.position.y)) : 0;
        const right = Math.max(left + 1, ...items.map((node) => node.position.x + node.width));
        const bottom = Math.max(top + 1, ...items.map((node) => node.position.y + node.height));
        const padding = Math.max(48, Math.max(right - left, bottom - top) * 0.06);
        return { items, byId, viewBox: `${left - padding} ${top - padding} ${right - left + padding * 2} ${bottom - top + padding * 2}` };
    }, [nodes]);
    const visibleIds = new Set(items.map((node) => node.id));
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: theme.canvas.background }}>
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `radial-gradient(circle, ${theme.canvas.dot} 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
            {items.length ? <svg className="absolute inset-0 size-full p-3" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {(connections || []).map((connection) => {
                    const from = byId.get(connection.fromNodeId);
                    const to = byId.get(connection.toNodeId);
                    if (!from || !to || !visibleIds.has(from.id) || !visibleIds.has(to.id)) return null;
                    const x = from.position.x + from.width;
                    const y = from.position.y + from.height / 2;
                    const tx = to.position.x;
                    const ty = to.position.y + to.height / 2;
                    const curve = Math.max(Math.abs(tx - x) / 2, 50);
                    return <path key={connection.id} d={`M ${x} ${y} C ${x + curve} ${y}, ${tx - curve} ${ty}, ${tx} ${ty}`} stroke={theme.node.muted} strokeWidth="2" fill="none" />;
                })}
                {items.map((node) => {
                    const image = node.type === "image" ? node.metadata?.content : node.type === "custom" ? byId.get(node.metadata?.batchChildIds?.[0] || "")?.metadata?.content : undefined;
                    const type = tr(previewNodeTypeLabel(node.type));
                    return <foreignObject key={node.id} x={node.position.x} y={node.position.y} width={node.width} height={node.height}>
                        <div className="flex h-full flex-col overflow-hidden rounded-2xl border" style={{ background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}>
                            <div className="shrink-0 truncate border-b px-3 py-2 text-sm font-medium" style={{ borderColor: theme.node.stroke }} data-i18n-skip>{node.title || type}</div>
                            {image ? <img src={image} alt="" loading="lazy" className="min-h-0 w-full flex-1 object-contain" /> : <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                                <span className="text-xs" style={{ color: theme.node.muted }}>{type}</span>
                                <p className="line-clamp-4 text-sm leading-6" data-i18n-skip>{node.metadata?.prompt || (node.type === "text" || node.type === "custom" ? node.metadata?.content : "") || node.metadata?.model || ""}</p>
                            </div>}
                        </div>
                    </foreignObject>;
                })}
            </svg> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: theme.node.muted }}><Network className="size-8 opacity-40" /><span className="text-xs">{tr("空白工作流")}</span></div>}
        </div>
    );
}

function previewNodeTypeLabel(type: CanvasNodeData["type"]) {
    if (type === "image") return "图片节点";
    if (type === "text") return "文本节点";
    if (type === "video") return "视频节点";
    if (type === "model3d") return "3D 节点";
    if (type === "custom") return "自定义";
    return "配置节点";
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
    return value ? formatShortDateTime(value) : "-";
}
