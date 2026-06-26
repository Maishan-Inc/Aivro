"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { App, Button, Tag } from "antd";
import { ArrowRight, BadgeCheck, BookOpen, ImagePlus, Layers3, Sparkles, UserCircle, WalletCards } from "lucide-react";

import { CreditSymbol } from "@/constant/credits";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { createKycSession, fetchKycStatus } from "@/services/api/billing";
import { fetchWorkflows, type CloudWorkflow } from "@/services/api/workflows";
import { useUserStore } from "@/stores/use-user-store";

type KycStatus = Awaited<ReturnType<typeof fetchKycStatus>>;

export default function ConsolePage() {
    const { message } = App.useApp();
    const localizedPath = useLocalizedPath();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const [workflows, setWorkflows] = useState<CloudWorkflow[]>([]);
    const [kyc, setKyc] = useState<KycStatus | null>(null);
    const [kycLoading, setKycLoading] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetchWorkflows(token, { pageSize: 200 }).then((data) => setWorkflows(data.items)).catch(() => undefined);
        fetchKycStatus(token).then(setKyc).catch(() => undefined);
    }, [token]);

    const stats = useMemo(
        () =>
            workflows.reduce(
                (acc, item) => ({
                    nodes: acc.nodes + item.nodes.length,
                }),
                { nodes: 0 },
            ),
        [workflows],
    );

    const startKyc = async () => {
        if (!token) return;
        setKycLoading(true);
        try {
            const result = await createKycSession(token);
            window.location.href = result.url;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建 KYC 认证失败");
        } finally {
            setKycLoading(false);
        }
    };

    return (
        <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-normal">控制台首页</h1>
                            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">管理工作流、余额、身份认证和个人资料，创作工具仍保持原页面体验。</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="primary" href={localizedPath("/canvas")} icon={<Layers3 className="size-4" />}>
                                我的工作流
                            </Button>
                            <Button href={localizedPath("/image")} icon={<ImagePlus className="size-4" />}>
                                生图工作台
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={<CreditSymbol />} label="当前余额" value={(user?.credits ?? 0).toLocaleString()} helper="算力点" />
                    <MetricCard icon={<Sparkles className="size-5" />} label="工作流创建次数" value={(user?.workflowCreateCredits ?? 0).toLocaleString()} helper="新建云端工作流额度" />
                    <MetricCard icon={<Layers3 className="size-5" />} label="我的工作流" value={workflows.length.toLocaleString()} helper={`${stats.nodes} 个节点`} />
                    <MetricCard icon={<BadgeCheck className="size-5" />} label="KYC 身份验证" value={formatKycStatus(kyc?.status)} helper={kyc?.enabled ? "可获取认证奖励" : "管理员未开启"} />
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold">常用入口</h2>
                            <Link href={localizedPath("/console/profile")} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100">
                                个人中心 <ArrowRight className="size-4" />
                            </Link>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <QuickLink href="/canvas" icon={<Layers3 className="size-5" />} title="我的工作流" description="继续编辑、重命名、删除和新建工作流。" />
                            <QuickLink href="/console/shares" icon={<BookOpen className="size-5" />} title="我的分享" description="查看 Fork 的独立副本和自动更新工作流。" />
                            <QuickLink href="/console/wallet" icon={<WalletCards className="size-5" />} title="我的钱包" description="查看算力点余额、额度和扣费说明。" />
                            <QuickLink href="/console/profile" icon={<UserCircle className="size-5" />} title="个人中心" description="修改头像、名称并发起 KYC 身份验证。" />
                        </div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                        <h2 className="text-base font-semibold">身份验证</h2>
                        <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">完成 KYC 后可按后台配置领取算力点和工作流创建次数奖励。</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Tag className="m-0">{formatKycStatus(kyc?.status)}</Tag>
                            {kyc?.rewards ? <Tag className="m-0">奖励 {kyc.rewards.credits} 算力点 / {kyc.rewards.workflowCreateCredits} 次工作流</Tag> : null}
                        </div>
                        <Button className="mt-5" block type="primary" disabled={!kyc?.enabled || kyc?.status === "approved"} loading={kycLoading} onClick={startKyc}>
                            {kyc?.status === "approved" ? "已完成认证" : "开始 KYC 认证"}
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
    return (
        <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100">{icon}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{helper}</div>
        </div>
    );
}

function QuickLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
    const localizedPath = useLocalizedPath();
    return (
        <Link href={localizedPath(href)} className="rounded-lg border border-stone-200 p-4 transition hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600">
            <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-900">{icon}</div>
            <div className="font-medium">{title}</div>
            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{description}</p>
        </Link>
    );
}

function formatKycStatus(status?: string) {
    if (status === "approved") return "已通过";
    if (status === "pending") return "认证中";
    if (status === "rejected") return "未通过";
    if (status === "expired") return "已过期";
    return "未认证";
}
