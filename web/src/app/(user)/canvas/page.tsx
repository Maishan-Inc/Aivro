"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Input, Modal, Segmented, Spin, Tag } from "antd";
import { GitBranch, Layers3, Link2, Plus, Search, Sparkles, Waypoints } from "lucide-react";

import { createWorkflow, deleteWorkflow, fetchWorkflows, updateWorkflow, type CloudWorkflow } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { useUserStore } from "@/stores/use-user-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasProjectCard } from "./components/canvas-project-card";
import { useCanvasStore } from "./stores/use-canvas-store";
import { useCanvasUiStore } from "./stores/use-canvas-ui-store";

const creditsMessage = "当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。";
type WorkflowFilter = "all" | "linked" | "detached";

export default function CanvasPage() {
    const { message, modal } = App.useApp();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const projects = useCanvasStore((state) => state.projects);
    const setProjects = useCanvasStore((state) => state.setProjects);
    const removeProjects = useCanvasStore((state) => state.removeProjects);
    const upsertProject = useCanvasStore((state) => state.upsertProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const removeSelectedIds = useCanvasUiStore((state) => state.removeSelectedProjectIds);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [filter, setFilter] = useState<WorkflowFilter>("all");

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace(localizedPath("/login?redirect=/canvas"));
            return;
        }
        setIsLoading(true);
        fetchWorkflows(token, { pageSize: 200 })
            .then((data) => setProjects(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : "读取工作流失败"))
            .finally(() => setIsLoading(false));
    }, [isReady, message, router, setProjects, token]);

    const showCreditsModal = () => {
        modal.confirm({
            title: "工作流创建次数不足",
            content: creditsMessage,
            okText: "去购买套餐",
            cancelText: "去完成 KYC 认证",
            onOk: () => router.push(localizedPath("/pricing")),
            onCancel: () => router.push(localizedPath("/pricing")),
        });
    };

    const createAndEnter = async () => {
        if (!token) return;
        setIsCreating(true);
        try {
            const workflow = await createWorkflow(token, {
                title: `Aivro ${projects.length + 1}`,
                nodes: [],
                connections: [],
                chatSessions: [],
                activeChatId: null,
                backgroundMode: "lines",
                showImageInfo: false,
                viewport: { x: 0, y: 0, k: 1 },
            });
            upsertProject(workflow);
            await hydrateUser();
            router.push(localizedPath(`/canvas/${workflow.id}`));
        } catch (error) {
            const text = error instanceof Error ? error.message : "创建工作流失败";
            if (text.includes("暂无工作流创建次数")) showCreditsModal();
            else message.error(text);
        } finally {
            setIsCreating(false);
        }
    };

    const renameProject = async (project: CloudWorkflow, title: string) => {
        if (!token) return;
        try {
            const saved = await updateWorkflow(token, project.id, { ...project, title });
            upsertProject(saved);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "重命名失败");
        }
    };

    const deleteProjects = (ids: string[]) => {
        if (!token || !ids.length) return;
        Modal.confirm({
            title: "删除工作流？",
            content: `将删除 ${ids.length} 个云端工作流，删除后不可在列表中继续访问。`,
            okText: "删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: async () => {
                try {
                    await Promise.all(ids.map((id) => deleteWorkflow(token, id)));
                    removeProjects(ids);
                    removeSelectedIds(ids);
                    message.success("已删除");
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "删除失败");
                }
            },
        });
    };

    const filteredProjects = projects.filter((project) => {
        const matchesKeyword = project.title.toLowerCase().includes(keyword.trim().toLowerCase());
        const matchesFilter = filter === "all" || project.sourceSyncMode === filter;
        return matchesKeyword && matchesFilter;
    });
    const workflowStats = projects.reduce(
        (stats, project) => ({
            nodes: stats.nodes + project.nodes.length,
            connections: stats.connections + project.connections.length,
            sessions: stats.sessions + project.chatSessions.length,
            linked: stats.linked + (project.sourceSyncMode === "linked" ? 1 : 0),
            detached: stats.detached + (project.sourceSyncMode === "detached" ? 1 : 0),
            latest: !stats.latest || project.updatedAt > stats.latest ? project.updatedAt : stats.latest,
        }),
        { nodes: 0, connections: 0, sessions: 0, linked: 0, detached: 0, latest: "" },
    );

    if (!isReady || !token) {
        return <main className="grid h-full place-items-center bg-background" />;
    }

    return (
        <main className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <aside className="flex min-h-0 flex-col border-b p-6 lg:border-b-0 lg:border-r" style={{ background: theme.node.fill, borderColor: theme.node.stroke }}>
                <div>
                    <p className="text-xs font-medium" style={{ color: theme.node.muted }}>云端工作流库</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-normal">Aivro</h1>
                    <p className="mt-3 text-sm leading-6" style={{ color: theme.node.muted }}>集中管理你的画布项目、分享副本和云端创作上下文。</p>
                </div>
                <div className="mt-6 rounded-lg border p-4" style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ color: theme.node.muted }}>剩余创建次数</span>
                        <Tag color="blue">{user?.workflowCreateCredits ?? 0}</Tag>
                    </div>
                    <Button type="primary" block className="mt-4" icon={<Plus className="size-4" />} loading={isCreating} onClick={createAndEnter}>
                        新建工作流
                    </Button>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <CanvasStat icon={<Layers3 className="size-4" />} label="工作流" value={projects.length} theme={theme} />
                    <CanvasStat icon={<Waypoints className="size-4" />} label="节点" value={workflowStats.nodes} theme={theme} />
                    <CanvasStat icon={<GitBranch className="size-4" />} label="连线" value={workflowStats.connections} theme={theme} />
                    <CanvasStat icon={<Sparkles className="size-4" />} label="会话" value={workflowStats.sessions} theme={theme} />
                </div>
                <div className="mt-6 space-y-3 text-sm" style={{ color: theme.node.muted }}>
                    <CanvasSideMetric label="跟随分享更新" value={`${workflowStats.linked} 个`} theme={theme} />
                    <CanvasSideMetric label="独立副本" value={`${workflowStats.detached} 个`} theme={theme} />
                    <CanvasSideMetric label="最近更新" value={workflowStats.latest ? formatWorkflowTime(workflowStats.latest) : "-"} theme={theme} />
                </div>
                <div className="mt-auto hidden pt-6 text-xs leading-5 lg:block" style={{ color: theme.node.faint }}>工作流创建会消耗 1 次创建次数；删除后不会返还次数。</div>
            </aside>

            <section className="flex min-h-0 flex-col">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 backdrop-blur lg:px-8" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                    <div>
                        <h2 className="text-xl font-semibold">工作流</h2>
                        <p className="mt-1 text-sm" style={{ color: theme.node.muted }}>当前显示 {filteredProjects.length} / {projects.length} 个项目</p>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                        <Input
                            allowClear
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            prefix={<Search className="size-4" style={{ color: theme.node.faint }} />}
                            placeholder="搜索工作流名称"
                            className="max-w-xs"
                        />
                        <Segmented
                            value={filter}
                            onChange={(value) => setFilter(value as WorkflowFilter)}
                            options={[
                                { label: "全部", value: "all" },
                                { label: "跟随更新", value: "linked" },
                                { label: "独立副本", value: "detached" },
                            ]}
                        />
                        {selectedIds.length ? <Button onClick={() => deleteProjects(selectedIds)}>删除选中</Button> : null}
                        {projects.length ? <Button onClick={() => deleteProjects(projects.map((project) => project.id))}>删除全部</Button> : null}
                    </div>
                </header>

                {isLoading ? (
                    <section className="flex min-h-0 flex-1 items-center justify-center text-sm" style={{ color: theme.node.muted }}>
                        <Spin />
                    </section>
                ) : filteredProjects.length ? (
                    <div className="min-h-0 flex-1 overflow-auto p-5 lg:p-8">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredProjects.map((project) => (
                                <CanvasProjectCard key={project.id} project={project} onRename={renameProject} onDelete={(id) => deleteProjects([id])} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                        <div className="mb-5 flex size-16 items-center justify-center rounded-lg border" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                            <Link2 className="size-6" style={{ color: theme.node.muted }} />
                        </div>
                        <h2 className="text-xl font-medium">{projects.length ? "没有匹配的工作流" : "还没有云端工作流"}</h2>
                        <p className="mt-3 max-w-md text-sm leading-6" style={{ color: theme.node.muted }}>{projects.length ? "换一个关键词或筛选条件继续查找。" : "新建工作流会消耗 1 次创建次数，并保存到你的账号。"}</p>
                        <Button type="primary" className="mt-6" icon={<Plus className="size-4" />} loading={isCreating} onClick={createAndEnter}>
                            新建工作流
                        </Button>
                    </section>
                )}
            </section>
        </main>
    );
}

function CanvasStat({ icon, label, value, theme }: { icon: ReactNode; label: string; value: number; theme: CanvasTheme }) {
    return (
        <div className="rounded-lg border p-3" style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}>
            <div className="flex items-center gap-2" style={{ color: theme.node.muted }}>{icon}<span className="text-xs">{label}</span></div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
    );
}

function CanvasSideMetric({ label, value, theme }: { label: string; value: string; theme: CanvasTheme }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: theme.node.stroke }}>
            <span>{label}</span>
            <span className="font-medium" style={{ color: theme.node.text }}>{value}</span>
        </div>
    );
}

function formatWorkflowTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
