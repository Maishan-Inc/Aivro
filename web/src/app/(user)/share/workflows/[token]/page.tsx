"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { App, Button, Input, Modal, Radio, Spin, Tag } from "antd";
import { Copy, Lock } from "lucide-react";

import { copyWorkflowShare, fetchWorkflowShare, verifyWorkflowShare, type WorkflowSharePreview } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useWorkflowModals } from "@/hooks/use-workflow-modals";
import { useUserStore } from "@/stores/use-user-store";
import { WorkflowReadonlyCanvas } from "@/app/(user)/canvas/components/workflow-readonly-canvas";

export default function WorkflowSharePage() {
    const params = useParams<{ token: string }>();
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

    const copyShare = async () => {
        const slug = await requestWorkflowName({ title: "Fork 工作流", username: user?.username, okText: "继续" });
        if (!slug) return;
        let selectedMode: "detached" | "linked" = "detached";
        modal.confirm({
            title: "Fork 到我的云端工作流",
            width: 560,
            content: (
                <div className="py-2">
                    <Radio.Group className="grid gap-3" defaultValue="detached" onChange={(event) => (selectedMode = event.target.value)}>
                        <Radio value="detached">独立副本</Radio>
                        <Radio value="linked">开启自动更新</Radio>
                    </Radio.Group>
                    <p className="mt-4 text-sm text-stone-500">开启自动更新后，原作者更新分享时，你的工作流内容会跟随更新并可能被覆盖。</p>
                </div>
            ),
            okText: "Fork",
            cancelText: "取消",
            onOk: async () => {
                if (!token) return;
                try {
                    const workflow = await copyWorkflowShare(token, params.token, { slug, mode: selectedMode, password, shareAccessToken: accessToken });
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

    if (!isReady || !token || isLoading) {
        return <main className="grid h-full min-h-screen place-items-center bg-background"><Spin /></main>;
    }

    if (preview?.requiresPassword) {
        return (
            <main className="grid min-h-screen place-items-center bg-background px-6">
                <section className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm dark:bg-stone-950">
                    <Lock className="mb-4 size-8 text-stone-500" />
                    <h1 className="text-xl font-semibold">请输入分享密码</h1>
                    <div className="mt-6 grid gap-4">
                        <Input.Password value={password} onChange={(event) => setPassword(event.target.value)} onPressEnter={verify} />
                        <Button type="primary" block onClick={verify}>进入分享预览</Button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <WorkflowReadonlyCanvas
            workflow={preview?.snapshot}
            overlay={
            <header className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between border-b bg-white/80 px-6 py-4 backdrop-blur dark:bg-stone-950/80">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-xl font-semibold">{preview?.title || "分享工作流"}</h1>
                    <Button type="primary" icon={<Copy className="size-4" />} onClick={() => void copyShare()}>Fork</Button>
                    <Tag>只读预览</Tag>
                </div>
            </header>
            }
        />
    );
}
