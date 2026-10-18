"use client";

import { Button, Tag } from "antd";
import { BadgeCheck } from "lucide-react";

import type { fetchKycStatus } from "@/services/api/billing";

type KycStatus = Awaited<ReturnType<typeof fetchKycStatus>>;

export function ConsoleKycCard({ kyc, loading, onStart }: { kyc: KycStatus | null; loading: boolean; onStart: () => void }) {
    const rewards = kyc?.rewards;
    const rewardText = rewards ? `通过奖励：${rewards.credits} 算力点，${rewards.workflowCreateCredits} 次工作流创建次数。` : "";

    return (
        <div className="flex h-full flex-col rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-900">
                <BadgeCheck className="size-5" />
            </div>
            <h2 className="text-base font-semibold">KYC 身份验证</h2>
            <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">通过验证后按后台配置发放奖励。认证服务由管理员配置的 KYC 提供商处理。</p>
            <div className="mt-4 flex flex-wrap gap-2">
                <Tag className="m-0">{formatKycStatus(kyc?.status)}</Tag>
                {kyc?.enabled ? <Tag className="m-0">已启用</Tag> : <Tag className="m-0">未配置</Tag>}
            </div>
            {rewardText ? <p className="mt-4 text-sm leading-6 text-stone-500 dark:text-stone-400">{rewardText}</p> : null}
            <div className="mt-auto pt-8">
                <Button block type="primary" disabled={!kyc?.enabled || kyc?.status === "approved"} loading={loading} onClick={onStart}>
                    {kyc?.status === "approved" ? "已完成认证" : "开始 KYC 认证"}
                </Button>
            </div>
        </div>
    );
}

function formatKycStatus(status: string | undefined) {
    if (status === "approved") return "已通过";
    if (status === "pending") return "认证中";
    if (status === "rejected") return "未通过";
    if (status === "expired") return "已过期";
    return "未认证";
}
