"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Drawer, Form, Grid, Input, Modal, Spin, Tag } from "antd";
import { ArrowLeft, Headphones, Info, RefreshCw, Send, UserRound } from "lucide-react";

import { SupportTicketCharge } from "@/components/support-ticket-charge";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import { ticketCategoryLabels, ticketStatusColors, ticketStatusLabels } from "@/lib/support-tickets";
import { fetchTicket, replyTicket, setTicketStatus } from "@/services/api/support-tickets";
import { useUserStore } from "@/stores/use-user-store";

export function SupportTicketDetail({ id, admin = false, onClose }: { id: string; admin?: boolean; onClose: () => void }) {
    const token = useUserStore((state) => state.token);
    const userID = useUserStore((state) => state.user?.id);
    const desktop = Grid.useBreakpoint().md;
    const { tr } = useI18n();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [form] = Form.useForm<{ content: string }>();
    const [busy, setBusy] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const conversationRef = useRef<HTMLDivElement>(null);
    const nearBottom = useRef(true);
    const query = useQuery({ queryKey: ["support-ticket", userID, admin, id], queryFn: () => fetchTicket(token, id, admin), enabled: Boolean(token && userID), retry: false, staleTime: 0 });
    const ticket = query.data;
    const closed = ticket?.status === "closed";
    const replyCount = ticket?.replies.length || 0;

    useEffect(() => {
        const element = conversationRef.current;
        if (element && (desktop || !showInfo) && nearBottom.current) element.scrollTop = element.scrollHeight;
    }, [desktop, showInfo, ticket?.id, replyCount]);

    async function update(action: () => Promise<boolean>, success: string, resetReply = false) {
        if (busy || !token) return;
        setBusy(true);
        try {
            await action();
            if (useUserStore.getState().user?.id !== userID) return;
            if (resetReply) { form.resetFields(); nearBottom.current = true; }
            message.success(tr(success));
            await Promise.all([query.refetch(), client.invalidateQueries({ queryKey: ["support-tickets"] })]);
        } catch (err) { message.error(tr(err instanceof Error ? err.message : "操作失败")); }
        finally { setBusy(false); }
    }

    const messages = ticket ? [
        { id: "initial", isAdmin: false, content: ticket.content, createdAt: ticket.createdAt },
        ...ticket.replies,
    ] : [];
    const title = <div className="flex min-w-0 items-center gap-2 pr-8">
        <span className="shrink-0">{tr("工单详情")}</span>
        <Button type="text" size="small" icon={<RefreshCw className="size-4" />} loading={query.isFetching} disabled={busy} onClick={() => query.refetch()} aria-label={tr("刷新")} title={tr("刷新")} />
    </div>;
    const content = <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
        {query.isError ? <Alert className="m-4" type="error" showIcon title={tr(query.error instanceof Error ? query.error.message : "读取工单失败")} /> : null}
        {query.isPending ? <div className="grid min-h-0 flex-1 place-items-center"><Spin /></div> : ticket ? <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 md:px-6">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold" title={ticket.title} data-i18n-skip>{ticket.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><Tag style={{ marginInlineEnd: 0 }} color={ticketStatusColors[ticket.status]}>{tr(ticketStatusLabels[ticket.status])}</Tag><span className="text-xs text-muted-foreground">{tr(ticketCategoryLabels[ticket.category])}</span></div>
                </div>
                {!desktop ? <Button type="text" size="small" icon={showInfo ? <ArrowLeft className="size-4" /> : <Info className="size-4" />} onClick={() => setShowInfo((value) => !value)} aria-expanded={showInfo} aria-label={tr(showInfo ? "返回对话" : "查看工单信息")} title={tr(showInfo ? "返回对话" : "查看工单信息")}><span className="text-xs">{tr(showInfo ? "返回对话" : "查看")}</span></Button> : null}
            </header>
            <div className="flex min-h-0 flex-1">
                <section className={`${desktop || !showInfo ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col`} aria-label={tr("沟通记录")}>
                    <div ref={conversationRef} className="thin-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-muted/30 px-4 py-5 md:px-6" onScroll={(event) => { const element = event.currentTarget; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
                        {messages.map((item) => {
                            const mine = item.isAdmin === admin;
                            const Icon = item.isAdmin ? Headphones : UserRound;
                            return <article key={item.id} className={`flex items-start gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                                <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground" aria-hidden><Icon className="size-4" /></div>
                                <div className={`flex min-w-0 max-w-[82%] flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
                                    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground ${mine ? "justify-end" : ""}`}><span>{tr(item.id === "initial" ? "问题描述" : item.isAdmin ? "客服回复" : "用户补充")}</span><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></div>
                                    <p className={`whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] ${mine ? "rounded-tr-sm border-transparent bg-primary/10" : "rounded-tl-sm border-border bg-background"}`} data-i18n-skip>{item.content}</p>
                                </div>
                            </article>;
                        })}
                        {!replyCount ? <p className="text-center text-xs text-muted-foreground">{tr("暂无回复")}</p> : null}
                    </div>
                    <footer className="shrink-0 border-t border-border bg-background p-4 md:px-6" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
                        {closed ? <Alert className="mb-3" type="info" showIcon title={tr("工单已关闭，重新打开后可继续沟通。")}/>
                            : <Form form={form} onFinish={({ content }) => update(() => replyTicket(token, id, content.trim(), admin), "回复已发送", true)} disabled={busy}>
                                <Form.Item name="content" className="!mb-3" rules={[{ required: true, whitespace: true, message: tr("请输入回复内容") }, { max: 5000, message: tr("回复内容需为 1–5000 个字符") }]}><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={5000} aria-label={tr(admin ? "回复用户" : "补充说明")} placeholder={tr(admin ? "填写处理结果或需要用户补充的信息" : "补充问题详情，或回复客服的问题")} /></Form.Item>
                            </Form>}
                        <div className="flex items-center justify-between gap-3">
                            <Button className="min-w-0 max-w-[48%] !h-auto min-h-9 !whitespace-normal !px-3 !py-1.5" disabled={busy} onClick={() => update(() => setTicketStatus(token, id, closed ? "pending" : "closed", admin), closed ? "工单已重新打开" : "工单已关闭")}>{tr(closed ? "重新打开工单" : "关闭工单")}</Button>
                            {!closed ? <Button className="min-w-0 max-w-[48%] !h-auto min-h-9 !whitespace-normal !px-3 !py-1.5" type="primary" loading={busy} icon={<Send className="size-4" />} onClick={() => form.submit()}>{tr("发送回复")}</Button> : null}
                        </div>
                    </footer>
                </section>
                {desktop || showInfo ? <aside className={`thin-scrollbar min-h-0 overflow-y-auto p-4 ${desktop ? "w-[300px] shrink-0 border-l border-border" : "min-w-0 flex-1"}`} aria-label={tr("工单信息")}>
                    <h3 className="mb-4 text-sm font-semibold">{tr("工单信息")}</h3>
                    <dl className="space-y-4 text-xs">
                        <div><dt className="mb-1 text-muted-foreground">{tr("工单标题")}</dt><dd className="break-words" data-i18n-skip>{ticket.title}</dd></div>
                        <div><dt className="mb-1 text-muted-foreground">{tr("工单编号")}</dt><dd><code className="break-all" data-i18n-skip>{ticket.id}</code></dd></div>
                        {admin ? <div><dt className="mb-1 text-muted-foreground">{tr("提交用户")}</dt><dd className="break-words" data-i18n-skip>{ticket.user?.displayName || ticket.user?.username || ticket.userId}</dd></div> : null}
                        <div><dt className="mb-1 text-muted-foreground">{tr("创建时间")}</dt><dd>{formatDateTime(ticket.createdAt)}</dd></div>
                        <div><dt className="mb-1 text-muted-foreground">{tr("更新时间")}</dt><dd>{formatDateTime(ticket.updatedAt)}</dd></div>
                    </dl>
                    {ticket.charge ? <div className="mt-5"><SupportTicketCharge charge={ticket.charge} /></div> : null}
                </aside> : null}
            </div>
        </> : null}
    </div>;

    return desktop ? <Modal title={title} open centered onCancel={onClose} footer={null} width="min(1040px, calc(100vw - 64px))" destroyOnHidden styles={{ container: { padding: 0, overflow: "hidden" }, header: { margin: 0, padding: "16px 24px" }, body: { height: "min(760px, calc(100dvh - 120px))", padding: 0, overflow: "hidden" } }}>{content}</Modal>
        : <Drawer title={title} open placement="right" onClose={onClose} size="100vw" destroyOnHidden styles={{ header: { padding: "12px 16px" }, body: { padding: 0, overflow: "hidden" } }}>{content}</Drawer>;
}
