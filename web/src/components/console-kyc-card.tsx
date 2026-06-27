"use client";

import { Button, Tag } from "antd";
import { BadgeCheck } from "lucide-react";

import { useI18n } from "@/hooks/use-i18n";
import type { fetchKycStatus } from "@/services/api/billing";

type KycStatus = Awaited<ReturnType<typeof fetchKycStatus>>;

export function ConsoleKycCard({ kyc, loading, onStart }: { kyc: KycStatus | null; loading: boolean; onStart: () => void }) {
    const { locale } = useI18n();
    const en = locale === "en-US";
    const rewards = kyc?.rewards;
    const rewardText = rewards ? (en ? `Reward on pass: ${rewards.credits} Credits, ${rewards.workflowCreateCredits} workflow creations.` : `通过奖励：${rewards.credits} 算力点，${rewards.workflowCreateCredits} 次工作流创建次数。`) : "";

    return (
        <div className="flex h-full flex-col rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-900">
                <BadgeCheck className="size-5" />
            </div>
            <h2 className="text-base font-semibold">{en ? "KYC verification" : "KYC 身份验证"}</h2>
            <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{en ? "After verification, rewards are issued based on backend settings. Verification is handled by the KYC provider configured by the administrator." : "通过验证后按后台配置发放奖励。认证服务由管理员配置的 KYC 提供商处理。"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
                <Tag className="m-0">{formatKycStatus(kyc?.status, en)}</Tag>
                {kyc?.enabled ? <Tag className="m-0">{en ? "Enabled" : "已启用"}</Tag> : <Tag className="m-0">{en ? "Not configured" : "未配置"}</Tag>}
            </div>
            {rewardText ? <p className="mt-4 text-sm leading-6 text-stone-500 dark:text-stone-400">{rewardText}</p> : null}
            <div className="mt-auto pt-8">
                <Button block type="primary" disabled={!kyc?.enabled || kyc?.status === "approved"} loading={loading} onClick={onStart}>
                    {kyc?.status === "approved" ? (en ? "Verification completed" : "已完成认证") : en ? "Start KYC verification" : "开始 KYC 认证"}
                </Button>
            </div>
        </div>
    );
}

function formatKycStatus(status: string | undefined, en: boolean) {
    if (status === "approved") return en ? "Approved" : "已通过";
    if (status === "pending") return en ? "Pending" : "认证中";
    if (status === "rejected") return en ? "Rejected" : "未通过";
    if (status === "expired") return en ? "Expired" : "已过期";
    return en ? "Not verified" : "未认证";
}
