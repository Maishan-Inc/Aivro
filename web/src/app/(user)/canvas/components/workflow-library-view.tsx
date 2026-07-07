"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Drawer, Input, Modal, Select, Segmented, Spin, Tag } from "antd";
import { BarChart3, BookOpen, Layers3, Link2, Plus, Search, Send, Sparkles, UploadCloud, UserRound } from "lucide-react";

import {
    createWorkflow,
    deleteCommunityWorkflow,
    deleteWorkflow,
    fetchCommunityWorkflows,
    fetchMyCommunityWorkflows,
    fetchWorkflows,
    publishCommunityWorkflow,
    syncCommunityWorkflow,
    updateWorkflow,
    type CloudWorkflow,
    type WorkflowCommunityPost,
} from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useWorkflowModals, workflowConfirmName } from "@/hooks/use-workflow-modals";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasProjectCard, WorkflowPreviewBackdrop } from "@/app/(user)/canvas/components/canvas-project-card";
import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";
import { useCanvasUiStore } from "@/app/(user)/canvas/stores/use-canvas-ui-store";

const creditsMessage = "当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。";
const communityTags = ["图像生成", "角色设定", "产品设计", "海报", "视频", "3D", "提示词", "自动化"];
type WorkflowFilter = "all" | "linked" | "detached";
type CanvasTab = "workflows" | "shares" | "community";
type CommunityMode = "browse" | "mine";

type WorkflowLibraryViewProps = {
    initialTab?: CanvasTab;
    lockTab?: boolean;
    redirectPath?: string;
    embedded?: boolean;
};

