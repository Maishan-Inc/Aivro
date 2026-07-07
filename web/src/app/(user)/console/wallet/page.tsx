"use client";

import type { ReactNode } from "react";
import { Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, History, Plus, WalletCards } from "lucide-react";

import { CreditSymbol } from "@/constant/credits";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useUserStore } from "@/stores/use-user-store";

type WalletLog = {
    id: string;
    type: string;
    amount: number;
    balance: number;
    remark: string;
    createdAt: string;
};

export default function ConsoleWalletPage() {
    const localizedPath = useLocalizedPath();
    const user = useUserStore((state) => state.user);
    const columns: ColumnsType<WalletLog> = [
        { title: "时间", dataIndex: "createdAt" },
        { title: "类型", dataIndex: "type" },
        { title: "变动", dataIndex: "amount", render: (value: number) => <span className={value >= 0 ? "text-emerald-600" : "text-red-600"}>{value >= 0 ? `+${value}` : value}</span> },
        { title: "余额", dataIndex: "balance" },
        { title: "说明", dataIndex: "remark" },
    ];

    return (
        <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-normal">我的钱包</h1>
                            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">查看当前余额、工作流额度和使用扣费记录。</p>
                        </div>
                        <Button type="primary" href={localizedPath("/pricing")} icon={<Plus className="size-4" />}>
                            购买套餐
                        </Button>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <WalletMetric icon={<CreditSymbol />} label="当前余额" value={(user?.credits ?? 0).toLocaleString()} helper="可用于图片、视频、3D 与 AI 请求扣费" />
                    <WalletMetric icon={<CreditCard className="size-5" />} label="工作流创建次数" value={(user?.workflowCreateCredits ?? 0).toLocaleString()} helper="新建云端工作流会消耗次数" />
                    <WalletMetric icon={<WalletCards className="size-5" />} label="当前套餐" value="Free" helper="套餐状态后续接入账单接口后展示" />
                </section>

                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">使用扣费</h2>
                            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">扣费明细接口尚未开放给用户侧，当前先展示钱包入口和空状态。</p>
                        </div>
                        <Tag className="m-0" icon={<History className="size-3.5" />}>后续接入明细</Tag>
                    </div>
                    <Table<WalletLog> columns={columns} dataSource={[]} rowKey="id" pagination={false} scroll={{ x: 620 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无扣费记录" /> }} />
                </section>
            </div>
        </div>
    );
}

function WalletMetric({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
    return (
        <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100">{icon}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
            <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{helper}</p>
        </div>
    );
}
