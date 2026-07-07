"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { App, Empty, Modal, Tag, Typography } from "antd";

import { fetchCreditLogs, type CreditLog } from "@/services/api/billing";
import type { GenerationHistory, GenerationHistoryMedia } from "@/services/api/generation-history";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { useUserStore } from "@/stores/use-user-store";

type GenerationHistoryDetailModalProps = {
    open: boolean;
    history: GenerationHistory | null;
    onClose: () => void;
};

export function GenerationHistoryDetailModal({ open, history, onClose }: GenerationHistoryDetailModalProps) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [creditLogs, setCreditLogs] = useState<CreditLog[]>([]);
    const [loadingCreditLogs, setLoadingCreditLogs] = useState(false);
    const expiresAt = useMemo(() => (history ? earliestExpiresAt(history) : ""), [history]);

    useEffect(() => {
        if (!open || !history || !token) {
            setCreditLogs([]);
            return;
        }
        const { startTime, endTime } = creditLogWindow(history.createdAt);
        setLoadingCreditLogs(true);
        fetchCreditLogs(token, { keyword: history.model, startTime, endTime, pageSize: 50 })
            .then((result) => setCreditLogs(result.items.filter((item) => isRelatedCreditLog(item, history))))
            .catch((error) => message.error(error instanceof Error ? error.message : "读取扣费记录失败"))
            .finally(() => setLoadingCreditLogs(false));
    }, [history, message, open, token]);

    return (
        <Modal title="详细任务" open={open} onCancel={onClose} footer={null} centered width={720} styles={{ body: { height: "min(672px, calc(100vh - 150px))", overflowY: "auto", paddingRight: 4 } }}>
            {history ? (
                <div className="space-y-4 pr-2">
                    <section className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                        <div className="mb-2 text-sm font-semibold">任务信息</div>
                        <div className="divide-y divide-stone-100 dark:divide-stone-800">
                            <DetailRow label="调用模型" value={history.model || history.config?.model || "未记录"} />
                            <DetailRow
                                label="任务状态"
                                value={
                                    <Tag className="m-0" color={history.status === "成功" ? "blue" : "red"}>
                                        {history.status || "成功"}
                                    </Tag>
                                }
                            />
                            <DetailRow label="生成时间" value={formatDate(history.createdAt)} />
                            <DetailRow label="任务耗时" value={history.durationMs ? formatDuration(history.durationMs) : "未记录"} />
                            <DetailRow label="尺寸" value={historySize(history)} />
                            <DetailRow label="服务器删除" value={formatDeleteRemaining(expiresAt)} />
                        </div>
                    </section>

                    <section className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                        <div className="mb-2 text-sm font-semibold">提示词</div>
                        <Typography.Paragraph copyable className="!mb-0 whitespace-pre-wrap break-words rounded-md bg-stone-50 p-3 text-sm leading-6 dark:bg-stone-900">
                            {history.prompt || "无提示词"}
                        </Typography.Paragraph>
                    </section>

                    <section className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold">媒体信息</div>
                            <Tag className="m-0">{history.media.length}</Tag>
                        </div>
                        {history.media.length ? (
                            <div className="grid gap-2">
                                {history.media.map((item) => (
                                    <MediaRow key={item.cloudFileId || item.storageKey || item.url} item={item} />
                                ))}
                            </div>
                        ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无媒体信息" />
                        )}
                    </section>

                    <section className="rounded-lg border border-stone-200 bg-background p-3 dark:border-stone-800">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold">扣费记录</div>
                            <Tag className="m-0">{creditLogs.length}</Tag>
                        </div>
                        {loadingCreditLogs ? (
                            <div className="rounded-md bg-stone-50 px-3 py-6 text-center text-sm text-stone-500 dark:bg-stone-900 dark:text-stone-400">读取扣费记录中...</div>
                        ) : creditLogs.length ? (
                            <div className="grid gap-2">
                                {creditLogs.map((item) => (
                                    <CreditLogRow key={item.id} item={item} />
                                ))}
                            </div>
                        ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到关联扣费记录" />
                        )}
                    </section>
                </div>
            ) : null}
        </Modal>
    );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2 text-sm leading-6">
            <div className="text-stone-500 dark:text-stone-400">{label}</div>
            <div className="min-w-0 break-words text-stone-900 dark:text-stone-100">{value}</div>
        </div>
    );
}

