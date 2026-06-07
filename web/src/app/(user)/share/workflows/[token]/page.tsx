"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar, Button, Input, Modal, Radio, Spin, Tag } from "antd";
import { Copy, Lock } from "lucide-react";

import { copyWorkflowShare, fetchWorkflowShare, verifyWorkflowShare, type WorkflowSharePreview } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasNodeType } from "@/app/(user)/canvas/types";

export default function WorkflowSharePage() {
    const params = useParams<{ token: string }>();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const { message, modal } = App.useApp();
    const token = useUserStore((state) => state.token);
    const isReady = useUserStore((state) => state.isReady);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const [preview, setPreview] = useState<WorkflowSharePreview | null>(null);
    const [password, setPassword] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace(localizedPath(`/login?redirect=/share/workflows/${params.token}`));
            return;
        }
        setIsLoading(true);
        fetchWorkflowShare(token, params.token, accessToken)
            .then(setPreview)
            .catch((error) => message.error(error instanceof Error ? error.message : "读取分享失败"))
            .finally(() => setIsLoading(false));
    }, [accessToken, isReady, message, params.token, router, token]);

    const nodes = preview?.snapshot?.nodes || [];
    const bounds = useMemo(() => {
        if (!nodes.length) return { minX: 0, minY: 0 };
        return {
            minX: Math.min(...nodes.map((node) => node.position.x)),
            minY: Math.min(...nodes.map((node) => node.position.y)),
        };
    }, [nodes]);

    const verify = async () => {
        if (!token) return;
        try {
            const result = await verifyWorkflowShare(token, params.token, password);
            setAccessToken(result.shareAccessToken);
            setPreview(result.preview);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "密码验证失败");
        }
    };

    const copyShare = () => {
        let selectedMode: "detached" | "linked" = "detached";
        modal.confirm({
            title: "复制到我的云端工作流",
            width: 560,
            content: (
                <div className="py-2">
                    <Radio.Group className="grid gap-3" defaultValue="detached" onChange={(event) => (selectedMode = event.target.value)}>
                        <Radio value="detached">区分与主节点的独立工作流</Radio>
                        <Radio value="linked">保存与主节点的更新工作流</Radio>
                    </Radio.Group>
                    <p className="mt-4 text-sm text-stone-500">选择“保存与主节点的更新工作流”后，该模式会持续跟随原分享工作流更新。原作者更新分享后，你当前这份工作流内容会被覆盖。</p>
                </div>
            ),
            okText: "复制",
            cancelText: "取消",
            onOk: async () => {
                if (!token) return;
                try {
                    const workflow = await copyWorkflowShare(token, params.token, { mode: selectedMode, password, shareAccessToken: accessToken });
                    await hydrateUser();
                    router.push(localizedPath(`/canvas/${workflow.id}`));
                } catch (error) {
                    const text = error instanceof Error ? error.message : "复制失败";
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

    if (!isReady || !token || isLoading) {
        return <main className="grid h-full min-h-screen place-items-center bg-background"><Spin /></main>;
    }

    if (preview?.requiresPassword) {
        return (
            <main className="grid min-h-screen place-items-center bg-background px-6">
                <section className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm dark:bg-stone-950">
                    <Lock className="mb-4 size-8 text-stone-500" />
                    <h1 className="text-xl font-semibold">请输入分享密码</h1>
                    <Input.Password className="mt-5" value={password} onChange={(event) => setPassword(event.target.value)} onPressEnter={verify} />
                    <Button type="primary" block className="mt-4" onClick={verify}>进入分享预览</Button>
                </section>
            </main>
        );
    }

    return (
        <main className="relative h-screen overflow-hidden bg-[#f7f4ee] text-stone-950 dark:bg-stone-950 dark:text-stone-100">
            <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b bg-white/80 px-6 py-4 backdrop-blur dark:bg-stone-950/80">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-xl font-semibold">{preview?.title || "分享工作流"}</h1>
                    <Button type="primary" icon={<Copy className="size-4" />} onClick={copyShare}>复制</Button>
                    <Tag>只读预览</Tag>
                </div>
            </header>
            <section className="absolute inset-0 overflow-auto pt-20">
                <div className="relative min-h-[1200px] min-w-[1600px]">
                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            className="absolute overflow-hidden rounded-lg border bg-white p-3 shadow-sm dark:bg-stone-900"
                            style={{ left: node.position.x - bounds.minX + 80, top: node.position.y - bounds.minY + 80, width: node.width, minHeight: Math.min(node.height, 260) }}
                        >
                            <div className="mb-2 truncate text-sm font-medium">{node.title}</div>
                            {node.type === CanvasNodeType.Image && node.metadata?.content ? <img src={node.metadata.content} alt="" className="max-h-48 w-full object-contain" /> : null}
                            {node.type === CanvasNodeType.Video && node.metadata?.content ? <video src={node.metadata.content} className="max-h-48 w-full" controls /> : null}
                            {node.type === CanvasNodeType.Text ? <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{node.metadata?.content || node.metadata?.prompt || ""}</p> : null}
                        </div>
                    ))}
                </div>
            </section>
            <aside className="absolute bottom-5 right-5 flex items-center gap-3 rounded-xl border bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:bg-stone-900/90">
                <Avatar src={preview?.owner?.avatarUrl}>{preview?.owner?.displayName?.slice(0, 1) || preview?.owner?.username?.slice(0, 1)}</Avatar>
                <div>
                    <p className="text-sm font-medium">{preview?.owner?.displayName || preview?.owner?.username || "分享用户"}</p>
                    <p className="max-w-60 truncate text-xs text-stone-500">{preview?.title}</p>
                </div>
            </aside>
        </main>
    );
}
