"use client";

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Avatar, Button, Card, Col, DatePicker, Flex, Form, Input, Row, Select, Space, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

import type { AdminCreditLog } from "@/services/api/admin";
import { useAdminRequestLogs } from "./use-admin-request-logs";

const requestLogCategoryLabels: Record<string, string> = {
    admin_adjust: "后台调整",
    ai_consume: "模型请求",
    ai_refund: "失败返还",
    后台调整: "后台调整",
    模型请求: "模型请求",
    失败返还: "失败返还",
};

const requestLogTypeLabels: Record<string, string> = {
    admin_adjust: "后台调整",
    ai_consume: "模型请求",
    ai_refund: "失败返还",
};

const requestLogCategoryOptions = [
    { label: "全部分类", value: "" },
    { label: "后台调整", value: "后台调整" },
    { label: "模型请求", value: "模型请求" },
    { label: "失败返还", value: "失败返还" },
];

export default function AdminRequestLogsPage() {
    const { logs, keyword, category, startTime, endTime, page, pageSize, total, isLoading, searchLogs, changePage, changePageSize, resetFilters, refreshLogs } = useAdminRequestLogs();
    const [keywordText, setKeywordText] = useState(keyword);
    const [categoryValue, setCategoryValue] = useState(category);
    const [rangeValue, setRangeValue] = useState<[Dayjs, Dayjs] | null>(startTime && endTime ? [dayjs(startTime), dayjs(endTime)] : null);

    const applySearch = () => searchLogs(keywordText.trim(), categoryValue, rangeValue?.[0]?.toISOString() || "", rangeValue?.[1]?.toISOString() || "");

    const columns: ProColumns<AdminCreditLog>[] = [
        {
            title: "分类",
            dataIndex: "category",
            width: 120,
            render: (_, item) => <Tag>{requestLogCategoryLabels[item.category] || item.category || requestLogTypeLabels[item.type] || "-"}</Tag>,
        },
        {
            title: "类型",
            dataIndex: "type",
            width: 120,
            render: (_, item) => <Tag color="blue">{requestLogTypeLabels[item.type] || item.type || "-"}</Tag>,
        },
        {
            title: "用户",
            dataIndex: "user",
            width: 240,
            render: (_, item) => <LogUserCell user={item.user} fallback="未知用户" />,
        },
        {
            title: "模型",
            dataIndex: "model",
            width: 180,
            render: (_, item) => <Typography.Text ellipsis>{item.model || "-"}</Typography.Text>,
        },
        {
            title: "路径",
            dataIndex: "path",
            width: 180,
            render: (_, item) => <Typography.Text code copyable={Boolean(item.path)} ellipsis>{item.path || "-"}</Typography.Text>,
        },
        {
            title: "变动",
            dataIndex: "amount",
            width: 100,
            render: (_, item) => <Typography.Text type={item.amount >= 0 ? "success" : "danger"}>{item.amount}</Typography.Text>,
        },
        {
            title: "余额",
            dataIndex: "balance",
            width: 100,
        },
        {
            title: "备注",
            dataIndex: "remark",
            ellipsis: true,
            render: (_, item) => <Typography.Text type="secondary">{item.remark || "-"}</Typography.Text>,
        },
        {
            title: "IP/国家",
            dataIndex: "ip",
            width: 180,
            render: (_, item) => <Typography.Text type="secondary">{[item.ip, item.country].filter(Boolean).join(" / ") || "-"}</Typography.Text>,
        },
        {
            title: "时间",
            dataIndex: "createdAt",
            width: 180,
            render: (_, item) => <Typography.Text type="secondary">{item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : "-"}</Typography.Text>,
        },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Form layout="vertical">
                        <Row gutter={16} align="bottom">
                            <Col flex="360px">
                                <Form.Item label="关键词">
                                    <Input.Search
                                        value={keywordText}
                                        placeholder="搜索用户、模型、路径、备注、IP 或国家"
                                        allowClear
                                        enterButton={<SearchOutlined />}
                                        onSearch={applySearch}
                                        onChange={(event) => setKeywordText(event.target.value)}
                                    />
                                </Form.Item>
                            </Col>
                            <Col flex="180px">
                                <Form.Item label="分类">
                                    <Select value={categoryValue} options={requestLogCategoryOptions} onChange={(value) => setCategoryValue(value)} />
                                </Form.Item>
                            </Col>
                            <Col flex="360px">
                                <Form.Item label="时间范围">
                                    <DatePicker.RangePicker
                                        value={rangeValue}
                                        className="w-full"
                                        showTime={{ format: "HH:mm:ss" }}
                                        format="YYYY-MM-DD HH:mm:ss"
                                        allowClear
                                        onChange={(value) => setRangeValue(value as [Dayjs, Dayjs] | null)}
                                    />
                                </Form.Item>
                            </Col>
                            <Col flex="none">
                                <Form.Item>
                                    <Space>
                                        <Button
                                            onClick={() => {
                                                setKeywordText("");
                                                setCategoryValue("");
                                                setRangeValue(null);
                                                resetFilters();
                                            }}
                                        >
                                            重置
                                        </Button>
                                        <Button type="primary" icon={<ReloadOutlined />} onClick={applySearch}>
                                            查询
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
                <ProTable<AdminCreditLog>
                    rowKey="id"
                    columns={columns}
                    dataSource={logs}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    scroll={{ x: 1540 }}
                    cardProps={{ variant: "borderless" }}
                    headerTitle={
                        <Space>
                            <Typography.Text strong>请求日志</Typography.Text>
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
            </Flex>
        </main>
    );
}

function LogUserCell({ user, fallback }: { user?: { avatarUrl: string; displayName: string; username: string }; fallback: string }) {
    const name = user?.displayName || user?.username || fallback;
    const avatarUrl = user?.avatarUrl?.trim();
    return (
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
            <Avatar size={32} src={avatarUrl ? <img src={avatarUrl} alt={name} referrerPolicy="no-referrer" /> : undefined}>
                {(name[0] || "U").toUpperCase()}
            </Avatar>
            <Typography.Text strong ellipsis>
                {name}
            </Typography.Text>
        </Flex>
    );
}
