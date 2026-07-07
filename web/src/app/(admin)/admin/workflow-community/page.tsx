"use client";

import { FilterOutlined, StopOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { App, Button, Card, Col, Drawer, Flex, Form, Grid, Input, Modal, Row, Select, Space, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";

import { banAdminCommunityWorkflow, fetchAdminCommunityWorkflows } from "@/services/api/admin";
import type { WorkflowCommunityPost } from "@/services/api/workflows";
import { useUserStore } from "@/stores/use-user-store";

const statusOptions = [
    { label: "全部状态", value: "" },
    { label: "公开中", value: "active" },
    { label: "已封禁", value: "banned" },
];

export default function AdminWorkflowCommunityPage() {
    const { message } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isCompact = !screens.lg;
    const token = useUserStore((state) => state.token);
    const [items, setItems] = useState<WorkflowCommunityPost[]>([]);
    const [keyword, setKeyword] = useState("");
    const [keywordText, setKeywordText] = useState("");
    const [status, setStatus] = useState("");
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [banning, setBanning] = useState<WorkflowCommunityPost | null>(null);
    const [banReason, setBanReason] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);

    const loadItems = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = await fetchAdminCommunityWorkflows(token, { keyword, type: status, page, pageSize });
            setItems(data.items);
            setTotal(data.total);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取社区工作流失败");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadItems();
    }, [keyword, page, pageSize, status, token]);

    const banItem = async () => {
        if (!token || !banning) return;
        if (!banReason.trim()) {
            message.warning("请填写封禁原因");
            return;
        }
        try {
            const saved = await banAdminCommunityWorkflow(token, banning.id, banReason);
            setItems((old) => old.map((item) => (item.id === saved.id ? saved : item)));
            setBanning(null);
            setBanReason("");
            message.success("已封禁");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "封禁失败");
        }
    };

    const searchAndClose = () => {
        const nextKeyword = keywordText;
        setPage(1);
        setKeyword(nextKeyword);
        setFiltersOpen(false);
        if (nextKeyword === keyword) void loadItems();
    };

    const resetAndClose = () => {
        setKeywordText("");
        setKeyword("");
        setStatus("");
        setPage(1);
        setFiltersOpen(false);
    };

    const filterForm = (compact = false) => (
        <Form layout="vertical">
            <Row gutter={16} align="bottom">
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "360px"}>
                    <Form.Item label="关键词">
                        <Input.Search value={keywordText} placeholder="搜索作品、来源或用户 ID" allowClear enterButton={<SearchOutlined />} onSearch={searchAndClose} onChange={(event) => setKeywordText(event.target.value)} />
                    </Form.Item>
                </Col>
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "180px"}>
                    <Form.Item label="状态">
                        <Select value={status} options={statusOptions} onChange={(value) => { setPage(1); setStatus(value); }} />
                    </Form.Item>
                </Col>
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "none"}>
                    <Form.Item>
                        <Space wrap>
                            <Button onClick={resetAndClose}>重置</Button>
                            <Button type="primary" icon={<ReloadOutlined />} onClick={searchAndClose}>
                                查询
                            </Button>
                        </Space>
                    </Form.Item>
                </Col>
            </Row>
        </Form>
    );

    const columns: ProColumns<WorkflowCommunityPost>[] = [
        {
            title: "作品",
            dataIndex: "title",
            width: 280,
            render: (_, item) => (
                <Flex vertical style={{ minWidth: 0 }}>
                    <Typography.Text strong ellipsis>{item.title}</Typography.Text>
                    <Typography.Text type="secondary" ellipsis>来源：{item.sourceWorkflowTitle}</Typography.Text>
                </Flex>
            ),
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (_, item) => <Tag color={item.status === "banned" ? "red" : "green"}>{item.status === "banned" ? "已封禁" : "公开中"}</Tag>,
        },
        {
            title: "语言",
            dataIndex: "locale",
            width: 96,
            responsive: ["lg"],
            render: (_, item) => <Tag color={item.locale === "en-US" ? "cyan" : "blue"}>{item.locale === "en-US" ? "English" : "中文"}</Tag>,
        },
        {
            title: "标签",
            dataIndex: "tags",
            width: 200,
            responsive: ["lg"],
            render: (_, item) => (
                <Space size={[4, 4]} wrap>
                    {(item.tags || []).slice(0, 4).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                </Space>
            ),
        },
        {
            title: "用户",
            dataIndex: "userId",
            width: 180,
            responsive: ["lg"],
            render: (_, item) => <Typography.Text copyable ellipsis>{item.userId}</Typography.Text>,
        },
        {
            title: "封禁原因",
            dataIndex: "banReason",
            responsive: ["lg"],
            render: (_, item) => <Typography.Text type="secondary" ellipsis>{item.banReason || "-"}</Typography.Text>,
        },
        {
            title: "操作",
            key: "actions",
            width: 88,
            align: "right",
            render: (_, item) => (
                <Tooltip title={item.status === "banned" ? "已封禁" : "封禁"}>
                    <Button danger type="text" size="small" disabled={item.status === "banned"} icon={<StopOutlined />} onClick={() => setBanning(item)} />
                </Tooltip>
            ),
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
                            {status ? <Tag>{status === "banned" ? "已封禁" : "公开中"}</Tag> : <Tag>全部作品</Tag>}
                        </Space>
                        <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>
                            筛选
                        </Button>
                    </Flex>
                </Card>
                <Card className="hidden lg:block" variant="borderless">
                    {filterForm()}
                </Card>
                <ProTable<WorkflowCommunityPost>
                    rowKey="id"
                    columns={columns}
                    dataSource={items}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    scroll={isCompact ? { x: 520 } : undefined}
                    cardProps={{ variant: "borderless" }}
                    headerTitle={<Space><Typography.Text strong>社区工作流</Typography.Text><Tag>{total} 条</Tag></Space>}
                    options={{ density: true, setting: true, reload: () => void loadItems() }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        simple: isCompact,
                        showSizeChanger: !isCompact,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 条`,
                        onChange: (nextPage, nextPageSize) => {
                            if (nextPageSize !== pageSize) {
                                setPage(1);
                                setPageSize(nextPageSize);
                            } else {
                                setPage(nextPage);
                            }
                        },
                    }}
                />
            </Flex>
            <Drawer title="筛选社区工作流" placement="bottom" height="62vh" open={filtersOpen} onClose={() => setFiltersOpen(false)} destroyOnHidden>
                {filterForm(true)}
            </Drawer>
            <Modal title="封禁社区工作流" open={Boolean(banning)} onCancel={() => setBanning(null)} onOk={() => void banItem()} okText="封禁" okButtonProps={{ danger: true }} cancelText="取消">
                <Typography.Paragraph type="secondary">封禁后该作品不会在社区工作流展示，作者在“我的作品”中可看到封禁原因，7 天后自动移除。</Typography.Paragraph>
                <Input.TextArea rows={4} value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="请输入封禁原因" />
            </Modal>
        </main>
    );
}
