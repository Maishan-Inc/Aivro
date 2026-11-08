"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Card, DatePicker, Descriptions, Drawer, Empty, Flex, Image, Input, Progress, Select, Space, Table, Tag, Typography } from "antd";
import { fetchAdminGenerationTask, fetchAdminGenerationTasks, type AdminGenerationTask } from "@/services/api/admin-generation-tasks";
import { generationSections } from "@/services/api/generation-retention";
import { formatDateTime } from "@/lib/datetime";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";
import { Model3DPreview } from "@/components/model-3d-preview";
import { adminRealtimeQueryOptions } from "../admin-query-options";

const statuses: Record<string, string> = { queued: "排队中", executing: "生成中", succeeded: "成功", failed: "失败", canceled: "已撤销" };
const stages: Record<string, string> = { ...statuses, storing: "保存结果中", pending: "等待处理", processing: "生成中", running: "生成中", completed: "生成完成", IN_QUEUE: "排队中", IN_PROGRESS: "生成中", COMPLETED: "生成完成" };

export default function TaskRecordsPage() {
    const token = useUserStore((state) => state.token);
    const { tr } = useI18n();
    const [filters, setFilters] = useState({ keyword: "", category: "", type: "", startTime: "", endTime: "", page: 1, pageSize: 20 });
    const [selected, setSelected] = useState("");
    const query = useQuery({ queryKey: ["admin", "generation-tasks", token, filters], queryFn: () => fetchAdminGenerationTasks(token, filters), enabled: Boolean(token), ...adminRealtimeQueryOptions, refetchInterval: 3000 });
    const detail = useQuery({ queryKey: ["admin", "generation-task", token, selected], queryFn: () => fetchAdminGenerationTask(token, selected), enabled: Boolean(token && selected), ...adminRealtimeQueryOptions, refetchInterval: 3000 });
    const task = detail.data;
    const statusTag = (item: AdminGenerationTask) => <Tag data-i18n-skip color={item.status === "succeeded" ? "green" : item.status === "failed" ? "red" : item.status === "executing" ? "blue" : "default"}>{tr(statuses[item.status] || item.status)}</Tag>;
    const updateFilters = (value: Partial<typeof filters>) => setFilters((previous) => ({ ...previous, ...value, page: 1 }));
    return <main className="p-3 sm:p-4 lg:p-6">
        <Flex vertical gap={16}>
            <Card variant="borderless">
                <Typography.Paragraph type="secondary">每条记录对应一次生成任务，渠道重试与状态轮询不新增任务记录。实时查看状态、进度、参数及报错，文件到期后仍可查看任务信息。</Typography.Paragraph>
                <Space wrap>
                    <Input.Search placeholder="搜索用户、模型、提示词或任务编号" allowClear onSearch={(keyword) => updateFilters({ keyword })} style={{ width: 300, maxWidth: "100%" }} />
                    <Select aria-label={tr("任务状态")} value={filters.category} style={{ width: 140 }} onChange={(category) => updateFilters({ category })} options={[{ value: "", label: tr("全部状态") }, ...Object.entries(statuses).map(([value, label]) => ({ value, label: tr(label) }))]} />
                    <Select aria-label={tr("任务来源")} value={filters.type} style={{ width: 170 }} onChange={(type) => updateFilters({ type })} options={[{ value: "", label: tr("全部工作台") }, ...generationSections.map((item) => ({ value: item.key, label: tr(item.label) }))]} />
                    <DatePicker.RangePicker showTime onChange={(dates) => updateFilters({ startTime: dates?.[0]?.toISOString() || "", endTime: dates?.[1]?.toISOString() || "" })} />
                    <Button onClick={() => void query.refetch()}>刷新</Button>
                </Space>
                {query.isError ? <Typography.Paragraph type="danger" data-i18n-skip>{tr(query.error.message)}</Typography.Paragraph> : null}
            </Card>
            <Card variant="borderless" title="任务记录">
                <Table<AdminGenerationTask> rowKey="id" loading={query.isLoading} dataSource={query.data?.items || []} scroll={{ x: 1150 }} columns={[
                    { title: "用户", key: "user", width: 170, render: (_, item) => <Space><Avatar size={28} src={item.user?.avatarUrl}>{(item.user?.displayName || item.username).slice(0, 1)}</Avatar><span data-i18n-skip>{item.user?.displayName || item.username}</span></Space> },
                    { title: "模型", dataIndex: "model", width: 170, render: (value: string) => <span data-i18n-skip>{value}</span> },
                    { title: "任务来源", dataIndex: "section", width: 150, render: (value: string) => <span data-i18n-skip>{tr(generationSections.find((item) => item.key === value)?.label || value)}</span> },
                    { title: "提示词", dataIndex: "prompt", ellipsis: true, render: (value: string) => <span data-i18n-skip>{value}</span> },
                    { title: "状态 / 进度", key: "status", width: 170, render: (_, item) => <div>{statusTag(item)}{item.status === "executing" && item.progress > 0 ? <Progress size="small" percent={item.progress} /> : item.status === "queued" ? <span data-i18n-skip>{tr("队列位置 {0}").replace("{0}", String(item.queuePosition))}</span> : null}</div> },
                    { title: "时间", dataIndex: "createdAt", width: 180, render: (value: string) => <span data-i18n-skip>{formatDateTime(value)}</span> },
                    { title: "操作", key: "action", width: 95, render: (_, item) => <Button type="link" onClick={() => setSelected(item.id)}>查看详情</Button> },
                ]} pagination={{ current: filters.page, pageSize: filters.pageSize, total: query.data?.total || 0, showSizeChanger: true, onChange: (page, pageSize) => setFilters((previous) => ({ ...previous, page: pageSize === previous.pageSize ? page : 1, pageSize })) }} />
            </Card>
        </Flex>
        <Drawer title="任务详情" open={Boolean(selected)} onClose={() => setSelected("")} width="min(800px, 100vw)">
            {detail.isError ? <Typography.Paragraph type="danger" data-i18n-skip>{tr(detail.error.message)}</Typography.Paragraph> : null}
            {task ? <Flex vertical gap={20}>
                <Descriptions column={1} bordered size="small" items={[
                    { key: "id", label: tr("任务编号"), children: <span data-i18n-skip>{task.id}</span> },
                    { key: "user", label: tr("用户"), children: <span data-i18n-skip>{task.username} · {task.userId}</span> },
                    { key: "model", label: tr("模型"), children: <span data-i18n-skip>{task.model}</span> },
                    { key: "status", label: tr("状态"), children: statusTag(task) },
                    { key: "stage", label: tr("实时进度"), children: <div data-i18n-skip>{tr(stages[task.stage] || task.stage)}{task.status === "queued" ? ` · ${tr("队列位置 {0}").replace("{0}", String(task.queuePosition))}` : ""}{task.progress > 0 ? <Progress percent={task.progress} size="small" status={task.status === "failed" ? "exception" : task.status === "succeeded" ? "success" : "active"} /> : null}</div> },
                    { key: "provider", label: tr("供应商任务编号"), children: <span data-i18n-skip>{task.providerTaskId || "—"}</span> },
                    { key: "credits", label: tr("算力点"), children: task.credits },
                    { key: "count", label: tr("生成数量"), children: task.requestCount },
                    { key: "created", label: tr("创建时间"), children: <span data-i18n-skip>{formatDateTime(task.createdAt)}</span> },
                    { key: "started", label: tr("开始时间"), children: <span data-i18n-skip>{task.startedAt ? formatDateTime(task.startedAt) : "—"}</span> },
                    { key: "finished", label: tr("完成时间"), children: <span data-i18n-skip>{task.finishedAt ? formatDateTime(task.finishedAt) : "—"}</span> },
                ]} />
                <div><Typography.Title level={5}>提示词</Typography.Title><Typography.Paragraph data-i18n-skip copyable style={{ whiteSpace: "pre-wrap" }}>{task.prompt}</Typography.Paragraph></div>
                <div><Typography.Title level={5}>完整请求参数</Typography.Title><pre data-i18n-skip className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--muted)] p-3 text-xs">{JSON.stringify(task.parameters, null, 2)}</pre></div>
                {task.error || task.errorDetail ? <div><Typography.Title level={5}>任务报错</Typography.Title><Typography.Paragraph data-i18n-skip type="danger">{tr(task.error)}</Typography.Paragraph>{task.errorDetail ? <pre data-i18n-skip className="whitespace-pre-wrap break-all text-xs">{task.errorDetail}</pre> : null}</div> : null}
                {task.status === "succeeded" ? <div>
                    <Typography.Title level={5}>生成结果</Typography.Title>
                    {task.media?.length ? <Image.PreviewGroup><Flex vertical gap={12}>{task.media.map((file) => <div key={file.cloudFileId}>
                        {file.fileType === "image" ? <Image alt={tr("生成结果")} src={file.url} style={{ maxHeight: 360, objectFit: "contain" }} /> : file.fileType === "video" ? <video controls src={file.url} className="max-h-96 w-full" /> : <div><Model3DPreview url={file.url} className="h-80" /><Typography.Link href={file.url} target="_blank" rel="noreferrer">下载 3D 模型</Typography.Link></div>}
                        <Typography.Paragraph data-i18n-skip type="secondary">{tr("保存至 {0}").replace("{0}", formatDateTime(file.expiresAt))}</Typography.Paragraph>
                    </div>)}</Flex></Image.PreviewGroup> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr("生成文件已到期或已删除，提示词和参数仍保留")} />}
                </div> : null}
            </Flex> : null}
        </Drawer>
    </main>;
}
