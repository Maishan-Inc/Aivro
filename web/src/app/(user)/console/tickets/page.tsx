"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Empty, Form, Input, Modal, Select, Space, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LifeBuoy, Plus, RefreshCw } from "lucide-react";

import { SupportTicketCharge } from "@/components/support-ticket-charge";
import { SupportTicketDetail } from "@/components/support-ticket-detail";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { formatDateTime } from "@/lib/datetime";
import { ticketCategoryLabels, ticketStatusColors, ticketStatusLabels } from "@/lib/support-tickets";
import { createTicket, fetchTicketCharge, fetchTickets, type CreateTicketInput, type SupportTicket } from "@/services/api/support-tickets";
import { useUserStore } from "@/stores/use-user-store";

export default function TicketsPage() {
    const token = useUserStore((state) => state.token);
    const userID = useUserStore((state) => state.user?.id);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const localizedPath = useLocalizedPath();
    const router = useRouter();
    const params = useSearchParams();
    const creditLogId = params.get("creditLogId") || "";
    const requestCreate = params.get("create") === "1";
    const client = useQueryClient();
    const [form] = Form.useForm<CreateTicketInput>();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [status, setStatus] = useState("");
    const [keyword, setKeyword] = useState("");
    const [keywordText, setKeywordText] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [draftLogID, setDraftLogID] = useState("");
    const [creating, setCreating] = useState(false);
    const [selectedID, setSelectedID] = useState("");
    const query = useQuery({ queryKey: ["support-tickets", userID, "user", status, keyword, page, pageSize], queryFn: () => fetchTickets(token, { type: status, keyword, page, pageSize }), enabled: Boolean(token && userID), retry: false, staleTime: 0 });
    const chargeQuery = useQuery({ queryKey: ["ticket-charge", userID, draftLogID], queryFn: () => fetchTicketCharge(token, draftLogID), enabled: Boolean(token && userID && createOpen && draftLogID), retry: false });
    const charge = draftLogID ? chargeQuery.data : undefined;
    const chargeError = draftLogID && (chargeQuery.isError || (charge && charge.amount >= 0));
    const ready = !draftLogID || Boolean(charge && !chargeError);

    useEffect(() => {
        setSelectedID("");
        setPage(1);
        setStatus("");
        setKeyword("");
        setKeywordText("");
    }, [userID]);

    useEffect(() => {
        setDraftLogID(creditLogId);
        setCreateOpen(Boolean(userID && (requestCreate || creditLogId)));
    }, [creditLogId, requestCreate, userID]);

    function closeCreate() {
        if (creating) return;
        form.resetFields();
        setCreateOpen(false);
        setDraftLogID("");
        if (creditLogId || requestCreate) router.replace(localizedPath("/console/tickets"), { scroll: false });
    }

    async function submit(values: CreateTicketInput) {
        if (!token || creating || !ready) return;
        setCreating(true);
        try {
            const item = await createTicket(token, { ...values, title: values.title.trim(), content: values.content.trim(), creditLogId: charge?.id });
            if (useUserStore.getState().user?.id !== userID) return;
            setCreateOpen(false);
            setDraftLogID("");
            form.resetFields();
            setPage(1);
            setStatus("");
            setKeyword("");
            setKeywordText("");
            setSelectedID(item.id);
            message.success(tr("工单已提交"));
            if (creditLogId || requestCreate) router.replace(localizedPath("/console/tickets"), { scroll: false });
            await client.invalidateQueries({ queryKey: ["support-tickets"] });
        } catch (err) { message.error(tr(err instanceof Error ? err.message : "创建工单失败")); }
        finally { setCreating(false); }
    }

    const columns: ColumnsType<SupportTicket> = [
        { title: tr("工单标题"), dataIndex: "title", render: (title: string, item) => <Button type="link" className="h-auto max-w-sm whitespace-normal px-0 text-left" onClick={() => setSelectedID(item.id)}><span data-i18n-skip>{title}</span></Button> },
        { title: tr("问题分类"), dataIndex: "category", render: (value: SupportTicket["category"]) => tr(ticketCategoryLabels[value]) },
        { title: tr("状态"), dataIndex: "status", render: (value: SupportTicket["status"]) => <Tag color={ticketStatusColors[value]}>{tr(ticketStatusLabels[value])}</Tag> },
        { title: tr("创建时间"), dataIndex: "createdAt", render: (value: string) => formatDateTime(value) },
        { title: tr("更新时间"), dataIndex: "updatedAt", render: (value: string) => formatDateTime(value) },
        { title: tr("操作"), render: (_, item) => <Button type="text" onClick={() => setSelectedID(item.id)}>{tr("查看详情")}</Button> },
    ];

    return <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
                <div><div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><LifeBuoy className="size-4" />{tr("客户支持")}</div><h1 className="text-2xl font-semibold">{tr("工单服务")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{tr("遇到扣费、生成或账号问题？提交工单，与客服继续沟通。")}</p></div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => { setDraftLogID(""); setCreateOpen(true); }}>{tr("创建工单")}</Button>
            </header>
            <section className="rounded-xl border border-border p-4 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <Space wrap><Input.Search value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder={tr("搜索工单标题或编号")} allowClear onSearch={(value) => { setKeyword(value.trim()); setPage(1); }} className="w-60" /><Select aria-label={tr("筛选工单状态")} value={status} className="min-w-44" onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "", label: tr("全部状态") }, ...Object.entries(ticketStatusLabels).map(([value, label]) => ({ value, label: tr(label) }))]} /></Space>
                    <Button type="text" icon={<RefreshCw className="size-4" />} loading={query.isFetching} onClick={() => query.refetch()}>{tr("刷新")}</Button>
                </div>
                {query.isError ? <Alert className="mb-4" type="error" showIcon title={tr(query.error instanceof Error ? query.error.message : "读取工单失败")} /> : null}
                <Table<SupportTicket> rowKey="id" columns={columns} dataSource={query.data?.items || []} loading={query.isFetching} scroll={{ x: 880 }} pagination={{ current: page, pageSize, total: query.data?.total || 0, showSizeChanger: true, onChange: (value, size) => { setPage(size === pageSize ? value : 1); setPageSize(size); } }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr(query.isError ? "暂时无法加载工单" : "暂无工单，遇到问题可以创建工单")} /> }} />
            </section>
        </div>
        <Modal title={tr("创建工单")} open={createOpen} onCancel={closeCreate} onOk={() => form.submit()} okText={tr("提交工单")} cancelText={tr("取消")} confirmLoading={creating} okButtonProps={{ disabled: !ready }} cancelButtonProps={{ disabled: creating }} closable={!creating} mask={{ closable: !creating }} destroyOnHidden width={640}>
            {chargeError ? <Alert type="error" showIcon title={tr(chargeQuery.error instanceof Error ? chargeQuery.error.message : "仅扣费问题可以关联负数扣费记录")} /> : !ready ? <div className="grid h-40 place-items-center"><Spin /></div> : <Form form={form} layout="vertical" preserve={false} clearOnDestroy disabled={creating} onFinish={submit} initialValues={{ category: charge ? "billing" : "other", title: charge ? tr(`扣费疑问：${charge.model || charge.id}`) : "" }} className="space-y-4 pt-3">
                {charge ? <><Alert type="info" showIcon title={tr("已带入扣费信息，请补充问题描述后提交。")}/><SupportTicketCharge charge={charge} /></> : null}
                <Form.Item name="category" label={tr("问题分类")} rules={[{ required: true, message: "请选择有效的问题分类" }]}><Select disabled={creating || Boolean(charge)} options={Object.entries(ticketCategoryLabels).map(([value, label]) => ({ value, label: tr(label) }))} /></Form.Item>
                <Form.Item name="title" label={tr("工单标题")} rules={[{ required: true, whitespace: true, message: "请输入工单标题" }, { max: 100, message: "工单标题需为 1–100 个字符" }]}><Input maxLength={100} placeholder={tr("简要描述遇到的问题")} /></Form.Item>
                <Form.Item name="content" label={tr("问题描述")} rules={[{ required: true, whitespace: true, message: "请输入问题描述" }, { max: 5000, message: "问题描述需为 1–5000 个字符" }]}><Input.TextArea rows={6} maxLength={5000} showCount placeholder={tr("请说明发生了什么、预期结果以及需要我们协助的内容")} /></Form.Item>
                <p className="text-xs leading-6 text-muted-foreground">{tr("仅在点击提交工单后创建，关闭表单不会提交。")}</p>
            </Form>}
        </Modal>
        {selectedID ? <SupportTicketDetail key={`${userID}:${selectedID}`} id={selectedID} onClose={() => setSelectedID("")} /> : null}
    </div>;
}
