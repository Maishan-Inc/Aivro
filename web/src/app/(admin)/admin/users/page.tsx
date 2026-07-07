"use client";

import { DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Avatar, Button, Card, Col, Drawer, Flex, Form, Grid, Input, InputNumber, Modal, Row, Select, Space, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import type { AdminUser } from "@/services/api/admin";
import { useAdminUsers } from "./use-admin-users";

type UserFormValues = Partial<AdminUser> & { password?: string };

const roleOptions = [
    { label: "普通用户", value: "user" },
    { label: "管理员", value: "admin" },
];

const statusOptions = [
    { label: "正常", value: "active" },
    { label: "禁用", value: "ban" },
];

const accountTypeOptions = [
    { label: "个人", value: "personal" },
    { label: "公司", value: "company" },
];

const profileCompletedOptions = [
    { label: "已完成", value: true },
    { label: "未完成", value: false },
];

export default function AdminUsersPage() {
    const { users, keyword, page, pageSize, total, isLoading, searchUsers, changePage, changePageSize, resetFilters, refreshUsers, saveUser: saveAdminUser, adjustCredits, adjustWorkflowCreateCredits, deleteUser } = useAdminUsers();
    const screens = Grid.useBreakpoint();
    const isCompact = !screens.lg;
    const [form] = Form.useForm<UserFormValues>();
    const [keywordText, setKeywordText] = useState(keyword);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AdminUser> | null>(null);
    const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

    useEffect(() => setKeywordText(keyword), [keyword]);

    useEffect(() => {
        if (editingUser) form.setFieldsValue({ role: "user", status: "active", accountType: "personal", profileCompleted: false, ...editingUser, password: "" });
    }, [editingUser, form]);

    const saveUser = async () => {
        const value = await form.validateFields();
        const userValue = { ...value };
        delete userValue.credits;
        delete userValue.workflowCreateCredits;
        await saveAdminUser({ ...editingUser, ...userValue, password: value.password || undefined });
        setEditingUser(null);
    };

    const saveCredits = async () => {
        if (!editingUser?.id) return;
        const saved = await adjustCredits(editingUser.id, form.getFieldValue("credits") || 0);
        setEditingUser(saved);
    };

    const saveWorkflowCreateCredits = async () => {
        if (!editingUser?.id) return;
        const saved = await adjustWorkflowCreateCredits(editingUser.id, form.getFieldValue("workflowCreateCredits") || 0);
        setEditingUser(saved);
    };

    const searchAndClose = () => {
        searchUsers(keywordText);
        setFiltersOpen(false);
    };

    const resetAndClose = () => {
        setKeywordText("");
        resetFilters();
        setFiltersOpen(false);
    };

    const filterForm = (compact = false) => (
        <Form layout="vertical">
            <Row gutter={16} align="bottom">
                <Col span={compact ? 24 : undefined} flex={compact ? undefined : "360px"}>
                    <Form.Item label="关键词">
                        <Input.Search value={keywordText} placeholder="搜索用户名、昵称、邮箱或第三方 ID" allowClear enterButton={<SearchOutlined />} onSearch={searchAndClose} onChange={(event) => setKeywordText(event.target.value)} />
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

    const columns: ProColumns<AdminUser>[] = [
        {
            title: "用户",
            dataIndex: "username",
            width: 260,
            render: (_, item) => (
                <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                    <Avatar src={item.avatarUrl || undefined}>{(item.displayName || item.username || "U").slice(0, 1).toUpperCase()}</Avatar>
                    <Flex vertical style={{ minWidth: 0 }}>
                        <Typography.Text strong ellipsis>
                            {item.displayName || item.username}
                        </Typography.Text>
                        <Typography.Text type="secondary" ellipsis>
                            {item.username}
                        </Typography.Text>
                    </Flex>
                </Flex>
            ),
        },
        {
            title: "角色",
            dataIndex: "role",
            width: 100,
            render: (_, item) => <Tag color={item.role === "admin" ? "gold" : "default"}>{item.role === "admin" ? "管理员" : "用户"}</Tag>,
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (_, item) => <Tag color={item.status === "ban" ? "red" : "green"}>{item.status === "ban" ? "禁用" : "正常"}</Tag>,
        },
        {
            title: "类型",
            dataIndex: "accountType",
            width: 90,
            responsive: ["lg"],
            render: (_, item) => <Tag>{item.accountType === "company" ? "公司" : "个人"}</Tag>,
        },
        {
            title: "资料",
            dataIndex: "profileCompleted",
            width: 90,
            responsive: ["lg"],
            render: (_, item) => <Tag color={item.profileCompleted ? "green" : "orange"}>{item.profileCompleted ? "已完成" : "未完成"}</Tag>,
        },
        {
            title: "算力点",
            dataIndex: "credits",
            width: 100,
            responsive: ["lg"],
            render: (_, item) => <Typography.Text>{item.credits}</Typography.Text>,
        },
        {
            title: "工作流次数",
            dataIndex: "workflowCreateCredits",
            width: 120,
            responsive: ["lg"],
            render: (_, item) => <Typography.Text>{item.workflowCreateCredits}</Typography.Text>,
        },
        {
            title: "登录来源",
            dataIndex: "authProvider",
            width: 180,
            responsive: ["lg"],
            render: (_, item) => (
                <Space direction="vertical" size={0}>
                    <Tag>{item.authProvider || "password"}</Tag>
                    <Typography.Text type="secondary" ellipsis style={{ maxWidth: 150 }}>
                        {item.metamaskAddress || item.googleId || item.githubId || item.linuxDoId || "-"}
                    </Typography.Text>
                </Space>
            ),
        },
        {
            title: "最近登录",
            dataIndex: "lastLoginAt",
            width: 180,
            responsive: ["lg"],
            render: (_, item) => <Typography.Text type="secondary">{item.lastLoginAt ? dayjs(item.lastLoginAt).format("YYYY-MM-DD HH:mm:ss") : "-"}</Typography.Text>,
        },
        {
            title: "操作",
            key: "actions",
            width: 96,
            align: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Tooltip title="编辑">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingUser(item)} />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => setDeletingUser(item)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <main className="p-3 sm:p-4 lg:p-6">
            <Flex vertical gap={16}>
                <Card className="lg:hidden" variant="borderless">
                    <Flex align="center" justify="space-between" gap={12}>
                        <Space>
                            <Typography.Text strong>筛选</Typography.Text>
                            {keyword ? <Tag>{keyword}</Tag> : <Tag>全部用户</Tag>}
                        </Space>
                        <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>
                            筛选
                        </Button>
                    </Flex>
                </Card>
                <Card className="hidden lg:block" variant="borderless">
                    {filterForm()}
                </Card>
                <ProTable<AdminUser>
                    rowKey="id"
                    columns={columns}
                    dataSource={users}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    scroll={isCompact ? { x: 560 } : undefined}
                    cardProps={{ variant: "borderless" }}
                    headerTitle={
                        <Space>
                            <Typography.Text strong>用户列表</Typography.Text>
                            <Tag>{total} 人</Tag>
                        </Space>
                    }
                    options={{ density: true, setting: true, reload: () => void refreshUsers() }}
                    toolBarRender={() => [
                        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => setEditingUser({ role: "user", status: "active", accountType: "personal", profileCompleted: false })}>
                            新增
                        </Button>,
                    ]}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        simple: isCompact,
                        showSizeChanger: !isCompact,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 人`,
                        onChange: (nextPage, nextPageSize) => (nextPageSize !== pageSize ? changePageSize(nextPageSize) : changePage(nextPage)),
                    }}
                />
            </Flex>
            <Drawer title="筛选用户" placement="bottom" height="62vh" open={filtersOpen} onClose={() => setFiltersOpen(false)} destroyOnHidden>
                {filterForm(true)}
            </Drawer>

            <Modal title={editingUser?.id ? "编辑用户" : "新增用户"} open={Boolean(editingUser)} width="min(920px, calc(100vw - 24px))" onCancel={() => setEditingUser(null)} onOk={() => void saveUser()} okText="保存资料" cancelText="取消" destroyOnHidden>
                <Form form={form} layout="vertical" requiredMark={false}>
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <Flex align="flex-start" justify="space-between" gap={16}>
                            <Flex vertical gap={8} style={{ minWidth: 0 }}>
                                <Space size={8} wrap>
                                    <Typography.Title level={4} style={{ margin: 0 }}>
                                        {editingUser?.displayName || editingUser?.username || "新用户"}
                                    </Typography.Title>
                                    <Tag color={editingUser?.role === "admin" ? "gold" : "default"}>{editingUser?.role === "admin" ? "管理员" : "普通用户"}</Tag>
                                    {editingUser?.status ? <Tag color={editingUser.status === "ban" ? "red" : "green"}>{editingUser.status === "ban" ? "禁用" : "正常"}</Tag> : null}
                                </Space>
                                <Typography.Text type="secondary" ellipsis>
                                    {editingUser?.email || editingUser?.username || "填写账号信息后创建用户"}
                                </Typography.Text>
                                {editingUser?.id ? (
                                    <Space size={[6, 6]} wrap>
                                        <Tag>算力点 {editingUser.credits ?? 0}</Tag>
                                        <Tag color="blue">工作流次数 {editingUser.workflowCreateCredits ?? 0}</Tag>
                                        <Tag>{editingUser.authProvider || "password"}</Tag>
                                    </Space>
                                ) : null}
                            </Flex>
                            <Avatar size={76} src={editingUser?.avatarUrl || undefined} style={{ flex: "0 0 auto" }}>
                                {(editingUser?.displayName || editingUser?.username || "U").slice(0, 1).toUpperCase()}
                            </Avatar>
                        </Flex>
                    </Card>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={14}>
                            <Card size="small" title="账号资料">
                                <Row gutter={14}>
                                    <Col xs={24} md={12}>
                                        <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name="password" label={editingUser?.id ? "新密码" : "密码"} rules={editingUser?.id ? [] : [{ required: true, message: "请输入密码" }]}>
                                            <Input.Password autoComplete="new-password" placeholder={editingUser?.id ? "留空则不修改" : ""} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name="displayName" label="昵称">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name="email" label="邮箱">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="accountType" label="账户类型">
                                            <Select options={accountTypeOptions} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="profileCompleted" label="资料状态">
                                            <Select options={profileCompletedOptions} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="emailVerified" label="邮箱验证">
                                            <Select
                                                options={[
                                                    { label: "已验证", value: true },
                                                    { label: "未验证", value: false },
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                        <Col xs={24} lg={10}>
                            <Card size="small" title="权限与状态">
                                <Row gutter={14}>
                                    <Col xs={24} md={12} lg={24}>
                                        <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
                                            <Select options={roleOptions} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12} lg={24}>
                                        <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                                            <Select options={statusOptions} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                        <Col xs={24}>
                            <Card size="small" title="第三方登录">
                                <Row gutter={14}>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="authProvider" label="登录来源">
                                            <Input placeholder="password / google / github / linux-do / metamask" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="googleId" label="Google ID">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="githubId" label="GitHub ID">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name="linuxDoId" label="Linux.do ID">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={16}>
                                        <Form.Item name="metamaskAddress" label="钱包地址">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                    </Row>
                    {editingUser?.id ? (
                        <>
                            <Card size="small" title="额度调整" style={{ marginTop: 16 }}>
                                <Row gutter={14}>
                                    <Col xs={24} md={12}>
                                        <Form.Item label="算力点">
                                            <Space.Compact style={{ width: "100%" }}>
                                                <Form.Item name="credits" noStyle>
                                                    <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                                                </Form.Item>
                                                <Button onClick={() => void saveCredits()}>调整</Button>
                                            </Space.Compact>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item label="工作流创建次数">
                                        <Space.Compact style={{ width: "100%" }}>
                                            <Form.Item name="workflowCreateCredits" noStyle>
                                                <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                                            </Form.Item>
                                            <Button onClick={() => void saveWorkflowCreateCredits()}>调整</Button>
                                        </Space.Compact>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        </>
                    ) : null}
                </Form>
            </Modal>

            <Modal
                title="删除用户"
                open={Boolean(deletingUser)}
                onCancel={() => setDeletingUser(null)}
                onOk={async () => {
                    if (!deletingUser) return;
                    await deleteUser(deletingUser.id);
                    setDeletingUser(null);
                }}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
            >
                确定删除「{deletingUser?.displayName || deletingUser?.username}」吗？删除后该账号将无法继续登录。
            </Modal>
        </main>
    );
}
