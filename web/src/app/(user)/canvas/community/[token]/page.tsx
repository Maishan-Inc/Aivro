"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar, Spin, Tag } from "antd";

import { fetchCommunityWorkflow, type WorkflowCommunityPreview } from "@/services/api/workflows";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasNodeType } from "@/app/(user)/canvas/types";

export default function WorkflowCommunityPage() {
    const params = useParams<{ token: string }>();
    const router = useRouter();
    const localizedPath = useLocalizedPath();
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const isReady = useUserStore((state) => state.isReady);
    const [preview, setPreview] = useState<WorkflowCommunityPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace(localizedPath(`/login?redirect=/canvas/community/${params.token}`));
            return;
        }
        setIsLoading(true);
        fetchCommunityWorkflow(token, params.token)
            .then(setPreview)
            .catch((error) => message.error(error instanceof Error ? error.message : "读取社区作品失败"))
            .finally(() => setIsLoading(false));
    }, [isReady, localizedPath, message, params.token, router, token]);

    const nodes = preview?.snapshot?.nodes || [];
    const bounds = useMemo(() => {
        if (!nodes.length) return { minX: 0, minY: 0 };
        return {
            minX: Math.min(...nodes.map((node) => node.position.x)),
            minY: Math.min(...nodes.map((node) => node.position.y)),
        };
    }, [nodes]);

    if (!isReady || !token || isLoading) {
        return <main className="grid h-full min-h-screen place-items-center bg-background"><Spin /></main>;
    }

    return (
        <main className="relative h-screen overflow-hidden bg-[#f7f4ee] text-stone-950 dark:bg-stone-950 dark:text-stone-100">
            <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b bg-white/80 px-6 py-4 backdrop-blur dark:bg-stone-950/80">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-xl font-semibold">{preview?.title || "社区工作流"}</h1>
                    <Tag color={preview?.locale === "en-US" ? "cyan" : "green"}>{preview?.locale === "en-US" ? "English" : "中文"}</Tag>
                    <Tag>社区只读</Tag>
                </div>
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                    {(preview?.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
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
                    <p className="text-sm font-medium">{preview?.owner?.displayName || preview?.owner?.username || "社区用户"}</p>
                    <p className="max-w-60 truncate text-xs text-stone-500">{preview?.title}</p>
                </div>
            </aside>
        </main>
    );
}
