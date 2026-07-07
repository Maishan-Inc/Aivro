"use client";

import { FilterOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Avatar, Button, Card, Col, DatePicker, Drawer, Flex, Form, Grid, Input, Row, Select, Space, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

import type { AdminAuditLog } from "@/services/api/admin";
import { useAdminAuditLogs } from "./use-admin-audit-logs";

const auditActionLabels: Record<string, string> = {
    user_register: "用户注册",
    user_update: "用户资料",
    user_delete: "用户管理",
    user_credit_adjust: "用户额度",
    user_workflow_credit_adjust: "用户额度",
    config_update: "系统配置",
    admin_modify: "管理员修改",
};

const auditCategoryLabels: Record<string, string> = {
    user_register: "用户注册",
    user_update: "用户资料",
    user_delete: "用户管理",
    user_credit_adjust: "用户额度",
    user_workflow_credit_adjust: "用户额度",
    config_update: "系统配置",
    用户注册: "用户注册",
    用户资料: "用户资料",
    用户额度: "用户额度",
    用户管理: "用户管理",
    系统配置: "系统配置",
};

const auditCategoryOptions = [
    { label: "全部分类", value: "" },
    { label: "用户注册", value: "用户注册" },
    { label: "用户资料", value: "用户资料" },
    { label: "用户额度", value: "用户额度" },
    { label: "用户管理", value: "用户管理" },
    { label: "系统配置", value: "系统配置" },
];

export default function AdminAuditLogsPage() {
    const { logs, keyword, category, startTime, endTime, page, pageSize, total, isLoading, searchLogs, changePage, changePageSize, resetFilters, refreshLogs } = useAdminAuditLogs();
    const screens = Grid.useBreakpoint();
    const isCompact = !screens.lg;
    const [keywordText, setKeywordText] = useState(keyword);
    const [categoryValue, setCategoryValue] = useState(category);
    const [rangeValue, setRangeValue] = useState<[Dayjs, Dayjs] | null>(startTime && endTime ? [dayjs(startTime), dayjs(endTime)] : null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const applySearch = () => {
        searchLogs(keywordText.trim(), categoryValue, rangeValue?.[0]?.toISOString() || "", rangeValue?.[1]?.toISOString() || "");
        setFiltersOpen(false);
    };

    const resetAndClose = () => {
        setKeywordText("");
        setCategoryValue("");
        setRangeValue(null);
        resetFilters();
        setFiltersOpen(false);
    };

    const filterForm = (compact = false) => (
        <Form layout="vertical">
            <Row gutter={16} align="bottom">
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "360px"}>
                    <Form.Item label="关键词">
                        <Input.Search value={keywordText} placeholder="搜索分类、动作、操作者、目标、备注、IP 或国家" allowClear enterButton={<SearchOutlined />} onSearch={applySearch} onChange={(event) => setKeywordText(event.target.value)} />
                    </Form.Item>
                </Col>
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "180px"}>
                    <Form.Item label="分类">
                        <Select value={categoryValue} options={auditCategoryOptions} onChange={(value) => setCategoryValue(value)} />
                    </Form.Item>
                </Col>
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "360px"}>
                    <Form.Item label="时间范围">
                        <DatePicker.RangePicker value={rangeValue} className="w-full" showTime={{ format: "HH:mm:ss" }} format="YYYY-MM-DD HH:mm:ss" allowClear onChange={(value) => setRangeValue(value as [Dayjs, Dayjs] | null)} />
                    </Form.Item>
                </Col>
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "none"}>
                    <Form.Item>
                        <Space wrap>
                            <Button onClick={resetAndClose}>重置</Button>
                            <Button type="primary" icon={<ReloadOutlined />} onClick={applySearch}>
                                查询
                            </Button>
                        </Space>
                    </Form.Item>
                </Col>
            </Row>
        </Form>
    );

    const columns: ProColumns<AdminAuditLog>[] = [
        {
            title: "分类",
            dataIndex: "category",
            width: 120,
            render: (_, item) => <Tag>{auditCategoryLabels[item.category] || item.category || "-"}</Tag>,
        },
        {
            title: "动作",
            dataIndex: "action",
            width: 140,
            responsive: ["lg"],
            render: (_, item) => <Tag color="blue">{auditActionLabels[item.action] || item.action || "-"}</Tag>,
        },
        {
            title: "操作者",
            dataIndex: "actor",
            width: 240,
            render: (_, item) => <LogUserCell user={item.actor} fallback={item.actorUsername || "系统"} />,
        },
        {
            title: "目标",
            dataIndex: "target",
            width: 240,
            responsive: ["lg"],
            render: (_, item) => (item.targetType === "user" ? <LogUserCell user={item.target} fallback="用户" /> : <Typography.Text type="secondary">{[item.targetType, item.targetId].filter(Boolean).join(" / ") || "-"}</Typography.Text>),
        },
        {
            title: "备注",
            dataIndex: "remark",
            ellipsis: true,
            responsive: ["lg"],
            render: (_, item) => <Typography.Text type="secondary">{item.remark || "-"}</Typography.Text>,
        },
        {
            title: "IP/国家",
            dataIndex: "ip",
            width: 180,
            responsive: ["lg"],
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
        <main className="p-3 sm:p-4 lg:p-6">
            <Flex vertical gap={16}>
                <Card className="lg:hidden" variant="borderless">
                    <Flex align="center" justify="space-between" gap={12}>
                        <Space wrap>
                            <Typography.Text strong>筛选</Typography.Text>
                            {keyword ? <Tag>{keyword}</Tag> : null}
                            {category ? <Tag>{category}</Tag> : <Tag>全部审计</Tag>}
                            {startTime && endTime ? <Tag>已选时间</Tag> : null}
                        </Space>
                        <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>
                            筛选
                        </Button>
                    </Flex>
                </Card>
                <Card className="hidden lg:block" variant="borderless">
                    {filterForm()}
                </Card>
                <ProTable<AdminAuditLog>
                    rowKey="id"
                    columns={columns}
                    dataSource={logs}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    scroll={isCompact ? { x: 620 } : { x: 1320 }}
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
                        simple: isCompact,
                        showSizeChanger: !isCompact,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 条`,
                        onChange: (nextPage, nextPageSize) => (nextPageSize !== pageSize ? changePageSize(nextPageSize) : changePage(nextPage)),
                    }}
                />
            </Flex>
            <Drawer title="筛选日志审计" placement="bottom" height="74vh" open={filtersOpen} onClose={() => setFiltersOpen(false)} destroyOnHidden>
                {filterForm(true)}
            </Drawer>
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
