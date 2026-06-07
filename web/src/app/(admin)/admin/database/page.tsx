"use client";

import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Space, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";

import { fetchDatabaseStatus, type AdminDatabaseStatus } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

export default function AdminDatabasePage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [status, setStatus] = useState<AdminDatabaseStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            setStatus(await fetchDatabaseStatus(token));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取数据库状态失败");
        } finally {
            setIsLoading(false);
        }
    }, [message, token]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    useEffect(() => {
        const refreshStatus = () => {
            if (document.visibilityState === "visible") void loadStatus();
        };
        window.addEventListener("focus", refreshStatus);
        document.addEventListener("visibilitychange", refreshStatus);
        return () => {
            window.removeEventListener("focus", refreshStatus);
            document.removeEventListener("visibilitychange", refreshStatus);
        };
    }, [loadStatus]);

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        <div>
                            <Typography.Title level={4} style={{ margin: 0 }}>
                                数据库配置
                            </Typography.Title>
                            <Typography.Text type="secondary">数据库会在服务启动时自动更新；这里仅查看当前连接数据库的实际结构和启动更新记录。</Typography.Text>
                        </div>
                        <Space>
                            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void loadStatus()}>
                                刷新
                            </Button>
                        </Space>
                    </Flex>
                </Card>

                <Card variant="borderless">
                    <Flex vertical gap={16}>
                        <Space size={12} wrap>
                            {!status ? (
                                <Tag>未读取</Tag>
                            ) : status.updated ? (
                                <Tag color="success" icon={<CheckCircleOutlined />}>
                                    数据库已是最新
                                </Tag>
                            ) : (
                                <Tag color="error" icon={<CloseCircleOutlined />}>
                                    数据库需要更新
                                </Tag>
                            )}
                            <Typography.Text type="secondary">当前检查基于 GORM AutoMigrate 模型；更新记录成功只代表启动时迁移执行完成，是否仍缺字段以当前结构检查为准。</Typography.Text>
                        </Space>
                        <div>
                            <Typography.Text strong>当前连接</Typography.Text>
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <Tag color={status?.driver === "postgres" ? "blue" : status?.driver === "sqlite" ? "gold" : "default"}>{status?.driver || "unknown"}</Tag>
                                <Typography.Text code copyable={Boolean(status?.dsn)}>
                                    {status?.dsn || "-"}
                                </Typography.Text>
                            </div>
                        </div>
                        <div>
                            <Typography.Text strong>执行来源文件</Typography.Text>
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {(status?.sourceFiles || []).map((file) => (
                                    <Tag key={file}>{file}</Tag>
                                ))}
                            </div>
                        </div>
                        {status?.missing?.length ? (
                            <div>
                                <Typography.Text strong type="danger">
                                    缺失模型
                                </Typography.Text>
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {status.missing.map((item) => (
                                        <Tag color="error" key={item}>
                                            {item}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {status?.missingColumns?.length ? (
                            <div>
                                <Typography.Text strong type="danger">
                                    缺失字段
                                </Typography.Text>
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {status.missingColumns.map((item) => (
                                        <Tag color="error" key={item}>
                                            {item}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </Flex>
                </Card>

                <Card variant="borderless" title="更新记录">
                    <Table
                        rowKey="id"
                        loading={isLoading}
                        dataSource={status?.logs || []}
                        pagination={{ pageSize: 10 }}
                        columns={[
                            {
                                title: "执行时间",
                                dataIndex: "createdAt",
                                width: 210,
                                render: (value) => (value ? new Date(value).toLocaleString("zh-CN") : "-"),
                            },
                            {
                                title: "状态",
                                dataIndex: "status",
                                width: 110,
                                render: (value) => (value === "success" ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>),
                            },
                            {
                                title: "执行文件",
                                dataIndex: "sourceFile",
                                render: (value) => <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value || "-"}</pre>,
                            },
                            {
                                title: "执行模型",
                                dataIndex: "models",
                                render: (value) => <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value || "-"}</pre>,
                            },
                            {
                                title: "错误",
                                dataIndex: "error",
                                render: (value) => value || "-",
                            },
                        ]}
                    />
                </Card>
            </Flex>
        </main>
    );
}
