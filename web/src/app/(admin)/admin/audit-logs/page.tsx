"use client";

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Button, Card, Col, Form, Input, Row, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import type { AdminAuditLog } from "@/services/api/admin";
import { useAdminAuditLogs } from "./use-admin-audit-logs";

const auditActionLabels: Record<string, string> = {
    user_register: "用户注册",
    admin_modify: "管理员修改",
    config_update: "配置修改",
};

export default function AdminAuditLogsPage() {
    const { logs, keyword, page, pageSize, total, isLoading, searchLogs, changePage, changePageSize, resetFilters, refreshLogs } = useAdminAuditLogs();
    const [keywordText, setKeywordText] = useState(keyword);

    useEffect(() => setKeywordText(keyword), [keyword]);

    const columns: ProColumns<AdminAuditLog>[] = [
        {
            title: "动作",
            dataIndex: "action",
            width: 140,
            render: (_, item) => <Tag>{auditActionLabels[item.action] || item.action || "-"}</Tag>,
        },
        {
            title: "操作者",
            dataIndex: "actorUsername",
            width: 180,
            render: (_, item) => <Typography.Text>{item.actorUsername || item.actorId || "系统"}</Typography.Text>,
        },
        {
            title: "目标",
            dataIndex: "targetId",
            width: 240,
            render: (_, item) => <Typography.Text copyable={Boolean(item.targetId)}>{[item.targetType, item.targetId].filter(Boolean).join(" / ") || "-"}</Typography.Text>,
        },
        {
            title: "备注",
            dataIndex: "remark",
            ellipsis: true,
            render: (_, item) => <Typography.Text type="secondary">{item.remark || "-"}</Typography.Text>,
        },
        {
            title: "IP地址/国家",
            dataIndex: "ip",
            width: 180,
            render: (_, item) => <Typography.Text type="secondary">{[item.ip, item.country].filter(Boolean).join(" / ") || "-"}</Typography.Text>,
        },
        {
            title: "创建时间",
            dataIndex: "createdAt",
            width: 180,
            render: (_, item) => <Typography.Text type="secondary">{item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : "-"}</Typography.Text>,
        },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card variant="borderless">
                    <Form layout="vertical">
                        <Row gutter={16} align="bottom">
                            <Col flex="360px">
                                <Form.Item label="关键词">
                                    <Input.Search value={keywordText} placeholder="搜索动作、操作者、目标、备注、IP 或国家" allowClear enterButton={<SearchOutlined />} onSearch={() => searchLogs(keywordText)} onChange={(event) => setKeywordText(event.target.value)} />
                                </Form.Item>
                            </Col>
                            <Col flex="none">
                                <Form.Item>
                                    <Space>
                                        <Button
                                            onClick={() => {
                                                setKeywordText("");
                                                resetFilters();
                                            }}
                                        >
                                            重置
                                        </Button>
                                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => searchLogs(keywordText)}>
                                            查询
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
                <ProTable<AdminAuditLog>
                    rowKey="id"
                    columns={columns}
                    dataSource={logs}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    cardProps={{ variant: "borderless" }}
                    headerTitle={
                        <Space>
                            <Typography.Text strong>日志审计</Typography.Text>
                            <Tag>{total} 条</Tag>
                        </Space>
                    }
                    options={{ density: true, setting: true, reload: () => void refreshLogs() }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 条`,
                        onChange: (nextPage, nextPageSize) => (nextPageSize !== pageSize ? changePageSize(nextPageSize) : changePage(nextPage)),
                    }}
                />
            </Space>
        </main>
    );
}
