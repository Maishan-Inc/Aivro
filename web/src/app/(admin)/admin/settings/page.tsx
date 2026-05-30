"use client";

import { CheckCircleOutlined, DeleteOutlined, FormatPainterOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { json } from "@codemirror/lang-json";
import { App, Button, Card, Checkbox, Col, Drawer, Flex, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { EditorView } from "@uiw/react-codemirror";

import { fetchAdminSettings, fetchChannelModels, saveAdminSettings, testChannelModel, updateDatabase, type AdminModelChannel, type AdminModelCost, type AdminPrivateAuthProvider, type AdminPublicAuthProvider, type AdminSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });
const jsonEditorTheme = EditorView.theme({
    "&": { backgroundColor: "var(--ant-color-bg-container)", color: "var(--ant-color-text)" },
    ".cm-content": { caretColor: "var(--ant-color-text)", padding: "12px 0" },
    ".cm-line": { padding: "0 18px" },
    ".cm-gutters": { backgroundColor: "var(--ant-color-fill-quaternary)", borderRight: "1px solid var(--ant-color-border)", color: "var(--ant-color-text-tertiary)" },
    ".cm-activeLine": { backgroundColor: "var(--ant-color-fill-quaternary)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--ant-color-fill-quaternary)", color: "var(--ant-color-text)" },
    ".cm-cursor": { borderLeftColor: "var(--ant-color-text)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--ant-control-item-bg-active)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--ant-color-fill-quaternary)", border: "1px solid var(--ant-color-border)", color: "var(--ant-color-text-tertiary)" },
    "&.cm-focused": { outline: "none" },
});

const emptyPublicProvider = (id: string, name: string, iconUrl = ""): AdminPublicAuthProvider => ({ id, name, iconUrl, enabled: false });
const emptyPrivateProvider = (id: string, name: string, iconUrl = ""): AdminPrivateAuthProvider => ({ ...emptyPublicProvider(id, name, iconUrl), clientId: "", clientSecret: "", authorizeUrl: "", tokenUrl: "", userInfoUrl: "", scope: "" });

const emptySettings: AdminSettings = {
    public: {
        modelChannel: {
            availableModels: [],
            modelCosts: [],
            defaultModel: "",
            defaultImageModel: "",
            defaultVideoModel: "",
            defaultTextModel: "",
            systemPrompt: "",
            allowCustomChannel: true,
        },
        auth: {
            allowRegister: true,
            emailVerification: false,
            linuxDo: emptyPublicProvider("linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: emptyPublicProvider("google", "Google"),
            github: emptyPublicProvider("github", "GitHub"),
            metamask: emptyPublicProvider("metamask", "MetaMask"),
            customProviders: [emptyPublicProvider("o2", "O2")],
        },
    },
    private: {
        channels: [],
        promptSync: { enabled: true, cron: "*/5 * * * *" },
        auth: {
            linuxDo: emptyPrivateProvider("linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: emptyPrivateProvider("google", "Google"),
            github: emptyPrivateProvider("github", "GitHub"),
            metamask: { enabled: false },
            customProviders: [emptyPrivateProvider("o2", "O2")],
        },
        mail: {
            enabled: false,
            host: "",
            port: 587,
            username: "",
            password: "",
            fromEmail: "",
            fromName: "",
            codeExpireMin: 10,
            templates: {
                register: { subject: "注册验证码：{{code}}", body: "你的注册验证码是 {{code}}，{{expireMinutes}} 分钟内有效。" },
                reset: { subject: "找回密码验证码：{{code}}", body: "你的找回密码验证码是 {{code}}，{{expireMinutes}} 分钟内有效。" },
                metamask: { subject: "MetaMask 登录邮箱验证码：{{code}}", body: "你的 MetaMask 登录邮箱验证码是 {{code}}，{{expireMinutes}} 分钟内有效。" },
            },
        },
    },
};
const emptyChannel: AdminModelChannel = { protocol: "openai", name: "", baseUrl: "", apiKey: "", models: [], weight: 1, enabled: true, remark: "" };

type SettingsTabKey = "public" | "private" | "mail" | "thirdParty";
type EditorMode = "visual" | "json";
type ModelSelectTabKey = "new" | "current";

export default function AdminSettingsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [form] = Form.useForm<AdminSettings>();
    const [activeTab, setActiveTab] = useState<SettingsTabKey>("public");
    const [editorMode, setEditorMode] = useState<Record<string, EditorMode>>({ public: "visual", private: "visual" });
    const [jsonText, setJsonText] = useState<Record<string, string>>({ public: "", private: "" });
    const [channels, setChannels] = useState<AdminModelChannel[]>([]);
    const [channelForm] = Form.useForm<AdminModelChannel>();
    const [editingChannelIndex, setEditingChannelIndex] = useState<number | null>(null);
    const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
    const [testChannelIndex, setTestChannelIndex] = useState<number | null>(null);
    const [testKeyword, setTestKeyword] = useState("");
    const [selectedTestModels, setSelectedTestModels] = useState<string[]>([]);
    const [testingModels, setTestingModels] = useState<string[]>([]);
    const [testResults, setTestResults] = useState<Record<string, { status: "success" | "error"; duration?: string; message: string }>>({});
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [modelSelectSource, setModelSelectSource] = useState<string[]>([]);
    const [modelSelectExisting, setModelSelectExisting] = useState<string[]>([]);
    const [modelSelectSelected, setModelSelectSelected] = useState<string[]>([]);
    const [modelSelectKeyword, setModelSelectKeyword] = useState("");
    const [modelSelectNewModel, setModelSelectNewModel] = useState("");
    const [modelSelectTab, setModelSelectTab] = useState<ModelSelectTabKey>("new");
    const [isFetchingChannelModels, setIsFetchingChannelModels] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingDatabase, setIsUpdatingDatabase] = useState(false);
    const [modelCosts, setModelCosts] = useState<AdminModelCost[]>([]);
    const [knownModels, setKnownModels] = useState<string[]>([]);
    const publicModels = Form.useWatch(["public", "modelChannel", "availableModels"], form) || [];
    const channelModels = useMemo(() => collectChannelModels(channels), [channels]);
    const channelTableData = useMemo(() => channels.map((channel, index) => ({ ...channel, _index: index, _rowKey: `${index}-${channel.name}-${channel.baseUrl}` })), [channels]);
    const activeMode = activeTab === "mail" || activeTab === "thirdParty" ? "visual" : editorMode[activeTab];
    const activeJsonText = jsonText[activeTab] || "";
    const jsonError = activeMode === "json" ? getJsonError(activeJsonText) : "";
    const modelSelectGroups = useMemo(() => buildModelSelectGroups(modelSelectSource, modelSelectExisting), [modelSelectSource, modelSelectExisting]);
    const activeModelSelectModels = useMemo(() => {
        const keyword = modelSelectKeyword.trim().toLowerCase();
        return modelSelectGroups[modelSelectTab].filter((model) => model.toLowerCase().includes(keyword));
    }, [modelSelectGroups, modelSelectKeyword, modelSelectTab]);
    const activeSelectedCount = activeModelSelectModels.filter((model) => modelSelectSelected.includes(model)).length;

    const loadSettings = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            form.setFieldsValue(data);
            setChannels(data.private.channels);
            setModelCosts(data.public.modelChannel.modelCosts);
            setKnownModels(collectKnownModels(data));
            setJsonText({
                public: JSON.stringify(data.public, null, 2),
                private: JSON.stringify(data.private, null, 2),
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取设置失败");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const changeTab = (nextTab: SettingsTabKey) => {
        setActiveTab(nextTab);
    };

    const saveSettings = async () => {
        if (!token) return;
        const values = await collectSettings(form, editorMode, jsonText, message);
        if (!values) {
            return;
        }
        setIsSaving(true);
        try {
            const saved = normalizeSettings(await saveAdminSettings(token, values));
            const merged = mergeChannelApiKeys(values.private.channels, saved);
            form.setFieldsValue(merged);
            setChannels(merged.private.channels);
            setModelCosts(merged.public.modelChannel.modelCosts);
            rememberKnownModels(merged);
            setJsonText({
                public: JSON.stringify(merged.public, null, 2),
                private: JSON.stringify(merged.private, null, 2),
            });
            message.success("已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setIsSaving(false);
        }
    };

    const updateDatabaseSchema = async () => {
        if (!token) return;
        setIsUpdatingDatabase(true);
        try {
            await updateDatabase(token);
            message.success("数据库已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "数据库更新失败");
        } finally {
            setIsUpdatingDatabase(false);
        }
    };

    const toggleMode = (tab: SettingsTabKey, nextMode: EditorMode) => {
        if (tab !== "public" && tab !== "private") return;
        if (nextMode === "json") {
            setJsonText((current) => ({
                ...current,
                [tab]: JSON.stringify(tab === "public" ? normalizePublicSetting(form.getFieldValue(["public"]) as Partial<AdminSettings["public"]>) : normalizePrivateSetting(form.getFieldValue(["private"]) as Partial<AdminSettings["private"]>), null, 2),
            }));
            setEditorMode((current) => ({ ...current, [tab]: nextMode }));
            return;
        }
        const parsed = parseTabJson(tab, jsonText[tab]);
        if (!parsed) {
            message.error("JSON 格式不正确");
            return;
        }
        form.setFieldsValue({ [tab]: parsed } as Partial<AdminSettings>);
        if (tab === "private") setChannels((parsed as AdminSettings["private"]).channels);
        if (tab === "public") setModelCosts((parsed as AdminSettings["public"]).modelChannel.modelCosts);
        rememberKnownModels({ ...normalizeSettings(form.getFieldsValue(true) as AdminSettings), [tab]: parsed });
        setEditorMode((current) => ({ ...current, [tab]: nextMode }));
    };

    const formatJson = (tab: SettingsTabKey) => {
        if (tab !== "public" && tab !== "private") return;
        const parsed = parseTabJson(tab, jsonText[tab]);
        if (!parsed) {
            message.error("JSON 格式不正确");
            return;
        }
        if (tab === "public") setModelCosts((parsed as AdminSettings["public"]).modelChannel.modelCosts);
        setJsonText((current) => ({
            ...current,
            [tab]: JSON.stringify(parsed, null, 2),
        }));
    };

    const openChannelDrawer = (index: number | null) => {
        setEditingChannelIndex(index);
        setIsChannelDrawerOpen(true);
        const channel = index === null ? emptyChannel : normalizeChannel(channels[index]);
        channelForm.setFieldsValue(channel);
        rememberModels(channel.models);
    };

    const closeChannelDrawer = () => {
        setIsChannelDrawerOpen(false);
        setEditingChannelIndex(null);
        channelForm.resetFields();
    };

    const saveChannel = async () => {
        const channel = normalizeChannel(await channelForm.validateFields());
        rememberModels(channel.models);
        const nextChannels = [...channels];
        if (editingChannelIndex === null) nextChannels.push(channel);
        else nextChannels[editingChannelIndex] = channel;
        await persistChannels(nextChannels);
        closeChannelDrawer();
    };

    const fetchChannelModelList = async () => {
        if (!token) return;
        const channel = channelForm.getFieldsValue();
        if (!channel?.baseUrl) {
            message.warning("请先填写接口地址");
            return;
        }
        if (editingChannelIndex === null && !channel?.apiKey) {
            message.warning("请先填写 API Key");
            return;
        }
        setIsFetchingChannelModels(true);
        try {
            const channelModels = await fetchChannelModels(token, { index: editingChannelIndex ?? undefined, channel: normalizeChannel(channel) });
            const current = isModelSelectorOpen ? uniqueModels(modelSelectSelected) : uniqueModels(channelForm.getFieldValue("models") || []);
            rememberModels(channelModels);
            setModelSelectExisting(current);
            setModelSelectSource(uniqueModels(channelModels));
            setModelSelectSelected(uniqueModels([...current, ...channelModels]));
            setModelSelectKeyword("");
            setModelSelectNewModel("");
            setModelSelectTab("new");
            setIsModelSelectorOpen(true);
            message.success(`已获取 ${channelModels.length} 个模型，请选择后确认`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setIsFetchingChannelModels(false);
        }
    };

    const openChannelModelSelector = (sourceModels?: string[]) => {
        const current = uniqueModels(channelForm.getFieldValue("models") || []);
        const source = uniqueModels(sourceModels !== undefined ? sourceModels : [...knownModels, ...current]);
        setModelSelectExisting(current);
        setModelSelectSource(source);
        setModelSelectSelected(sourceModels ? uniqueModels([...current, ...source]) : current);
        setModelSelectKeyword("");
        setModelSelectNewModel("");
        setModelSelectTab(sourceModels ? "new" : "current");
        setIsModelSelectorOpen(true);
    };

    const closeChannelModelSelector = () => {
        setIsModelSelectorOpen(false);
        setModelSelectKeyword("");
        setModelSelectNewModel("");
    };

    const confirmChannelModelSelector = () => {
        const models = uniqueModels(modelSelectSelected);
        channelForm.setFieldValue("models", models);
        rememberModels(models);
        closeChannelModelSelector();
    };

    const toggleSelectedModel = (model: string, checked: boolean) => {
        setModelSelectSelected((current) => (checked ? uniqueModels([...current, model]) : current.filter((item) => item !== model)));
    };

    const selectActiveModels = () => {
        setModelSelectSelected((current) => uniqueModels([...current, ...activeModelSelectModels]));
    };

    const clearActiveModels = () => {
        const active = new Set(activeModelSelectModels);
        setModelSelectSelected((current) => current.filter((model) => !active.has(model)));
    };

    const addModelInSelector = () => {
        const model = modelSelectNewModel.trim();
        if (!model) return;
        setModelSelectExisting((current) => uniqueModels([...current, model]));
        setModelSelectSelected((current) => uniqueModels([...current, model]));
        setModelSelectNewModel("");
        setModelSelectTab("current");
    };

    function rememberModels(models: string[]) {
        setKnownModels((current) => uniqueModels([...current, ...models]));
    }

    function rememberKnownModels(settings: AdminSettings) {
        rememberModels(collectKnownModels(settings));
    }

    const openTestDialog = (index: number) => {
        const channel = normalizeChannel(channels[index]);
        if (!channel.baseUrl || channel.models.length === 0) {
            message.warning("请先填写接口地址和至少一个模型");
            return;
        }
        setTestChannelIndex(index);
        setTestKeyword("");
        setSelectedTestModels([]);
        setTestingModels([]);
        setTestResults({});
    };

    const closeTestDialog = () => {
        setTestChannelIndex(null);
        setTestKeyword("");
        setSelectedTestModels([]);
        setTestingModels([]);
        setTestResults({});
    };

    const testModelOnline = async (model: string) => {
        if (testChannelIndex === null) return;
        if (!token) return;
        const channel = normalizeChannel(channels[testChannelIndex]);
        setTestingModels((current) => [...current, model]);
        try {
            const startedAt = performance.now();
            const result = await testChannelModel(token, { index: testChannelIndex, channel, model });
            setTestResults((current) => ({ ...current, [model]: { status: "success", duration: `${((performance.now() - startedAt) / 1000).toFixed(2)}s`, message: result } }));
        } catch (error) {
            setTestResults((current) => ({ ...current, [model]: { status: "error", message: error instanceof Error ? error.message : "测试失败" } }));
        } finally {
            setTestingModels((current) => current.filter((item) => item !== model));
        }
    };

    const batchTestModels = async () => {
        for (const model of selectedTestModels) {
            await testModelOnline(model);
        }
    };

    const testChannel = testChannelIndex === null ? null : normalizeChannel(channels[testChannelIndex]);
    const testModels = (testChannel?.models || []).filter((model) => model.toLowerCase().includes(testKeyword.trim().toLowerCase()));

    async function persistChannels(nextChannels: AdminModelChannel[]) {
        if (!token) return;
        const values = normalizeSettings(form.getFieldsValue(true) as AdminSettings);
        const nextChannelModels = collectChannelModels(nextChannels);
        const nextSettings = normalizeSettings({
            ...values,
            public: { ...values.public, modelChannel: { ...values.public.modelChannel, availableModels: filterModels(values.public.modelChannel.availableModels, nextChannelModels) } },
            private: { ...values.private, channels: nextChannels },
        });
        const saved = normalizeSettings(await saveAdminSettings(token, nextSettings));
        const merged = mergeChannelApiKeys(nextChannels, saved);
        setChannels(merged.private.channels);
        setModelCosts(merged.public.modelChannel.modelCosts);
        rememberKnownModels(merged);
        form.setFieldsValue(merged);
        setJsonText({
            public: JSON.stringify(merged.public, null, 2),
            private: JSON.stringify(merged.private, null, 2),
        });
        message.success("已保存");
    }

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        <Tabs
                            activeKey={activeTab}
                            onChange={(key) => changeTab(key as SettingsTabKey)}
                            items={[
                                { key: "public", label: "公开配置（对外暴露）" },
                                { key: "private", label: "私有配置（不会对外暴露）" },
                                { key: "mail", label: "邮件配置" },
                                { key: "thirdParty", label: "第三方登录" },
                            ]}
                        />
                        <Space>
                            <Button loading={isUpdatingDatabase} onClick={() => void updateDatabaseSchema()}>
                                更新数据库
                            </Button>
                            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void loadSettings()}>
                                刷新
                            </Button>
                            <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={() => void saveSettings()}>
                                保存设置
                            </Button>
                        </Space>
                    </Flex>
                </Card>

                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap style={{ marginBottom: 16 }}>
                        {activeTab === "public" || activeTab === "private" ? (
                            <Segmented
                                value={activeMode}
                                onChange={(value) => toggleMode(activeTab, value as EditorMode)}
                                options={[
                                    { label: "可视化编辑", value: "visual" },
                                    { label: "手动编辑 JSON", value: "json" },
                                ]}
                            />
                        ) : (
                            <Typography.Text type="secondary">{activeTab === "mail" ? "SMTP 验证码和邮件模板" : "OAuth、MetaMask 和自定义登录入口"}</Typography.Text>
                        )}
                        {activeMode === "json" ? (
                            <Space>
                                {jsonError ? (
                                    <Tag color="error">{jsonError}</Tag>
                                ) : (
                                    <Tag color="success" icon={<CheckCircleOutlined />}>
                                        JSON 格式正确
                                    </Tag>
                                )}
                                <Button icon={<FormatPainterOutlined />} onClick={() => formatJson(activeTab)}>
                                    格式化
                                </Button>
                            </Space>
                        ) : (
                            <Typography.Text type="secondary">{activeTab === "public" ? "这些配置会暴露给前端读取" : "这些配置只会在后台保存"}</Typography.Text>
                        )}
                    </Flex>

                    {activeTab === "public" ? (
                        activeMode === "visual" ? (
                            <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false}>
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Form.Item name={["public", "modelChannel", "availableModels"]} label="系统可用模型(请先在私有配置里配置渠道)" extra="可选项来自已启用渠道中选择的模型，最终开放哪些模型由这里勾选决定">
                                            <Select mode="multiple" placeholder="请选择系统可用模型" options={channelModels.map((item) => ({ label: item, value: item }))} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["public", "modelChannel", "defaultModel"]} label="默认模型">
                                            <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["public", "modelChannel", "defaultImageModel"]} label="默认图片模型">
                                            <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["public", "modelChannel", "defaultVideoModel"]} label="默认视频模型">
                                            <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["public", "modelChannel", "defaultTextModel"]} label="默认文本模型">
                                            <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name={["public", "modelChannel", "systemPrompt"]} label="系统提示词">
                                            <Input.TextArea rows={4} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name={["public", "modelChannel", "allowCustomChannel"]} label="是否允许用户自定义渠道" extra="开启后，前端可提供走后端渠道和用户自定义 baseUrl 直连两种模式" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["public", "auth", "allowRegister"]} label="是否允许用户注册" extra="关闭后隐藏注册入口，注册接口也会拒绝新用户创建" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["public", "auth", "emailVerification"]} label="是否开启邮箱验证" extra="开启后，账号密码注册必须填写邮箱验证码" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Typography.Title level={5}>模型算力点</Typography.Title>
                                        <Table
                                            rowKey="model"
                                            pagination={false}
                                            size="small"
                                            dataSource={publicModels.map((model) => ({ model, credits: modelCostCredits(modelCosts, model) }))}
                                            columns={[
                                                { title: "模型", dataIndex: "model" },
                                                {
                                                    title: "每次调用扣除",
                                                    dataIndex: "credits",
                                                    width: 220,
                                                    render: (_, item) => (
                                                        <InputNumber
                                                            min={0}
                                                            step={1}
                                                            precision={0}
                                                            className="!w-full"
                                                            value={item.credits}
                                                            addonAfter="点"
                                                            onChange={(value) => setModelCost(form, setModelCosts, item.model, Number(value) || 0)}
                                                        />
                                                    ),
                                                },
                                            ]}
                                        />
                                    </Col>
                                </Row>
                            </Form>
                        ) : (
                            <div style={{ overflow: "hidden", border: "1px solid var(--ant-color-border)", borderRadius: 6 }}>
                                <CodeMirror
                                    value={activeJsonText}
                                    height="520px"
                                    extensions={[json(), jsonEditorTheme]}
                                    basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true }}
                                    theme="none"
                                    onChange={(value) => setJsonText((current) => ({ ...current, public: value }))}
                                    style={{ fontSize: 13 }}
                                />
                            </div>
                        )
                    ) : activeTab === "mail" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false}>
                            <Flex vertical gap={12}>
                                <Card size="small" title="SMTP 验证码">
                                    <Row gutter={16}>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["private", "mail", "enabled"]} label="开启邮件服务" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={10}>
                                            <Form.Item name={["private", "mail", "host"]} label="SMTP Host">
                                                <Input placeholder="smtp.example.com" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={4}>
                                            <Form.Item name={["private", "mail", "port"]} label="端口">
                                                <InputNumber min={1} max={65535} className="!w-full" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={4}>
                                            <Form.Item name={["private", "mail", "codeExpireMin"]} label="有效分钟">
                                                <InputNumber min={1} max={60} className="!w-full" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "mail", "username"]} label="SMTP 用户名">
                                                <Input />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "mail", "password"]} label="SMTP 密码">
                                                <Input.Password placeholder="留空则沿用已保存的密码" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={4}>
                                            <Form.Item name={["private", "mail", "fromName"]} label="发件名称">
                                                <Input placeholder="边缘幻星" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={4}>
                                            <Form.Item name={["private", "mail", "fromEmail"]} label="发件邮箱">
                                                <Input placeholder="noreply@example.com" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                                <MailTemplateEditor form={form} name="register" title="绑定邮箱注册模板" />
                                <MailTemplateEditor form={form} name="reset" title="找回密码模板" />
                                <MailTemplateEditor form={form} name="metamask" title="MetaMask 邮箱验证模板" />
                            </Flex>
                        </Form>
                    ) : activeTab === "thirdParty" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false}>
                            <Flex vertical gap={12}>
                                <OAuthProviderCard providerKey="linuxDo" title="Linux.do 登录" iconUrl="/icons/linuxdo.svg" />
                                <OAuthProviderCard providerKey="google" title="Google 登录" />
                                <OAuthProviderCard providerKey="github" title="GitHub 登录" />
                                <Card size="small" title="MetaMask 登录">
                                    <Row gutter={16}>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["public", "auth", "metamask", "enabled"]} label="开启 MetaMask 登录" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "auth", "metamask", "enabled"]} label="服务端允许 MetaMask 登录" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Typography.Text type="secondary">首次 MetaMask 签名后会跳转到单独邮箱验证页面，验证完成后记录钱包地址用于后续签名登录。</Typography.Text>
                                </Card>
                                <Card size="small" title="自定义登录">
                                    <Form.List name={["private", "auth", "customProviders"]}>
                                        {(fields, { add, remove }) => (
                                            <Flex vertical gap={12}>
                                                {fields.map((field) => (
                                                    <Card key={field.key} size="small" title={`自定义登录 ${field.name + 1}`} extra={<Button danger size="small" onClick={() => remove(field.name)}>删除</Button>}>
                                                        <Row gutter={16}>
                                                            <Col xs={24} md={4}>
                                                                <Form.Item name={[field.name, "enabled"]} label="启用" valuePropName="checked">
                                                                    <Switch />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={5}>
                                                                <Form.Item name={[field.name, "id"]} label="ID">
                                                                    <Input placeholder="o2" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={5}>
                                                                <Form.Item name={[field.name, "name"]} label="显示名称">
                                                                    <Input placeholder="O2" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={10}>
                                                                <Form.Item name={[field.name, "iconUrl"]} label="图片地址">
                                                                    <Input placeholder="https://..." />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "clientId"]} label="Client ID">
                                                                    <Input />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "clientSecret"]} label="Client Secret">
                                                                    <Input.Password placeholder="留空则沿用已保存的密钥" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "authorizeUrl"]} label="授权地址">
                                                                    <Input />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "tokenUrl"]} label="Token 地址">
                                                                    <Input />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "userInfoUrl"]} label="用户信息地址">
                                                                    <Input />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name={[field.name, "scope"]} label="Scope">
                                                                    <Input />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                    </Card>
                                                ))}
                                                <Button icon={<PlusOutlined />} onClick={() => add(emptyPrivateProvider("o2", "O2"))}>
                                                    新增自定义登录
                                                </Button>
                                            </Flex>
                                        )}
                                    </Form.List>
                                </Card>
                            </Flex>
                        </Form>
                    ) : activeMode === "visual" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false}>
                            <Flex vertical gap={12}>
                                <Card size="small" title="提示词定时同步">
                                    <Row gutter={16} align="middle">
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "promptSync", "enabled"]} label="开启定时同步" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={16}>
                                            <Form.Item name={["private", "promptSync", "cron"]} label="Cron 表达式" extra="默认每 5 分钟同步内置 GitHub 远程提示词源">
                                                <Input placeholder="*/5 * * * *" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openChannelDrawer(null)}>
                                    新增渠道
                                </Button>
                                <Table
                                    rowKey="_rowKey"
                                    pagination={false}
                                    dataSource={channelTableData}
                                    columns={[
                                        { title: "名称", dataIndex: "name", render: (value) => value || "未命名渠道" },
                                        { title: "协议", dataIndex: "protocol", width: 96, render: (value) => <Tag>{value || "openai"}</Tag> },
                                        { title: "状态", dataIndex: "enabled", width: 96, render: (value) => <Tag color={value ? "success" : "default"}>{value ? "已启用" : "已停用"}</Tag> },
                                        {
                                            title: "模型",
                                            dataIndex: "models",
                                            render: (value: string[]) => (
                                                <Typography.Text ellipsis style={{ maxWidth: 360 }}>
                                                    {modelSummary(value || [])}
                                                </Typography.Text>
                                            ),
                                        },
                                        { title: "权重", dataIndex: "weight", width: 88 },
                                        {
                                            title: "操作",
                                            key: "actions",
                                            width: 220,
                                            align: "right",
                                            render: (_, item) => (
                                                <Space size={4}>
                                                    <Button size="small" onClick={() => openTestDialog(item._index)}>
                                                        测试
                                                    </Button>
                                                    <Button size="small" onClick={() => openChannelDrawer(item._index)}>
                                                        编辑
                                                    </Button>
                                                    <Button
                                                        danger
                                                        size="small"
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => {
                                                            const nextChannels = [...channels];
                                                            nextChannels.splice(item._index, 1);
                                                            void persistChannels(nextChannels);
                                                        }}
                                                    />
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Flex>
                        </Form>
                    ) : (
                        <div style={{ overflow: "hidden", border: "1px solid var(--ant-color-border)", borderRadius: 6 }}>
                            <CodeMirror
                                value={activeJsonText}
                                height="520px"
                                extensions={[json(), jsonEditorTheme]}
                                basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true }}
                                theme="none"
                                onChange={(value) => setJsonText((current) => ({ ...current, private: value }))}
                                style={{ fontSize: 13 }}
                            />
                        </div>
                    )}
                </Card>
                <Drawer
                    title={editingChannelIndex === null ? "新增渠道" : "编辑渠道"}
                    open={isChannelDrawerOpen}
                    size={560}
                    onClose={closeChannelDrawer}
                    extra={
                        <Space>
                            <Button onClick={closeChannelDrawer}>取消</Button>
                            <Button type="primary" onClick={() => void saveChannel()}>
                                保存
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Form form={channelForm} layout="vertical" requiredMark={false} initialValues={emptyChannel}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: "请输入渠道名称" }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="protocol" label="协议">
                                    <Select options={[{ label: "OpenAI", value: "openai" }]} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="weight" label="权重">
                                    <InputNumber min={1} step={1} className="!w-full" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="enabled" label="启用" valuePropName="checked">
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="baseUrl" label="接口地址" rules={[{ required: true, message: "请输入接口地址" }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="apiKey" label="API Key" rules={editingChannelIndex === null ? [{ required: true, message: "请输入 API Key" }] : []}>
                                    <Input.Password placeholder={editingChannelIndex === null ? "" : "留空则沿用已保存的 API Key"} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item label="渠道可用模型">
                                    <Space.Compact style={{ width: "100%" }}>
                                        <Form.Item name="models" noStyle>
                                            <Select mode="tags" maxTagCount="responsive" tokenSeparators={[",", "\n"]} options={knownModels.map((model) => ({ label: model, value: model }))} />
                                        </Form.Item>
                                        <Button onClick={() => openChannelModelSelector()}>选择模型</Button>
                                    </Space.Compact>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="remark" label="备注">
                                    <Input.TextArea rows={3} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Drawer>
                <Modal
                    title={
                        <Space size={12}>
                            选择渠道模型
                            <Typography.Text type="secondary">
                                已选择 {modelSelectSelected.length} / {uniqueModels([...modelSelectSource, ...modelSelectExisting]).length}
                            </Typography.Text>
                        </Space>
                    }
                    open={isModelSelectorOpen}
                    width={960}
                    onCancel={closeChannelModelSelector}
                    footer={
                        <Space>
                            <Button onClick={closeChannelModelSelector}>取消</Button>
                            <Button type="primary" onClick={confirmChannelModelSelector}>
                                确定
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Flex vertical gap={14}>
                        <Flex gap={12} wrap>
                            <Input.Search placeholder="搜索模型" allowClear value={modelSelectKeyword} onChange={(event) => setModelSelectKeyword(event.target.value)} style={{ flex: "1 1 260px" }} />
                            <Space.Compact style={{ flex: "1 1 320px" }}>
                                <Input value={modelSelectNewModel} placeholder="输入模型名称" onChange={(event) => setModelSelectNewModel(event.target.value)} onPressEnter={addModelInSelector} />
                                <Button onClick={addModelInSelector}>增加模型</Button>
                                <Button icon={<ReloadOutlined />} loading={isFetchingChannelModels} onClick={() => void fetchChannelModelList()}>
                                    拉取模型列表
                                </Button>
                            </Space.Compact>
                        </Flex>
                        <Tabs
                            activeKey={modelSelectTab}
                            onChange={(key) => setModelSelectTab(key as ModelSelectTabKey)}
                            items={[
                                { key: "new", label: `新获取的模型 (${modelSelectGroups.new.length})` },
                                { key: "current", label: `已有的模型 (${modelSelectGroups.current.length})` },
                            ]}
                        />
                        <Flex justify="space-between" align="center" gap={12} wrap>
                            <Typography.Text type="secondary">
                                当前列表已选择 {activeSelectedCount} / {activeModelSelectModels.length}
                            </Typography.Text>
                            <Space size={8}>
                                <Button size="small" disabled={!activeModelSelectModels.length || activeSelectedCount === activeModelSelectModels.length} onClick={selectActiveModels}>
                                    全选当前列表
                                </Button>
                                <Button size="small" disabled={!activeSelectedCount} onClick={clearActiveModels}>
                                    取消当前列表
                                </Button>
                            </Space>
                        </Flex>
                        <div style={{ maxHeight: 420, overflowY: "auto", borderTop: "1px solid var(--ant-color-border-secondary)", paddingTop: 12 }}>
                            {activeModelSelectModels.length ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 24, rowGap: 12 }}>
                                    {activeModelSelectModels.map((model) => (
                                        <Checkbox key={model} checked={modelSelectSelected.includes(model)} onChange={(event) => toggleSelectedModel(model, event.target.checked)}>
                                            <Typography.Text style={{ wordBreak: "break-all" }}>{model}</Typography.Text>
                                        </Checkbox>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: "48px 0", textAlign: "center" }}>
                                    <Typography.Text type="secondary">没有匹配的模型</Typography.Text>
                                </div>
                            )}
                        </div>
                    </Flex>
                </Modal>
                <Modal
                    title={
                        <Space>
                            {testChannel?.name || "渠道"} 渠道的模型测试<Typography.Text type="secondary">共 {testChannel?.models.length || 0} 个模型</Typography.Text>
                        </Space>
                    }
                    open={testChannelIndex !== null}
                    width={920}
                    onCancel={closeTestDialog}
                    footer={
                        <Space>
                            <Button onClick={closeTestDialog}>取消</Button>
                            <Button type="primary" disabled={!selectedTestModels.length || testingModels.length > 0} onClick={() => void batchTestModels()}>
                                批量测试 {selectedTestModels.length} 个模型
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Flex vertical gap={12}>
                        <Typography.Text type="secondary">测试会向选中模型发送一条 hi，用于确认渠道是否有响应。</Typography.Text>
                        <Input.Search placeholder="搜索模型..." allowClear value={testKeyword} onChange={(event) => setTestKeyword(event.target.value)} />
                        <Table
                            rowKey="model"
                            pagination={false}
                            scroll={{ y: 420 }}
                            dataSource={testModels.map((model) => ({ model }))}
                            rowSelection={{
                                selectedRowKeys: selectedTestModels,
                                onChange: (keys) => setSelectedTestModels(keys.map(String)),
                            }}
                            columns={[
                                { title: "模型名称", dataIndex: "model", render: (value) => <Typography.Text strong>{value}</Typography.Text> },
                                {
                                    title: "状态",
                                    dataIndex: "model",
                                    width: 260,
                                    render: (value) => {
                                        if (testingModels.includes(value)) return <Tag icon={<LoadingOutlined className="animate-spin" />}>测试中</Tag>;
                                        const result = testResults[value];
                                        if (!result) return <Tag>未开始</Tag>;
                                        return result.status === "success" ? (
                                            <Space size={6} wrap>
                                                <Tag color="success">成功</Tag>
                                                <Typography.Text type="secondary">请求时长: {result.duration}</Typography.Text>
                                            </Space>
                                        ) : (
                                            <Typography.Text type="danger">{result.message}</Typography.Text>
                                        );
                                    },
                                },
                                {
                                    title: "操作",
                                    key: "actions",
                                    width: 120,
                                    align: "right",
                                    render: (_, item) => (
                                        <Button size="small" loading={testingModels.includes(item.model)} onClick={() => void testModelOnline(item.model)}>
                                            测试
                                        </Button>
                                    ),
                                },
                            ]}
                        />
                    </Flex>
                </Modal>
            </Flex>
        </main>
    );
}

