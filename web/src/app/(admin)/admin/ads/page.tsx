"use client";

import { CodeOutlined, GlobalOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Alert, Button, Card, Col, Flex, Form, Input, Row, Space, Switch, Tag, Typography, theme } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAdminSettings, saveAdminSettings, type AdminAdSenseSettings, type AdminSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const defaultAdSense: AdminAdSenseSettings = {
    enabled: false,
    code: "",
    adsTxt: "",
    pages: {
        home: true,
        pricing: true,
        image: true,
        video: true,
        model3d: true,
        canvas: true,
        prompts: true,
        assets: true,
        assetLibrary: true,
        privacy: true,
        terms: true,
    },
};

const pageOptions: Array<{ key: keyof AdminAdSenseSettings["pages"]; label: string; path: string }> = [
    { key: "home", label: "首页", path: "/" },
    { key: "pricing", label: "套餐页", path: "/pricing" },
    { key: "image", label: "生图工作台", path: "/image" },
    { key: "video", label: "视频创作台", path: "/video" },
    { key: "model3d", label: "3D 模型", path: "/model-3d" },
    { key: "canvas", label: "工作流", path: "/canvas" },
    { key: "prompts", label: "提示词库", path: "/prompts" },
    { key: "assets", label: "我的素材", path: "/assets" },
    { key: "assetLibrary", label: "素材库", path: "/asset-library" },
    { key: "privacy", label: "隐私政策", path: "/privacy" },
    { key: "terms", label: "服务条款", path: "/terms" },
];

export default function AdminAdsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const { token: antToken } = theme.useToken();
    const [form] = Form.useForm<AdminAdSenseSettings>();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveHint, setSaveHint] = useState("已保存");
    const currentCode = Form.useWatch("code", form) || "";
    const publisherId = useMemo(() => adSensePublisherId(currentCode), [currentCode]);
    const scriptOk = useMemo(() => Boolean(adSenseScriptSrc(currentCode)), [currentCode]);

    const loadSettings = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = await fetchAdminSettings(token);
            const nextAdSense = normalizeAdSense(data.public.adSense);
            setSettings({ ...data, public: { ...data.public, adSense: nextAdSense } });
            form.setFieldsValue(nextAdSense);
            setSaveHint("已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取广告配置失败");
        } finally {
            setIsLoading(false);
        }
    }, [form, message, token]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    const saveSettings = async () => {
        if (!token || !settings) return;
        const adSense = normalizeAdSense(await form.validateFields());
        if (adSense.enabled && !adSenseScriptSrc(adSense.code)) {
            message.error("请粘贴 AdSense 官方脚本代码");
            return;
        }
        setIsSaving(true);
        try {
            const saved = await saveAdminSettings(token, { ...settings, public: { ...settings.public, adSense } });
            const nextAdSense = normalizeAdSense(saved.public.adSense);
            setSettings({ ...saved, public: { ...saved.public, adSense: nextAdSense } });
            form.setFieldsValue(nextAdSense);
            setSaveHint("已保存");
            message.success("广告配置已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存广告配置失败");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        <Space size={12}>
                            <GlobalOutlined style={{ fontSize: 22, color: antToken.colorPrimary }} />
                            <div>
                                <Typography.Title level={4} style={{ margin: 0 }}>
                                    谷歌广告
                                </Typography.Title>
                                <Typography.Text type="secondary">粘贴 AdSense 代码，并按页面控制是否加载广告脚本。</Typography.Text>
                            </div>
                        </Space>
                        <Space>
                            <Typography.Text type="secondary">{saveHint}</Typography.Text>
                            <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={() => void saveSettings()}>
                                保存
                            </Button>
                            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void loadSettings()}>
                                刷新
                            </Button>
                        </Space>
                    </Flex>
                </Card>

                <Form form={form} layout="vertical" initialValues={defaultAdSense} requiredMark={false} onValuesChange={() => setSaveHint("有修改未保存")}>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={14}>
                            <Card title="AdSense 代码" extra={<CodeOutlined />} variant="borderless">
                                <Form.Item name="enabled" label="启用谷歌广告" valuePropName="checked" extra="关闭后所有前台页面都不会加载 AdSense 脚本。">
                                    <Switch />
                                </Form.Item>
                                <Form.Item name="code" label="脚本代码" extra="从 adsense.google.com 复制完整 script 代码粘贴到这里。">
                                    <Input.TextArea rows={8} placeholder="xxxxx" />
                                </Form.Item>
                                <Space wrap>
                                    <Tag color={scriptOk ? "success" : "default"}>{scriptOk ? "脚本地址有效" : "未识别 AdSense 脚本"}</Tag>
                                    {publisherId ? <Tag color="processing">Publisher ID：{publisherId}</Tag> : null}
                                </Space>
                                <Alert style={{ marginTop: 16 }} type="info" showIcon title="当前实现加载 Auto Ads 脚本" description="如果你在 AdSense 后台开启自动广告，前台页面加载脚本后会由 Google 自动决定展示位置。" />
                            </Card>
                            <Card title="Ads.txt" variant="borderless" style={{ marginTop: 16 }}>
                                <Form.Item name="adsTxt" label="ads.txt 内容" extra="保存后网站根路径 /ads.txt 会输出这里的内容，用于 Google AdSense 网站审核。">
                                    <Input.TextArea rows={5} placeholder="google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0" />
                                </Form.Item>
                                <Typography.Link href="/ads.txt" target="_blank" rel="noreferrer">
                                    打开 /ads.txt
                                </Typography.Link>
                            </Card>
                        </Col>
                        <Col xs={24} lg={10}>
                            <Card title="页面开关" variant="borderless">
                                <div style={{ display: "grid", gap: 12 }}>
                                    {pageOptions.map((item) => (
                                        <Flex key={item.key} align="center" justify="space-between" gap={12} style={{ padding: "10px 12px", border: `1px solid ${antToken.colorBorderSecondary}`, borderRadius: 8 }}>
                                            <div>
                                                <Typography.Text strong>{item.label}</Typography.Text>
                                                <div style={{ color: antToken.colorTextTertiary, fontSize: 12 }}>{item.path}</div>
                                            </div>
                                            <Form.Item name={["pages", item.key]} valuePropName="checked" style={{ margin: 0 }}>
                                                <Switch />
                                            </Form.Item>
                                        </Flex>
                                    ))}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </Form>
            </Flex>
        </main>
    );
}

function normalizeAdSense(setting: Partial<AdminAdSenseSettings> = {}): AdminAdSenseSettings {
    const pages = {
        ...defaultAdSense.pages,
        ...(setting.pages || {}),
    };
    if (!setting.enabled && !setting.code && !Object.values(pages).some(Boolean)) {
        Object.assign(pages, defaultAdSense.pages);
    }
    return {
        ...defaultAdSense,
        enabled: setting.enabled === true,
        code: setting.code || "",
        adsTxt: setting.adsTxt || "",
        pages,
    };
}

function adSenseScriptSrc(code: string) {
    const value = code.trim();
    const src = value.match(/\ssrc=["']([^"']+)["']/i)?.[1] || (value.startsWith("https://") ? value : "");
    return src.startsWith("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js") ? src : "";
}

function adSensePublisherId(code: string) {
    const src = adSenseScriptSrc(code);
    return src.match(/[?&]client=([^&]+)/)?.[1] || "";
}