function MediaRow({ item }: { item: GenerationHistoryMedia }) {
    const dimensions = item.width && item.height ? `${item.width}x${item.height}` : "无尺寸";
    return (
        <div className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 dark:bg-stone-900">
            <DetailRow label="文件类型" value={<Tag className="m-0">{item.fileType}</Tag>} />
            <DetailRow label="尺寸" value={dimensions} />
            <DetailRow label="大小" value={formatBytes(item.size || 0)} />
            <DetailRow label="内容类型" value={item.contentType || "未知类型"} />
            <DetailRow label="删除时间" value={formatDate(item.expiresAt)} />
        </div>
    );
}

function CreditLogRow({ item }: { item: CreditLog }) {
    return (
        <div className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 dark:bg-stone-900">
            <DetailRow label="时间" value={formatDate(item.createdAt)} />
            <DetailRow label="类型" value={creditLogTypeLabel(item.type)} />
            <DetailRow label="模型" value={item.model || "未记录"} />
            <DetailRow label="变动" value={<span className={item.amount < 0 ? "text-red-600" : item.amount > 0 ? "text-green-600" : ""}>{formatCreditAmount(item.amount)}</span>} />
            <DetailRow label="剩余金额" value={item.balance.toLocaleString()} />
        </div>
    );
}

function creditLogWindow(createdAt: string) {
    const time = Date.parse(createdAt);
    if (!Number.isFinite(time)) return {};
    return {
        startTime: new Date(time - 4 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(time + 10 * 60 * 1000).toISOString(),
    };
}

function isRelatedCreditLog(log: CreditLog, history: GenerationHistory) {
    if (history.model && log.model && log.model !== history.model) return false;
    const logTime = Date.parse(log.createdAt);
    const historyTime = Date.parse(history.createdAt);
    if (!Number.isFinite(logTime) || !Number.isFinite(historyTime)) return true;
    return logTime >= historyTime - 4 * 60 * 60 * 1000 && logTime <= historyTime + 10 * 60 * 1000;
}

function earliestExpiresAt(history: GenerationHistory) {
    return [history.expiresAt, ...history.media.map((item) => item.expiresAt)].filter(Boolean).sort()[0] || "";
}

function historySize(history: GenerationHistory) {
    const config = history.config || {};
    const mediaSize = history.media.map((item) => (item.width && item.height ? `${item.width}x${item.height}` : "")).find(Boolean);
    const videoInfo = [config.vquality ? `${config.vquality}p` : "", config.videoSeconds ? `${config.videoSeconds}s` : ""].filter(Boolean).join(" / ");
    return [config.size, mediaSize, videoInfo].filter(Boolean).join(" / ") || "未记录";
}

function formatDeleteRemaining(expiresAt: string) {
    const time = Date.parse(expiresAt);
    if (!Number.isFinite(time)) return "未记录";
    const diff = time - Date.now();
    if (diff <= 0) return `已到期（${formatDate(expiresAt)}）`;
    const days = Math.ceil(diff / 86400000);
    return `剩余 ${days} 天（${formatDate(expiresAt)}）`;
}

function formatDate(value: string) {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return value || "未记录";
    return new Date(time).toLocaleString("zh-CN", { hour12: false });
}

function creditLogTypeLabel(type: CreditLog["type"]) {
    if (type === "ai_refund") return <Tag color="green">返还</Tag>;
    if (type === "ai_consume") return <Tag color="red">扣费</Tag>;
    return <Tag>调整</Tag>;
}

function formatCreditAmount(value: number) {
    if (value > 0) return `+${value.toLocaleString()}`;
    return value.toLocaleString();
}