export function WorkflowLibraryView({ initialTab = "workflows", lockTab = false, redirectPath = "/canvas", embedded = false }: WorkflowLibraryViewProps) {
    const { message, modal } = App.useApp();
    const { requestWorkflowName, confirmWorkflowDelete } = useWorkflowModals();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const projects = useCanvasStore((state) => state.projects);
    const setProjects = useCanvasStore((state) => state.setProjects);
    const removeProjects = useCanvasStore((state) => state.removeProjects);
    const upsertProject = useCanvasStore((state) => state.upsertProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const removeSelectedIds = useCanvasUiStore((state) => state.removeSelectedProjectIds);
    const [activeTab, setActiveTab] = useState<CanvasTab>(initialTab);
    const [communityMode, setCommunityMode] = useState<CommunityMode>("browse");
    const [isLoading, setIsLoading] = useState(false);
    const [isCommunityLoading, setIsCommunityLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [filter, setFilter] = useState<WorkflowFilter>("all");
    const [communityKeyword, setCommunityKeyword] = useState("");
    const [communityLocale, setCommunityLocale] = useState<"" | "zh-CN" | "en-US">("");
    const [communityItems, setCommunityItems] = useState<WorkflowCommunityPost[]>([]);
    const [myCommunityItems, setMyCommunityItems] = useState<WorkflowCommunityPost[]>([]);
    const [publishOpen, setPublishOpen] = useState(false);
    const [publishWorkflowId, setPublishWorkflowId] = useState("");
    const [publishTitle, setPublishTitle] = useState("");
    const [publishLocale, setPublishLocale] = useState<"zh-CN" | "en-US">("zh-CN");
    const [publishTags, setPublishTags] = useState<string[]>([]);
    const [statsOpen, setStatsOpen] = useState(false);

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace(localizedPath(`/login?redirect=${redirectPath}`));
            return;
        }
        setIsLoading(true);
        fetchWorkflows(token, { pageSize: 200 })
            .then((data) => setProjects(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : "读取工作流失败"))
            .finally(() => setIsLoading(false));
    }, [isReady, message, redirectPath, router, setProjects, token]);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (!token || activeTab !== "community") return;
        setIsCommunityLoading(true);
        const query = { keyword: communityKeyword, locale: communityLocale, pageSize: 200 };
        Promise.all([fetchCommunityWorkflows(token, query), fetchMyCommunityWorkflows(token, { pageSize: 200 })])
            .then(([community, mine]) => {
                setCommunityItems(community.items);
                setMyCommunityItems(mine.items);
            })
            .catch((error) => message.error(error instanceof Error ? error.message : "读取社区工作流失败"))
            .finally(() => setIsCommunityLoading(false));
    }, [activeTab, communityKeyword, communityLocale, message, token]);

    const workflowStats = useMemo(
        () =>
            projects.reduce(
                (stats, project) => ({
                    nodes: stats.nodes + project.nodes.length,
                    connections: stats.connections + project.connections.length,
                    sessions: stats.sessions + project.chatSessions.length,
                    linked: stats.linked + (project.sourceSyncMode === "linked" ? 1 : 0),
                    detached: stats.detached + (project.sourceSyncMode === "detached" ? 1 : 0),
                    latest: !stats.latest || project.updatedAt > stats.latest ? project.updatedAt : stats.latest,
                }),
                { nodes: 0, connections: 0, sessions: 0, linked: 0, detached: 0, latest: "" },
            ),
        [projects],
    );
    const filteredProjects = projects.filter((project) => {
        const matchesKeyword = project.title.toLowerCase().includes(keyword.trim().toLowerCase());
        const matchesFilter = filter === "all" || project.sourceSyncMode === filter;
        return matchesKeyword && matchesFilter;
    });
    const shareProjects = filteredProjects;

    const showCreditsModal = () => {
        modal.confirm({
            title: "工作流创建次数不足",
            centered: true,
            content: creditsMessage,
            okText: "去购买套餐",
            cancelText: "去完成 KYC 认证",
            onOk: () => router.push(localizedPath("/pricing")),
            onCancel: () => router.push(localizedPath("/pricing")),
        });
    };

    const createAndEnter = async () => {
        if (!token) return;
        if ((user?.workflowCreateCredits ?? 0) <= 0) {
            showCreditsModal();
            return;
        }
        const name = await requestWorkflowName({ title: "初始化工作流", username: user?.username, okText: "创建工作流", cancelOnLeft: true });
        if (!name) return;
        setIsCreating(true);
        try {
            const workflow = await createWorkflow(token, {
                slug: name,
                title: name,
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
        void (async () => {
            const deleted: string[] = [];
            for (const id of ids) {
                const project = projects.find((item) => item.id === id);
                if (!project) continue;
                const confirmName = await confirmWorkflowDelete(project);
                if (!confirmName) break;
                try {
                    await deleteWorkflow(token, project.id, workflowConfirmName(project));
                    deleted.push(project.id);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "删除失败");
                    break;
                }
            }
            if (deleted.length) {
                removeProjects(deleted);
                removeSelectedIds(deleted);
                message.success("已删除");
            }
        })();
    };

    const publishCommunity = async () => {
        if (!token) return;
        if (!publishWorkflowId || !publishTitle.trim()) {
            message.warning("请选择工作流并填写社区作品名称");
            return;
        }
        try {
            const saved = await publishCommunityWorkflow(token, { workflowId: publishWorkflowId, title: publishTitle, locale: publishLocale, tags: publishTags });
            setMyCommunityItems((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
            setCommunityItems((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
            setPublishOpen(false);
            message.success("已上传到社区工作流");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "上传失败");
        }
    };

    const openPublish = () => {
        setPublishWorkflowId(projects[0]?.id || "");
        setPublishTitle("");
        setPublishLocale("zh-CN");
        setPublishTags([]);
        setPublishOpen(true);
    };

    if (!isReady || !token) {
        return <main className="grid h-full place-items-center bg-stone-50 dark:bg-stone-950" />;
    }

    const controlBar = activeTab === "community" ? (
        <CommunityControls
            mode={communityMode}
            setMode={setCommunityMode}
            keyword={communityKeyword}
            locale={communityLocale}
            onKeywordChange={setCommunityKeyword}
            onLocaleChange={setCommunityLocale}
            onUpload={openPublish}
        />
    ) : (
        <WorkflowControls
            projects={activeTab === "shares" ? shareProjects : filteredProjects}
            allProjects={projects}
            keyword={keyword}
            filter={filter}
            selectedIds={selectedIds}
            isCreating={isCreating}
            onKeywordChange={setKeyword}
            onFilterChange={setFilter}
            onCreate={createAndEnter}
            onDelete={deleteProjects}
        />
    );
    const renderMetrics = () => (
        <>
            <HeaderMetric label="剩余创建次数" value={user?.workflowCreateCredits ?? 0} />
            <HeaderMetric label="工作流" value={projects.length} />
            <HeaderMetric label="节点" value={workflowStats.nodes} />
            <HeaderMetric label="连线" value={workflowStats.connections} />
            <HeaderMetric label="会话" value={workflowStats.sessions} />
            <HeaderMetric label="自动更新" value={workflowStats.linked} />
            <HeaderMetric label="独立副本" value={workflowStats.detached} />
            <HeaderMetric label="最近更新" value={workflowStats.latest ? formatWorkflowTime(workflowStats.latest) : "-"} wide />
        </>
    );

    return (
        <main className={`${lockTab ? "flex" : "grid grid-rows-[1fr_auto] lg:grid-cols-[184px_minmax(0,1fr)] lg:grid-rows-1"} h-full min-h-0 overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100`}>
            {!lockTab ? (
                <aside className="order-2 flex border-t border-stone-200 bg-card p-2 lg:order-1 lg:min-h-0 lg:flex-col lg:border-r lg:border-t-0 lg:p-4 dark:border-stone-800">
                    <nav className="grid flex-1 grid-cols-3 gap-1 lg:flex-none lg:grid-cols-1">
                        <SideButton active={activeTab === "workflows"} icon={<Layers3 className="size-4" />} label="我的工作流" onClick={() => setActiveTab("workflows")} />
                        <SideButton active={activeTab === "shares"} icon={<Link2 className="size-4" />} label="我的分享" onClick={() => setActiveTab("shares")} />
                        <SideButton active={activeTab === "community"} icon={<BookOpen className="size-4" />} label="社区工作流" onClick={() => setActiveTab("community")} />
                    </nav>
                </aside>
            ) : null}

            <section className={`${lockTab ? "flex-1" : "order-1 lg:order-2"} flex min-h-0 flex-col`}>
                <header className={`${embedded ? "rounded-t-lg border" : "border-b"} border-stone-200 bg-background px-4 lg:h-24 lg:overflow-x-auto lg:px-6 dark:border-stone-800`}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 py-2 lg:h-full lg:min-w-max lg:flex-nowrap lg:py-0">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-none lg:flex-nowrap">{controlBar}</div>
                        <Button className="lg:hidden" icon={<BarChart3 className="size-4" />} onClick={() => setStatsOpen(true)}>
                            统计
                        </Button>
                        <div className="hidden w-full min-w-0 gap-2 overflow-x-auto lg:ml-auto lg:flex lg:w-auto lg:min-w-max lg:overflow-visible">
                            {renderMetrics()}
                        </div>
                    </div>
                </header>

                {activeTab === "community" ? (
                    <CommunitySection
                        mode={communityMode}
                        isLoading={isCommunityLoading}
                        items={communityItems}
                        myItems={myCommunityItems}
                        projects={projects}
                        onUpload={openPublish}
                        onOpen={(item) => router.push(localizedPath(`/canvas/community/${item.token}`))}
                        onSync={async (item) => {
                            if (!token) return;
                            const source = projects.find((project) => project.id === item.sourceWorkflowId);
                            const value = await confirmWorkflowTitle(modal, source?.title || item.sourceWorkflowTitle);
                            if (!value) return;
                            try {
                                const saved = await syncCommunityWorkflow(token, item.id, value);
                                setMyCommunityItems((items) => items.map((old) => (old.id === saved.id ? saved : old)));
                                setCommunityItems((items) => items.map((old) => (old.id === saved.id ? saved : old)));
                                message.success("已同步社区作品");
                            } catch (error) {
                                message.error(error instanceof Error ? error.message : "同步失败");
                            }
                        }}
                        onDelete={(item) => {
                            if (!token) return;
                            Modal.confirm({
                                title: "删除我的作品？",
                                centered: true,
                                content: `删除后「${item.title}」不会继续在社区展示。`,
                                okText: "删除",
                                okButtonProps: { danger: true },
                                cancelText: "取消",
                                onOk: async () => {
                                    await deleteCommunityWorkflow(token, item.id);
                                    setMyCommunityItems((items) => items.filter((old) => old.id !== item.id));
                                    setCommunityItems((items) => items.filter((old) => old.id !== item.id));
                                },
                            });
                        }}
                    />
                ) : (
                    <WorkflowSection
                        isLoading={isLoading}
                        projects={activeTab === "shares" ? shareProjects : filteredProjects}
                        keyword={keyword}
                        isCreating={isCreating}
                        emptyTitle={activeTab === "shares" ? "还没有分享副本" : "还没有云端工作流"}
                        emptyDescription={activeTab === "shares" ? "从分享链接 Fork 的独立副本和自动更新工作流会显示在这里。" : "新建工作流会消耗 1 次创建次数，并保存到你的账号。"}
                        onCreate={createAndEnter}
                        onRename={renameProject}
                        onDelete={deleteProjects}
                    />
                )}
            </section>

            <Modal title="上传我的作品" open={publishOpen} centered onCancel={() => setPublishOpen(false)} onOk={() => void publishCommunity()} okText="上传" cancelText="取消" destroyOnHidden>
                <div className="grid gap-4 py-2">
                    <label className="grid gap-2 text-sm">
                        <span className="text-stone-500 dark:text-stone-400">选择我的工作流</span>
                        <Select
                            value={publishWorkflowId}
                            options={projects.map((project) => ({ label: project.title, value: project.id }))}
                            onChange={setPublishWorkflowId}
                            placeholder="选择要发布的工作流"
                        />
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="text-stone-500 dark:text-stone-400">社区作品名称</span>
                        <Input value={publishTitle} onChange={(event) => setPublishTitle(event.target.value)} placeholder="单独设置公开展示名称" />
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="text-stone-500 dark:text-stone-400">发布语言</span>
                        <Select value={publishLocale} onChange={setPublishLocale} options={[{ label: "中文", value: "zh-CN" }, { label: "English", value: "en-US" }]} />
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="text-stone-500 dark:text-stone-400">标签</span>
                        <Select mode="multiple" value={publishTags} onChange={setPublishTags} options={communityTags.map((tag) => ({ label: tag, value: tag }))} placeholder="选择标签" />
                    </label>
                </div>
            </Modal>
            <Drawer title="工作流统计" placement="bottom" height="48vh" open={statsOpen} onClose={() => setStatsOpen(false)} destroyOnHidden>
                <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 sm:grid-cols-4 dark:text-stone-400">{renderMetrics()}</div>
            </Drawer>
        </main>
    );
}

function WorkflowSection({
    isLoading,
    projects,
    keyword,
    isCreating,
    emptyTitle,
    emptyDescription,
    onCreate,
    onRename,
    onDelete,
}: {
    isLoading: boolean;
    projects: CloudWorkflow[];
    keyword: string;
    isCreating: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onCreate: () => void;
    onRename: (project: CloudWorkflow, title: string) => void | Promise<void>;
    onDelete: (ids: string[]) => void;
}) {
    return (
        <>
            {isLoading ? (
                <section className="flex min-h-0 flex-1 items-center justify-center"><Spin /></section>
            ) : projects.length ? (
                <div className="thin-scrollbar min-h-0 flex-1 overflow-auto p-4 lg:p-6">
                    <div className="grid gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {projects.map((project) => <CanvasProjectCard key={project.id} project={project} onRename={onRename} onDelete={(id) => onDelete([id])} />)}
                    </div>
                </div>
            ) : (
                <EmptyState title={keyword ? "没有匹配的工作流" : emptyTitle} description={keyword ? "换一个关键词或筛选条件继续查找。" : emptyDescription} action={<Button type="primary" icon={<Plus className="size-4" />} loading={isCreating} onClick={onCreate}>新建工作流</Button>} />
            )}
        </>
    );
}

function WorkflowControls({
    projects,
    allProjects,
    keyword,
    filter,
    selectedIds,
    isCreating,
    onKeywordChange,
    onFilterChange,
    onCreate,
    onDelete,
}: {
    projects: CloudWorkflow[];
    allProjects: CloudWorkflow[];
    keyword: string;
    filter: WorkflowFilter;
    selectedIds: string[];
    isCreating: boolean;
    onKeywordChange: (value: string) => void;
    onFilterChange: (value: WorkflowFilter) => void;
    onCreate: () => void;
    onDelete: (ids: string[]) => void;
}) {
    return (
        <>
            <Input allowClear value={keyword} onChange={(event) => onKeywordChange(event.target.value)} prefix={<Search className="size-4 text-stone-400" />} placeholder="搜索工作流名称" className="!w-full min-[520px]:!w-[220px]" />
            <Segmented
                value={filter}
                onChange={(value) => onFilterChange(value as WorkflowFilter)}
                options={[
                    { label: "全部", value: "all" },
                    { label: "自动更新", value: "linked" },
                    { label: "独立副本", value: "detached" },
                ]}
            />
            <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">显示 {projects.length}/{allProjects.length}</span>
            {selectedIds.length ? <Button className="max-[519px]:flex-1" onClick={() => onDelete(selectedIds)}>删除选中</Button> : null}
            {projects.length ? <Button className="max-[519px]:flex-1" onClick={() => onDelete(projects.map((project) => project.id))}>删除全部</Button> : null}
            <Button className="max-[519px]:flex-1" type="primary" icon={<Plus className="size-4" />} loading={isCreating} onClick={onCreate}>新建工作流</Button>
        </>
    );
}

function CommunitySection({
    mode,
    isLoading,
    items,
    myItems,
    projects,
    onUpload,
    onOpen,
    onSync,
    onDelete,
}: {
    mode: CommunityMode;
    isLoading: boolean;
    items: WorkflowCommunityPost[];
    myItems: WorkflowCommunityPost[];
    projects: CloudWorkflow[];
    onUpload: () => void;
    onOpen: (item: WorkflowCommunityPost) => void;
    onSync: (item: WorkflowCommunityPost) => void;
    onDelete: (item: WorkflowCommunityPost) => void;
}) {
    const visibleItems = mode === "mine" ? myItems : items;
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    return (
        <>
            {isLoading ? (
                <section className="flex min-h-0 flex-1 items-center justify-center"><Spin /></section>
            ) : visibleItems.length ? (
                <div className="thin-scrollbar min-h-0 flex-1 overflow-auto p-4 lg:p-6">
                    <div className="grid gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleItems.map((item) => <CommunityCard key={item.id} item={item} source={projectMap.get(item.sourceWorkflowId)} mine={mode === "mine"} onOpen={() => onOpen(item)} onSync={() => onSync(item)} onDelete={() => onDelete(item)} />)}
                    </div>
                </div>
            ) : (
                <EmptyState title={mode === "mine" ? "还没有上传作品" : "暂无社区工作流"} description={mode === "mine" ? "上传作品会保存当前工作流快照，不会自动跟随后续编辑。" : "换一个关键词或等待更多公开作品。"} action={<Button type="primary" icon={<UploadCloud className="size-4" />} onClick={onUpload}>上传我的作品</Button>} />
            )}
        </>
    );
}

function CommunityControls({ mode, setMode, keyword, locale, onKeywordChange, onLocaleChange, onUpload }: { mode: CommunityMode; setMode: (mode: CommunityMode) => void; keyword: string; locale: "" | "zh-CN" | "en-US"; onKeywordChange: (value: string) => void; onLocaleChange: (value: "" | "zh-CN" | "en-US") => void; onUpload: () => void }) {
    return (
        <>
            <Segmented value={mode} onChange={(value) => setMode(value as CommunityMode)} options={[{ label: "社区工作流", value: "browse" }, { label: "我的作品", value: "mine" }]} />
            {mode === "browse" ? (
                <>
                    <Input allowClear value={keyword} onChange={(event) => onKeywordChange(event.target.value)} prefix={<Search className="size-4 text-stone-400" />} placeholder="搜索社区作品" className="!w-full min-[520px]:!w-[220px]" />
                    <Select value={locale} onChange={onLocaleChange} className="w-full min-[520px]:w-32" options={[{ label: "全部语言", value: "" }, { label: "中文", value: "zh-CN" }, { label: "English", value: "en-US" }]} />
                </>
            ) : null}
            <Button className="max-[519px]:flex-1" icon={<UserRound className="size-4" />} onClick={() => setMode("mine")}>查看我的作品</Button>
            <Button className="max-[519px]:flex-1" type="primary" icon={<UploadCloud className="size-4" />} onClick={onUpload}>上传我的作品</Button>
        </>
    );
}

function CommunityCard({ item, source, mine, onOpen, onSync, onDelete }: { item: WorkflowCommunityPost; source?: CloudWorkflow; mine: boolean; onOpen: () => void; onSync: () => void; onDelete: () => void }) {
    const stale = Boolean(source && source.updatedAt !== item.snapshotWorkflowAt);
    const nodes = item.snapshot?.nodes || [];
    const connections = item.snapshot?.connections || [];
    const sessions = item.snapshot?.chatSessions || [];
    const [detailOpen, setDetailOpen] = useState(false);
    return (
        <>
            <article className="group relative aspect-square min-h-[220px] cursor-pointer overflow-hidden rounded-lg border border-stone-200 bg-card text-stone-900 shadow-none transition hover:-translate-y-0.5 hover:shadow-none sm:aspect-[1.18] dark:border-stone-800 dark:text-stone-100 dark:shadow-sm dark:hover:shadow-md" onClick={() => setDetailOpen(true)}>
                <WorkflowPreviewBackdrop nodes={nodes} connections={connections} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/62 dark:from-black/8 dark:to-black/74" />
                <div className="absolute left-3 right-3 top-3 flex items-center justify-end gap-2 rounded-md border border-white/30 bg-white/80 px-2.5 py-1 text-right text-sm font-semibold shadow-none backdrop-blur sm:left-auto sm:max-w-[76%] dark:border-white/10 dark:bg-stone-950/72 dark:shadow-sm">
                    <span className="truncate">{item.title}</span>
                    <Tag className="m-0" color={item.status === "banned" ? "red" : item.locale === "en-US" ? "cyan" : "green"}>{item.status === "banned" ? "封禁" : item.locale === "en-US" ? "EN" : "中文"}</Tag>
                </div>
                <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <CardMetric label="节点" value={nodes.length} />
                    <CardMetric label="连线" value={connections.length} />
                    <CardMetric label="会话" value={sessions.length} />
                    <CardMetric label="消耗" value="1次" />
                </div>
            </article>
            <Modal title="社区工作流信息" open={detailOpen} centered width={560} onCancel={() => setDetailOpen(false)} footer={null} destroyOnHidden>
                <div className="space-y-4">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
                        <WorkflowPreviewBackdrop nodes={nodes} connections={connections} />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="truncate text-xl font-semibold">{item.title}</h2>
                                <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">来源：{item.sourceWorkflowTitle}</p>
                            </div>
                            <Tag color={item.status === "banned" ? "red" : item.locale === "en-US" ? "cyan" : "green"}>{item.status === "banned" ? "已封禁" : item.locale === "en-US" ? "English" : "中文"}</Tag>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 sm:grid-cols-4 dark:text-stone-400">
                            <HeaderMetric label="节点" value={nodes.length} />
                            <HeaderMetric label="连线" value={connections.length} />
                            <HeaderMetric label="会话" value={sessions.length} />
                            <HeaderMetric label="消耗额度" value="1次创建" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">{(item.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                        {mine && item.status === "banned" ? <p className="rounded-md bg-red-50 p-2 text-xs leading-5 text-red-600 dark:bg-red-950/30 dark:text-red-300">封禁原因：{item.banReason || "未填写"}。封禁 7 天后会自动从我的作品中删除。</p> : null}
                        {mine && stale && item.status === "active" ? <p className="rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">我的工作流已有新版本，可手动同步到社区作品。</p> : null}
                        <span className="block text-xs text-stone-500 dark:text-stone-400">更新于 {formatWorkflowTime(item.updatedAt)}</span>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
                        {mine && stale && item.status === "active" ? <Button onClick={onSync}>同步</Button> : null}
                        {mine ? <Button danger onClick={onDelete}>删除</Button> : null}
                        <Button type="primary" disabled={item.status === "banned"} icon={<Send className="size-4" />} onClick={onOpen}>打开</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

function SideButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
    return <button type="button" className={`flex h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-center text-[11px] transition lg:h-auto lg:flex-row lg:justify-start lg:px-3 lg:py-2 lg:text-left lg:text-sm ${active ? "border-stone-300 text-stone-900 dark:border-stone-700 dark:text-stone-100" : "border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-900 dark:text-stone-400 dark:hover:border-stone-800 dark:hover:text-stone-100"}`} onClick={onClick}>{icon}<span className="w-full truncate leading-4">{label}</span></button>;
}

function HeaderMetric({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
    return <div className={`${wide ? "min-w-28" : "min-w-20"} rounded-md border border-stone-200 bg-stone-50 px-3 py-2 shadow-none dark:border-stone-800 dark:bg-stone-900 dark:shadow-sm`}><div className="text-[11px] text-stone-500 dark:text-stone-400">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function CardMetric({ label, value }: { label: string; value: ReactNode }) {
    return <div className="min-w-0 rounded-md border border-white/25 bg-white/82 px-2 py-1 text-center text-[11px] shadow-none backdrop-blur dark:border-white/10 dark:bg-stone-950/72 dark:shadow-sm"><div className="truncate text-stone-500 dark:text-stone-400">{label}</div><div className="truncate font-semibold text-stone-900 dark:text-stone-100">{value}</div></div>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
    return (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex size-16 items-center justify-center rounded-lg border border-stone-200 bg-card dark:border-stone-800">
                <Sparkles className="size-6 text-stone-400" />
            </div>
            <h2 className="text-xl font-medium">{title}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-500 dark:text-stone-400">{description}</p>
            <div className="mt-6">{action}</div>
        </section>
    );
}

function confirmWorkflowTitle(modal: ReturnType<typeof App.useApp>["modal"], title: string) {
    let value = "";
    return new Promise<string>((resolve) => {
        modal.confirm({
            title: "同步社区作品",
            centered: true,
            content: (
                <div className="py-2">
                    <p className="mb-3 text-sm text-stone-500">请输入“我的工作流”中的名称确认同步：{title}</p>
                    <Input onChange={(event) => (value = event.target.value)} placeholder="输入工作流名称" />
                </div>
            ),
            okText: "同步",
            cancelText: "取消",
            onOk: () => resolve(value),
            onCancel: () => resolve(""),
        });
    });
}

function formatWorkflowTime(value: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
}
