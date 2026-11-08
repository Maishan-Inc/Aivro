"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Avatar, Button, Card, Input, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { RefreshCw } from "lucide-react";

import { SupportTicketDetail } from "@/components/support-ticket-detail";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import { ticketCategoryLabels, ticketStatusColors, ticketStatusLabels } from "@/lib/support-tickets";
import { fetchTickets, type SupportTicket } from "@/services/api/support-tickets";
import { useUserStore } from "@/stores/use-user-store";
import { adminRealtimeQueryOptions } from "../admin-query-options";

export default function AdminTicketsPage() {
    const token = useUserStore((state) => state.token);
    const userID = useUserStore((state) => state.user?.id);
    const role = useUserStore((state) => state.user?.role);
    const { tr } = useI18n();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState("");
    const [category, setCategory] = useState("");
    const [selectedID, setSelectedID] = useState("");
    const query = useQuery({ queryKey: ["support-tickets", userID, "admin", keyword, status, category, page, pageSize], queryFn: () => fetchTickets(token, { keyword, type: status, category, page, pageSize }, true), enabled: Boolean(token && userID && role === "admin"), retry: false, ...adminRealtimeQueryOptions });

    useEffect(() => { setSelectedID(""); setPage(1); }, [userID]);

    const columns: ColumnsType<SupportTicket> = [
        { title: tr("工单标题"), dataIndex: "title", render: (title: string, item) => <div><Button type="link" className="h-auto max-w-sm whitespace-normal px-0 text-left" onClick={() => setSelectedID(item.id)}><span data-i18n-skip>{title}</span></Button><p className="text-xs text-muted-foreground" data-i18n-skip>{item.id}</p></div> },
        { title: tr("提交用户"), render: (_, item) => <Space><Avatar src={item.user?.avatarUrl}>{(item.user?.displayName || item.user?.username || "?").slice(0, 1)}</Avatar><span data-i18n-skip>{item.user?.displayName || item.user?.username || item.userId}</span></Space> },
        { title: tr("问题分类"), dataIndex: "category", render: (value: SupportTicket["category"]) => tr(ticketCategoryLabels[value]) },
        { title: tr("状态"), dataIndex: "status", render: (value: SupportTicket["status"]) => <Tag color={ticketStatusColors[value]}>{tr(ticketStatusLabels[value])}</Tag> },
        { title: tr("更新时间"), dataIndex: "updatedAt", render: (value: string) => formatDateTime(value) },
        { title: tr("操作"), render: (_, item) => <Button type="link" onClick={() => setSelectedID(item.id)}>{tr("查看与回复")}</Button> },
    ];

    return <div className="p-3 lg:p-6">
        <Card title={tr("工单回复")} extra={<Button icon={<RefreshCw className="size-4" />} loading={query.isFetching} onClick={() => query.refetch()}>{tr("刷新")}</Button>}>
            <p className="mb-5 text-sm text-muted-foreground">{tr("查看用户问题与关联扣费信息，回复并跟进处理结果。")}</p>
            <Space wrap className="mb-5">
                <Input.Search className="w-72" placeholder={tr("搜索工单标题、工单或用户编号")} allowClear onSearch={(value) => { setKeyword(value.trim()); setPage(1); }} />
                <Select aria-label={tr("筛选工单状态")} className="min-w-44" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "", label: tr("全部状态") }, ...Object.entries(ticketStatusLabels).map(([value, label]) => ({ value, label: tr(label) }))]} />
                <Select aria-label={tr("筛选问题分类")} className="min-w-36" value={category} onChange={(value) => { setCategory(value); setPage(1); }} options={[{ value: "", label: tr("全部分类") }, ...Object.entries(ticketCategoryLabels).map(([value, label]) => ({ value, label: tr(label) }))]} />
            </Space>
            {query.isError ? <Alert className="mb-4" type="error" showIcon title={tr(query.error instanceof Error ? query.error.message : "读取工单失败")} /> : null}
            <Table<SupportTicket> rowKey="id" columns={columns} dataSource={query.data?.items || []} loading={query.isFetching} scroll={{ x: 1000 }} pagination={{ current: page, pageSize, total: query.data?.total || 0, showSizeChanger: true, onChange: (value, size) => { setPage(size === pageSize ? value : 1); setPageSize(size); } }} />
        </Card>
        {selectedID ? <SupportTicketDetail key={`${userID}:${selectedID}`} id={selectedID} admin onClose={() => setSelectedID("")} /> : null}
    </div>;
}