function MailTemplateEditor({ form, name, title }: { form: any; name: "register" | "reset" | "metamask"; title: string }) {
    const subject = Form.useWatch(["private", "mail", "templates", name, "subject"], form) || "";
    const body = Form.useWatch(["private", "mail", "templates", name, "body"], form) || "";
    const expireMinutes = Form.useWatch(["private", "mail", "codeExpireMin"], form) || 10;
    const preview = renderTemplatePreview(`${subject}\n\n${body}`, expireMinutes);
    return (
        <Card size="small" title={title}>
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item name={["private", "mail", "templates", name, "subject"]} label="标题">
                        <Input />
                    </Form.Item>
                    <Form.Item name={["private", "mail", "templates", name, "body"]} label="正文模板" extra="可用变量：{{code}}、{{email}}、{{expireMinutes}}、{{siteName}}">
                        <Input.TextArea rows={5} />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Typography.Text strong>预览</Typography.Text>
                    <pre style={{ marginTop: 8, minHeight: 154, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--ant-color-border)", borderRadius: 6, padding: 12, background: "var(--ant-color-fill-quaternary)" }}>{preview}</pre>
                </Col>
            </Row>
        </Card>
    );
}

function OAuthProviderCard({ providerKey, title, iconUrl }: { providerKey: "linuxDo" | "google" | "github"; title: string; iconUrl?: string }) {
    return (
        <Card
            size="small"
            title={
                <Space>
                    {iconUrl ? <img src={iconUrl} alt="" width={18} height={18} /> : null}
                    {title}
                </Space>
            }
        >
            <Row gutter={16}>
                <Col xs={24} md={4}>
                    <Form.Item name={["public", "auth", providerKey, "enabled"]} label="前台显示" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                    <Form.Item name={["private", "auth", providerKey, "enabled"]} label="启用服务端" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item name={["private", "auth", providerKey, "clientId"]} label="Client ID">
                        <Input />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item name={["private", "auth", providerKey, "clientSecret"]} label="Client Secret">
                        <Input.Password placeholder="留空则沿用已保存的密钥" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item name={["private", "auth", providerKey, "authorizeUrl"]} label="授权地址">
                        <Input />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item name={["private", "auth", providerKey, "tokenUrl"]} label="Token 地址">
                        <Input />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item name={["private", "auth", providerKey, "userInfoUrl"]} label="用户信息地址">
                        <Input />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item name={["private", "auth", providerKey, "scope"]} label="Scope">
                        <Input />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}

function renderTemplatePreview(template: string, expireMinutes: number) {
    return template
        .replaceAll("{{code}}", "123456")
        .replaceAll("{{email}}", "user@example.com")
        .replaceAll("{{expireMinutes}}", String(expireMinutes))
        .replaceAll("{{siteName}}", "边缘幻星");
}

function normalizeSettings(settings: Partial<AdminSettings> = {}): AdminSettings {
    const privateSetting = normalizePrivateSetting(settings.private);
    return {
        public: {
            ...normalizePublicSetting(settings.public),
        },
        private: privateSetting,
    };
}

function normalizePublicSetting(setting: Partial<AdminSettings["public"]> = {}): AdminSettings["public"] {
    return {
        ...emptySettings.public,
        modelChannel: {
            ...emptySettings.public.modelChannel,
            ...(setting.modelChannel || {}),
            availableModels: setting.modelChannel?.availableModels || [],
            modelCosts: normalizeModelCosts(setting.modelChannel?.modelCosts || []),
        },
        auth: {
            allowRegister: setting.auth?.allowRegister !== false,
            emailVerification: setting.auth?.emailVerification === true,
            linuxDo: normalizePublicProvider(setting.auth?.linuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: normalizePublicProvider(setting.auth?.google, "google", "Google"),
            github: normalizePublicProvider(setting.auth?.github, "github", "GitHub"),
            metamask: normalizePublicProvider(setting.auth?.metamask, "metamask", "MetaMask"),
            customProviders: (setting.auth?.customProviders?.length ? setting.auth.customProviders : [emptyPublicProvider("o2", "O2")]).map((item) => normalizePublicProvider(item, item.id || "o2", item.name || "O2")),
        },
    };
}

function normalizeModelCosts(items: Partial<AdminSettings["public"]["modelChannel"]["modelCosts"][number]>[]) {
    return items.filter((item) => item.model).map((item) => ({ model: item.model || "", credits: Math.max(0, Number(item.credits) || 0) }));
}

function normalizePrivateSetting(setting: Partial<AdminSettings["private"]> = {}): AdminSettings["private"] {
    return {
        channels: (setting.channels || []).map(normalizeChannel),
        promptSync: {
            enabled: setting.promptSync?.enabled !== false,
            cron: setting.promptSync?.cron || "*/5 * * * *",
        },
        auth: {
            linuxDo: normalizePrivateProvider(setting.auth?.linuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: normalizePrivateProvider(setting.auth?.google, "google", "Google"),
            github: normalizePrivateProvider(setting.auth?.github, "github", "GitHub"),
            metamask: { enabled: setting.auth?.metamask?.enabled === true },
            customProviders: (setting.auth?.customProviders?.length ? setting.auth.customProviders : [emptyPrivateProvider("o2", "O2")]).map((item) => normalizePrivateProvider(item, item.id || "o2", item.name || "O2")),
        },
        mail: {
            ...emptySettings.private.mail,
            ...(setting.mail || {}),
            templates: {
                register: { ...emptySettings.private.mail.templates.register, ...(setting.mail?.templates?.register || {}) },
                reset: { ...emptySettings.private.mail.templates.reset, ...(setting.mail?.templates?.reset || {}) },
                metamask: { ...emptySettings.private.mail.templates.metamask, ...(setting.mail?.templates?.metamask || {}) },
            },
        },
    };
}

function normalizePublicProvider(item: Partial<AdminPublicAuthProvider> = {}, id: string, name: string, iconUrl = ""): AdminPublicAuthProvider {
    return { id: item.id || id, name: item.name || name, iconUrl: item.iconUrl || iconUrl, enabled: item.enabled === true };
}

function normalizePrivateProvider(item: Partial<AdminPrivateAuthProvider> = {}, id: string, name: string, iconUrl = ""): AdminPrivateAuthProvider {
    return { ...emptyPrivateProvider(id, name, iconUrl), ...item, id: item.id || id, name: item.name || name, iconUrl: item.iconUrl || iconUrl, enabled: item.enabled === true };
}

function normalizeChannel(item: Partial<AdminModelChannel> = {}): AdminModelChannel {
    return {
        protocol: "openai",
        name: item.name || "",
        baseUrl: item.baseUrl || "",
        apiKey: item.apiKey || "",
        models: item.models || [],
        weight: Math.max(1, Number(item.weight) || 1),
        enabled: item.enabled !== false,
        remark: item.remark || "",
    };
}

function modelCostCredits(items: AdminSettings["public"]["modelChannel"]["modelCosts"], model: string) {
    return items.find((item) => item.model === model)?.credits || 0;
}

function setModelCost(form: any, setModelCosts: (items: AdminModelCost[]) => void, model: string, credits: number) {
    const current = (form.getFieldValue(["public", "modelChannel", "modelCosts"]) || []) as AdminSettings["public"]["modelChannel"]["modelCosts"];
    const next = current.filter((item) => item.model !== model);
    next.push({ model, credits: Math.max(0, credits) });
    form.setFieldValue(["public", "modelChannel", "modelCosts"], next);
    setModelCosts(next);
}

function mergeChannelApiKeys(currentChannels: AdminModelChannel[], saved: AdminSettings): AdminSettings {
    const channels = saved.private.channels.map((item, index) => ({
        ...item,
        apiKey: currentChannels[index]?.apiKey || item.apiKey,
    }));
    return {
        public: saved.public,
        private: { ...saved.private, channels },
    };
}

function collectChannelModels(channels: AdminModelChannel[]) {
    return uniqueModels(channels.filter((channel) => channel.enabled).flatMap((channel) => channel.models || []));
}

function collectKnownModels(settings: AdminSettings) {
    return uniqueModels([
        ...(settings.public.modelChannel.availableModels || []),
        ...(settings.public.modelChannel.modelCosts || []).map((item) => item.model),
        ...settings.private.channels.flatMap((channel) => channel.models || []),
    ]);
}

function buildModelSelectGroups(sourceModels: string[], existingModels: string[]): Record<ModelSelectTabKey, string[]> {
    const source = uniqueModels(sourceModels);
    const existing = uniqueModels(existingModels);
    const existingSet = new Set(existing);
    return {
        new: source.filter((model) => !existingSet.has(model)),
        current: existing,
    };
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.filter(Boolean)));
}

function filterModels(models: string[], options: string[]) {
    const optionSet = new Set(options);
    return uniqueModels(models).filter((model) => optionSet.has(model));
}

function modelSummary(models: string[]) {
    if (!models.length) return "未配置模型";
    const preview = models.slice(0, 3).join(", ");
    return models.length > 3 ? `${models.length} 个模型：${preview}...` : preview;
}

function parseTabJson(tab: "public", value: string): AdminSettings["public"] | null;
function parseTabJson(tab: "private", value: string): AdminSettings["private"] | null;
function parseTabJson(tab: "public" | "private", value: string): AdminSettings["public"] | AdminSettings["private"] | null;
function parseTabJson(tab: "public" | "private", value: string): AdminSettings["public"] | AdminSettings["private"] | null {
    try {
        return tab === "public" ? normalizePublicSetting(JSON.parse(value) as Partial<AdminSettings["public"]>) : normalizePrivateSetting(JSON.parse(value) as Partial<AdminSettings["private"]>);
    } catch {
        return null;
    }
}

async function collectSettings(form: any, editorMode: Record<string, EditorMode>, jsonText: Record<string, string>, message: { error: (value: string) => void }) {
    const values = normalizeSettings(form.getFieldsValue(true) as AdminSettings);
    if (editorMode.public === "json") {
        const publicSetting = parseTabJson("public", jsonText.public);
        if (!publicSetting) {
            message.error("公开配置 JSON 格式不正确");
            return null;
        }
        values.public = publicSetting;
    }
    if (editorMode.private === "json") {
        const privateSetting = parseTabJson("private", jsonText.private);
        if (!privateSetting) {
            message.error("私有配置 JSON 格式不正确");
            return null;
        }
        values.private = privateSetting;
    }
    values.public.modelChannel.availableModels = filterModels(values.public.modelChannel.availableModels, collectChannelModels(values.private.channels));
    values.public.auth.customProviders = values.private.auth.customProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        iconUrl: provider.iconUrl,
        enabled: provider.enabled,
    }));
    return normalizeSettings(values);
}

function getJsonError(value: string) {
    try {
        JSON.parse(value);
        return "";
    } catch (error) {
        return error instanceof Error ? error.message : "JSON 格式不正确";
    }
}
