"use client";

import { StopOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { App, Button, Card, Col, Flex, Form, Input, Modal, Row, Select, Space, Tag, Tooltip, Typography } from "antd";
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
            render: (_, item) => <Tag color={item.locale === "en-US" ? "cyan" : "blue"}>{item.locale === "en-US" ? "English" : "中文"}</Tag>,
        },
        {
            title: "标签",
            dataIndex: "tags",
            width: 200,
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
            render: (_, item) => <Typography.Text copyable ellipsis>{item.userId}</Typography.Text>,
        },
        {
            title: "封禁原因",
            dataIndex: "banReason",
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
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Form layout="vertical">
                        <Row gutter={16} align="bottom">
                            <Col flex="360px">
                                <Form.Item label="关键词">
                                    <Input.Search value={keywordText} placeholder="搜索作品、来源或用户 ID" allowClear enterButton={<SearchOutlined />} onSearch={() => { setPage(1); setKeyword(keywordText); }} onChange={(event) => setKeywordText(event.target.value)} />
                                </Form.Item>
                            </Col>
                            <Col flex="180px">
                                <Form.Item label="状态">
                                    <Select value={status} options={statusOptions} onChange={(value) => { setPage(1); setStatus(value); }} />
                                </Form.Item>
                            </Col>
                            <Col flex="none">
                                <Form.Item>
                                    <Space>
                                        <Button onClick={() => { setKeywordText(""); setKeyword(""); setStatus(""); setPage(1); }}>重置</Button>
                                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadItems()}>查询</Button>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
                <ProTable<WorkflowCommunityPost>
                    rowKey="id"
                    columns={columns}
                    dataSource={items}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    cardProps={{ variant: "borderless" }}
                    headerTitle={<Space><Typography.Text strong>社区工作流</Typography.Text><Tag>{total} 条</Tag></Space>}
                    options={{ density: true, setting: true, reload: () => void loadItems() }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
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
            <Modal title="封禁社区工作流" open={Boolean(banning)} onCancel={() => setBanning(null)} onOk={() => void banItem()} okText="封禁" okButtonProps={{ danger: true }} cancelText="取消">
                <Typography.Paragraph type="secondary">封禁后该作品不会在社区工作流展示，作者在“我的作品”中可看到封禁原因，7 天后自动移除。</Typography.Paragraph>
                <Input.TextArea rows={4} value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="请输入封禁原因" />
            </Modal>
        </main>
    );
}
