"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Empty, Select, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, Plus, RefreshCw, WalletCards } from "lucide-react";

import { CreditSymbol } from "@/constant/credits";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";
import { formatDateTime, formatNumber } from "@/lib/datetime";
import { creditLogTypeLabels } from "@/lib/support-tickets";
import { fetchCreditLogs, type CreditLog } from "@/services/api/billing";

export default function ConsoleWalletPage() {
    const localizedPath = useLocalizedPath();
    const { tr } = useI18n();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [type, setType] = useState("");
    const query = useQuery({ queryKey: ["wallet-credit-logs", user?.id, type, page, pageSize], queryFn: () => fetchCreditLogs(token, { type, page, pageSize }), enabled: Boolean(token && user?.id), retry: false, staleTime: 0 });

    useEffect(() => { if (token) void hydrateUser(); }, [token, hydrateUser]);
    useEffect(() => { setPage(1); setType(""); }, [user?.id]);

    const columns: ColumnsType<CreditLog> = [
        { title: tr("时间"), dataIndex: "createdAt", render: (value: string) => formatDateTime(value) },
        { title: tr("类型"), dataIndex: "type", render: (value: string) => tr(creditLogTypeLabels[value] || value) },
        { title: tr("模型"), dataIndex: "model", render: (value: string) => <span data-i18n-skip>{value || "—"}</span> },
        { title: tr("变动"), dataIndex: "amount", render: (value: number) => <span className={value >= 0 ? "text-emerald-600" : "text-red-600"}>{value > 0 ? "+" : ""}{formatNumber(value)}</span> },
        { title: tr("余额"), dataIndex: "balance", render: (value: number) => formatNumber(value) },
        { title: tr("说明"), dataIndex: "remark", render: (value: string, item) => <span data-i18n-skip>{item.type === "admin_adjust" && value !== "后台手动调整" ? value : tr(value)}</span> },
        { title: tr("操作"), fixed: "right", width: 200, render: (_, item) => item.amount < 0 ? <Button type="link" className="px-0" href={localizedPath(`/console/tickets?create=1&creditLogId=${encodeURIComponent(item.id)}`)}>{tr("对这笔扣费有疑问")}</Button> : "—" },
    ];

    return (
        <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-normal">{tr("我的钱包")}</h1>
                            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{tr("查看当前余额、工作流额度和使用扣费记录。")}</p>
                        </div>
                        <Button type="primary" href={localizedPath("/pricing")} icon={<Plus className="size-4" />}>
                            {tr("购买套餐")}
                        </Button>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <WalletMetric icon={<CreditSymbol />} label={tr("当前余额")} value={formatNumber(user?.credits ?? 0)} helper={tr("可用于图片、视频、3D 与 AI 请求扣费")} />
                    <WalletMetric icon={<CreditCard className="size-5" />} label={tr("工作流创建次数")} value={formatNumber(user?.workflowCreateCredits ?? 0)} helper={tr("新建云端工作流会消耗次数")} />
                    <WalletMetric icon={<WalletCards className="size-5" />} label={tr("当前套餐")} value="Free" helper={tr("套餐状态后续接入账单接口后展示")} />
                </section>

                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">{tr("使用扣费")}</h2>
                            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{tr("查看真实算力点流水，对扣费有疑问时可填写关联工单。")}</p>
                        </div>
                        <Space wrap><Select aria-label={tr("筛选流水类型")} value={type} className="min-w-36" onChange={(value) => { setType(value); setPage(1); }} options={[{ value: "", label: tr("全部变动") }, ...Object.entries(creditLogTypeLabels).map(([value, label]) => ({ value, label: tr(label) }))]} /><Button type="text" icon={<RefreshCw className="size-4" />} loading={query.isFetching} onClick={() => { void query.refetch(); void hydrateUser(); }}>{tr("刷新")}</Button></Space>
                    </div>
                    {query.isError ? <Alert className="mb-4" type="error" showIcon title={tr(query.error instanceof Error ? query.error.message : "读取扣费记录失败")} /> : null}
                    <Table<CreditLog> columns={columns} dataSource={query.data?.items || []} rowKey="id" loading={query.isFetching} pagination={{ current: page, pageSize, total: query.data?.total || 0, showSizeChanger: true, onChange: (value, size) => { setPage(size === pageSize ? value : 1); setPageSize(size); } }} scroll={{ x: 1100 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr(query.isError ? "暂时无法加载扣费记录" : "暂无扣费记录")} /> }} />
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
