"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Drawer, Form, Input, Space, Spin, Tag } from "antd";
import { RefreshCw, Send } from "lucide-react";

import { SupportTicketCharge } from "@/components/support-ticket-charge";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import { ticketCategoryLabels, ticketStatusColors, ticketStatusLabels } from "@/lib/support-tickets";
import { fetchTicket, replyTicket, setTicketStatus } from "@/services/api/support-tickets";
import { useUserStore } from "@/stores/use-user-store";

export function SupportTicketDetail({ id, admin = false, onClose }: { id: string; admin?: boolean; onClose: () => void }) {
    const token = useUserStore((state) => state.token);
    const userID = useUserStore((state) => state.user?.id);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [form] = Form.useForm<{ content: string }>();
    const [busy, setBusy] = useState(false);
    const query = useQuery({ queryKey: ["support-ticket", userID, admin, id], queryFn: () => fetchTicket(token, id, admin), enabled: Boolean(token && userID), retry: false, staleTime: 0 });
    const ticket = query.data;
    const closed = ticket?.status === "closed";

    async function update(action: () => Promise<boolean>, success: string) {
        if (busy || !token) return;
        setBusy(true);
        try {
            await action();
            if (useUserStore.getState().user?.id !== userID) return;
            form.resetFields();
            message.success(tr(success));
            await Promise.all([query.refetch(), client.invalidateQueries({ queryKey: ["support-tickets"] })]);
        } catch (err) { message.error(tr(err instanceof Error ? err.message : "操作失败")); }
        finally { setBusy(false); }
    }

    return <Drawer title={tr("工单详情")} open onClose={onClose} size="min(720px, 100vw)" destroyOnHidden
        extra={<Button type="text" icon={<RefreshCw className="size-4" />} loading={query.isFetching} disabled={busy} onClick={() => query.refetch()}>{tr("刷新")}</Button>}>
        {query.isError ? <Alert type="error" showIcon title={tr(query.error instanceof Error ? query.error.message : "读取工单失败")} /> : null}
        {query.isPending ? <div className="grid h-40 place-items-center"><Spin /></div> : ticket ? <div className="space-y-6">
            <header className="space-y-3">
                <Space wrap><Tag color={ticketStatusColors[ticket.status]}>{tr(ticketStatusLabels[ticket.status])}</Tag><Tag>{tr(ticketCategoryLabels[ticket.category])}</Tag></Space>
                <h2 className="break-words text-xl font-semibold" data-i18n-skip>{ticket.title}</h2>
                <p className="text-xs text-muted-foreground"><span>{tr("工单编号")}</span> <code data-i18n-skip>{ticket.id}</code></p>
                {admin ? <p className="text-sm"><span>{tr("提交用户")}</span>：<span data-i18n-skip>{ticket.user?.displayName || ticket.user?.username || ticket.userId}</span></p> : null}
                <p className="text-xs text-muted-foreground">{tr("创建时间")} {formatDateTime(ticket.createdAt)}</p>
                <div className="whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm leading-7" data-i18n-skip>{ticket.content}</div>
            </header>
            {ticket.charge ? <SupportTicketCharge charge={ticket.charge} /> : null}
            <section className="space-y-4">
                <h3 className="text-sm font-medium">{tr("沟通记录")}</h3>
                {ticket.replies.length ? ticket.replies.map((reply) => <article key={reply.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><Tag color={reply.isAdmin ? "blue" : "default"}>{tr(reply.isAdmin ? "客服回复" : "用户补充")}</Tag><time className="text-muted-foreground">{formatDateTime(reply.createdAt)}</time></div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7" data-i18n-skip>{reply.content}</p>
                </article>) : <p className="py-3 text-sm text-muted-foreground">{tr("暂无回复")}</p>}
            </section>
            <section className="border-t border-border pt-5">
                {closed ? <Alert type="info" showIcon title={tr("工单已关闭，重新打开后可继续沟通。")}/>
                    : <Form form={form} layout="vertical" onFinish={({ content }) => update(() => replyTicket(token, id, content.trim(), admin), "回复已发送")} disabled={busy}>
                        <Form.Item name="content" label={tr(admin ? "回复用户" : "补充说明")} rules={[{ required: true, whitespace: true, message: "请输入回复内容" }, { max: 5000, message: "回复内容需为 1–5000 个字符" }]}><Input.TextArea rows={5} maxLength={5000} showCount placeholder={tr(admin ? "填写处理结果或需要用户补充的信息" : "补充问题详情，或回复客服的问题")} /></Form.Item>
                        <Button type="primary" htmlType="submit" loading={busy} icon={<Send className="size-4" />}>{tr("发送回复")}</Button>
                    </Form>}
                <Button className="mt-4" disabled={busy} onClick={() => update(() => setTicketStatus(token, id, closed ? "pending" : "closed", admin), closed ? "工单已重新打开" : "工单已关闭")}>
                    {tr(closed ? "重新打开工单" : "关闭工单")}
                </Button>
            </section>
        </div> : null}
    </Drawer>;
}
