"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { App, Button, Input, Modal, Radio, Spin, Tag } from "antd";
import { GitFork, Lock, Star } from "lucide-react";

import { fetchWorkflowShareByPath, forkWorkflowShareByPath, toggleWorkflowShareStar, verifyWorkflowShareByPath, type WorkflowSharePreview } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useWorkflowModals } from "@/hooks/use-workflow-modals";
import { useUserStore } from "@/stores/use-user-store";
import { WorkflowReadonlyCanvas } from "@/app/(user)/canvas/components/workflow-readonly-canvas";

export default function WorkflowPathSharePage() {
    const params = useParams<{ username: string; workflowSlug: string }>();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const { message, modal } = App.useApp();
    const { requestWorkflowName } = useWorkflowModals();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const [preview, setPreview] = useState<WorkflowSharePreview | null>(null);
    const [password, setPassword] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isReady) return;
        setIsLoading(true);
        fetchWorkflowShareByPath(token || undefined, params.username, params.workflowSlug, accessToken)
            .then(setPreview)
            .catch((error) => message.error(error instanceof Error ? error.message : "读取分享失败"))
            .finally(() => setIsLoading(false));
    }, [accessToken, isReady, message, params.username, params.workflowSlug, token]);

    const verify = async () => {
        try {
            const result = await verifyWorkflowShareByPath(token || undefined, params.username, params.workflowSlug, password);
            setAccessToken(result.shareAccessToken);
            setPreview(result.preview);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "密码验证失败");
        }
    };

    const starShare = async () => {
        if (!token) {
            router.push(localizedPath(`/login?redirect=/${params.username}/${params.workflowSlug}`));
            return;
        }
        try {
            const result = await toggleWorkflowShareStar(token, params.username, params.workflowSlug);
            setPreview((current) => (current ? { ...current, starred: result.starred, starCount: result.starCount } : current));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Star 失败");
        }
    };

    const forkShare = async () => {
        if (!token) {
            router.push(localizedPath(`/login?redirect=/${params.username}/${params.workflowSlug}`));
            return;
        }
        const slug = await requestWorkflowName({ title: "Fork 工作流", username: user?.username, okText: "继续" });
        if (!slug) return;
        let mode: "detached" | "linked" = "detached";
        modal.confirm({
            title: "Fork 到我的工作流",
            width: 560,
            content: (
                <div className="space-y-4 py-2">
                    <div className="rounded-lg border bg-stone-50 px-3 py-2 text-sm dark:bg-stone-900">
                        {user?.username || "me"}/{slug}
                    </div>
                    <Radio.Group className="grid gap-3" defaultValue="detached" onChange={(event) => (mode = event.target.value)}>
                        <Radio value="detached">独立副本</Radio>
                        <Radio value="linked">开启自动更新</Radio>
                    </Radio.Group>
                    <p className="text-sm leading-6 text-stone-500">开启自动更新后，原作者更新分享时，你的工作流内容会跟随更新并可能被覆盖。</p>
                </div>
            ),
            okText: "Fork",
            cancelText: "取消",
            onOk: async () => {
                try {
                    const workflow = await forkWorkflowShareByPath(token, params.username, params.workflowSlug, { slug, mode, password, shareAccessToken: accessToken });
                    await hydrateUser();
                    router.push(localizedPath(`/canvas/${workflow.id}`));
                } catch (error) {
                    const text = error instanceof Error ? error.message : "Fork 失败";
                    if (text.includes("暂无工作流创建次数")) {
                        Modal.confirm({
                            title: "工作流创建次数不足",
                            content: "当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。",
                            okText: "去购买套餐",
                            cancelText: "去完成 KYC 认证",
                            onOk: () => router.push(localizedPath("/pricing")),
                            onCancel: () => router.push(localizedPath("/pricing")),
                        });
                    } else {
                        message.error(text);
                    }
                }
            },
        });
    };

    if (!isReady || isLoading) {
        return <main className="grid h-full min-h-screen place-items-center bg-background"><Spin /></main>;
    }

    if (preview?.requiresPassword) {
        return (
            <main className="grid min-h-screen place-items-center bg-background px-6">
                <section className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-stone-950">
                    <Lock className="mb-4 size-8 text-stone-500" />
                    <h1 className="text-xl font-semibold">请输入分享密码进入分享预览</h1>
                    <div className="mt-6 grid gap-4">
                        <Input.Password value={password} onChange={(event) => setPassword(event.target.value)} onPressEnter={verify} />
                        <Button type="primary" block onClick={verify}>进入分享预览</Button>
                    </div>
                </section>
            </main>
        );
    }

    if (!preview) {
        return (
            <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
                <section>
                    <h1 className="text-xl font-semibold">分享不存在或已失效</h1>
                    <Button className="mt-5" onClick={() => router.push(localizedPath("/canvas"))}>返回工作流</Button>
                </section>
            </main>
        );
    }

    return (
        <WorkflowReadonlyCanvas
            workflow={preview.snapshot}
            overlay={
            <header className="absolute left-0 right-0 top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b bg-white/85 px-6 py-4 backdrop-blur dark:bg-stone-950/85">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-xl font-semibold">{preview.title || preview.slug}</h1>
                    <Tag>只读预览</Tag>
                    <Tag color="gold">Star {preview.starCount}</Tag>
                </div>
                <div className="flex items-center gap-2">
                    <Button icon={<Star className={preview.starred ? "size-4 fill-current" : "size-4"} />} onClick={() => void starShare()}>{preview.starred ? "已 Star" : "Star"}</Button>
                    <Button type="primary" icon={<GitFork className="size-4" />} onClick={() => void forkShare()}>Fork 运行</Button>
                </div>
            </header>
            }
        />
    );
}
