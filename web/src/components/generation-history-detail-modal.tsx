"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Descriptions, Empty, Modal, Table, Tag, Typography } from "antd";

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
        <Modal title="详细任务" open={open} onCancel={onClose} footer={null} width={820}>
            {history ? (
                <div className="space-y-5">
                    <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
                        <Descriptions.Item label="调用模型">{history.model || history.config?.model || "未记录"}</Descriptions.Item>
                        <Descriptions.Item label="任务状态">
                            <Tag className="m-0" color={history.status === "成功" ? "blue" : "red"}>
                                {history.status || "成功"}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="生成时间">{formatDate(history.createdAt)}</Descriptions.Item>
                        <Descriptions.Item label="任务耗时">{history.durationMs ? formatDuration(history.durationMs) : "未记录"}</Descriptions.Item>
                        <Descriptions.Item label="尺寸">{historySize(history)}</Descriptions.Item>
                        <Descriptions.Item label="服务器删除">{formatDeleteRemaining(expiresAt)}</Descriptions.Item>
                    </Descriptions>

                    <section>
                        <div className="mb-2 text-sm font-semibold">提示词</div>
                        <Typography.Paragraph copyable className="!mb-0 whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-800 dark:bg-stone-900">
                            {history.prompt || "无提示词"}
                        </Typography.Paragraph>
                    </section>

                    <section>
                        <div className="mb-2 text-sm font-semibold">媒体信息</div>
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

                    <section>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold">扣费记录</div>
                            <Tag className="m-0">{creditLogs.length}</Tag>
                        </div>
                        <Table<CreditLog>
                            size="small"
                            rowKey="id"
                            loading={loadingCreditLogs}
                            dataSource={creditLogs}
                            pagination={false}
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到关联扣费记录" /> }}
                            columns={[
                                { title: "时间", dataIndex: "createdAt", render: (value: string) => formatDate(value) },
                                { title: "类型", dataIndex: "type", width: 96, render: (value: CreditLog["type"]) => creditLogTypeLabel(value) },
                                { title: "模型", dataIndex: "model", ellipsis: true },
                                { title: "变动", dataIndex: "amount", width: 96, render: (value: number) => <span className={value < 0 ? "text-red-600" : value > 0 ? "text-green-600" : ""}>{formatCreditAmount(value)}</span> },
                                { title: "剩余金额", dataIndex: "balance", width: 110, render: (value: number) => value.toLocaleString() },
                            ]}
                        />
                    </section>
                </div>
            ) : null}
        </Modal>
    );
}

function MediaRow({ item }: { item: GenerationHistoryMedia }) {
    const dimensions = item.width && item.height ? `${item.width}x${item.height}` : "无尺寸";
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-background px-3 py-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <Tag className="m-0">{item.fileType}</Tag>
            <span>{dimensions}</span>
            <span>{formatBytes(item.size || 0)}</span>
            <span>{item.contentType || "未知类型"}</span>
            <span>删除时间：{formatDate(item.expiresAt)}</span>
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
