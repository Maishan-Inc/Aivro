"use client";

import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import { PromptReverseBilling } from "@/components/prompt-reverse-billing";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";
import { fetchUserGenerationTasks } from "@/services/api/explore";
import type { GenerationTaskView } from "@/services/api/image";
import { formatDateTime } from "@/lib/datetime";

const statuses: Record<string, string> = { submitting: "提交中", queued: "排队中", executing: "生成中", succeeded: "成功", failed: "失败", canceled: "已撤销" };
const running = (task: GenerationTaskView) => ["submitting", "queued", "executing"].includes(task.status);

export function RequestTasks() {
    const { tr } = useI18n();
    const token = useUserStore((state) => state.token);
    const userId = useUserStore((state) => state.user?.id);
    const query = useQuery({ queryKey: ["wallet-tasks", userId, token], queryFn: () => fetchUserGenerationTasks(token), enabled: Boolean(token && userId), refetchInterval: 3000 });
    return <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-base font-semibold">{tr("请求日志")}</h2>
        {query.error ? <p className="mb-3 text-sm text-destructive">{tr(query.error.message)}</p> : null}
        <Table<GenerationTaskView> rowKey="id" loading={query.isLoading} dataSource={query.data || []} size="small" scroll={{ x: 780 }} pagination={{ pageSize: 10 }} columns={[
            { title: tr("时间"), dataIndex: "createdAt", render: (value: string) => <span data-i18n-skip>{formatDateTime(value)}</span> },
            { title: tr("模型"), dataIndex: "model", render: (value: string) => <span data-i18n-skip>{value}</span> },
            { title: tr("状态 / 进度"), key: "status", render: (_, task) => <span data-i18n-skip>{tr(statuses[task.status] || task.status)}{task.status === "queued" ? ` · ${tr("队列位置 {0}").replace("{0}", String(task.queuePosition))}` : task.status === "executing" && task.progress > 0 ? ` · ${task.progress}%` : ""}</span> },
            { title: tr("算力点"), key: "credits", render: (_, task) => task.path === "/prompt-reverse" && running(task) ? tr("待统一扣费") : task.credits },
            { title: tr("任务报错"), dataIndex: "error", render: (value: string) => <span className="text-destructive">{tr(value)}</span> },
        ]} expandable={{ rowExpandable: (task) => Boolean(task.items?.length), expandedRowRender: (task) => <PromptReverseBilling items={task.items || []} credits={task.credits} settled={!running(task)} /> }} />
    </section>;
}
