"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Modal, Spin, Tag } from "antd";
import { Plus } from "lucide-react";

import { createWorkflow, deleteWorkflow, fetchWorkflows, updateWorkflow, type CloudWorkflow } from "@/services/api/workflows";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasProjectCard } from "./components/canvas-project-card";
import { useCanvasStore } from "./stores/use-canvas-store";
import { useCanvasUiStore } from "./stores/use-canvas-ui-store";

const creditsMessage = "当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。";

export default function CanvasPage() {
    const { message, modal } = App.useApp();
    const router = useRouter();
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
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace("/login?redirect=/canvas");
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
            onOk: () => router.push("/pricing"),
            onCancel: () => router.push("/pricing?kyc=1"),
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
            router.push(`/canvas/${workflow.id}`);
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

    if (!isReady || !token) {
        return <main className="grid h-full place-items-center bg-background" />;
    }

    return (
        <main className="h-full overflow-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6 dark:border-stone-800">
                    <div>
                        <p className="text-xs text-stone-500">云端工作流库</p>
                        <h1 className="mt-3 text-3xl font-semibold">Aivro</h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                            <Tag color="blue">剩余创建次数 {user?.workflowCreateCredits ?? 0}</Tag>
                            <span>所有工作流已保存到云端数据库。</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.length ? (
                            <Button onClick={() => deleteProjects(selectedIds)}>
                                删除选中
                            </Button>
                        ) : null}
                        {projects.length ? <Button onClick={() => deleteProjects(projects.map((project) => project.id))}>删除全部</Button> : null}
                        <Button type="primary" icon={<Plus className="size-4" />} loading={isCreating} onClick={createAndEnter}>
                            新建工作流
                        </Button>
                    </div>
                </header>

                {isLoading ? (
                    <section className="flex min-h-[360px] items-center justify-center border-y border-stone-200 text-sm text-stone-500 dark:border-stone-800">
                        <Spin />
                    </section>
                ) : projects.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {projects.map((project) => (
                            <CanvasProjectCard key={project.id} project={project} onRename={renameProject} onDelete={(id) => deleteProjects([id])} />
                        ))}
                    </div>
                ) : (
                    <section className="flex min-h-[360px] flex-col items-center justify-center border-y border-stone-200 text-center dark:border-stone-800">
                        <h2 className="text-xl font-medium">还没有云端工作流</h2>
                        <p className="mt-3 text-sm text-stone-500">新建工作流会消耗 1 次创建次数，并保存到你的账号。</p>
                        <Button type="primary" className="mt-6" icon={<Plus className="size-4" />} loading={isCreating} onClick={createAndEnter}>
                            新建工作流
                        </Button>
                    </section>
                )}
            </div>
        </main>
    );
}
