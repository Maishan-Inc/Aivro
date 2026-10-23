"use client";

import { useState } from "react";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Input, InputNumber, Segmented, Select, Space, Table, Tag, Typography } from "antd";
import { Eye } from "lucide-react";

import { ModelLogo } from "@/components/model-logo";
import { ModelPricingTable } from "@/components/model-pricing-table";
import { apiCostOf, billingUnit, capabilityOf, planPricingCodes, vendorIconOptions } from "@/lib/model-pricing";
import type { AdminModelCost } from "@/services/api/admin";
import { useAdminModelPricing } from "./use-admin-model-pricing";

export default function AdminModelPricingPage() {
    const { modal } = App.useApp();
    const { settings, rows, isLoading, isSaving, dirty, load, save, updateRow, updateAllRows } = useAdminModelPricing();
    const [view, setView] = useState<"edit" | "preview">("edit");
    const [multiplier, setMultiplier] = useState(2);
    // 预览要显示模型类型，直接复用后台已保存的模型范围配置。
    const previewRows = rows.map((item) => ({ ...item, capability: capabilityOf(item.model, settings?.public.modelChannel) }));

    const changeMultiplier = (value: number) => {
        const next = Math.max(1, Math.floor(Number(value) || 1));
        setMultiplier(next);
        modal.confirm({
            title: `把 API 倍数统一设为 ${next}？`,
            content: "已单独填写 API 单价的模型不会被覆盖，其余模型会按标准价乘以该倍数计算。",
            okText: "应用",
            cancelText: "取消",
            centered: true,
            onOk: () => updateAllRows({ apiMultiplier: next }),
        });
    };

    return (
        <main className="p-3 sm:p-4 lg:p-6">
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        <div>
                            <Typography.Title level={5} style={{ margin: 0 }}>模型定价</Typography.Title>
                            <Typography.Text type="secondary">标准价就是控制台实际扣费的点数；套餐专属价留空沿用标准价，API 价默认按标准价的倍数计算。</Typography.Text>
                        </div>
                        <Space wrap>
                            <Segmented value={view} onChange={(value) => setView(value as "edit" | "preview")} options={[{ label: "编辑", value: "edit" }, { label: <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />前台预览</span>, value: "preview" }]} />
                            <InputNumber min={1} step={1} precision={0} value={multiplier} onChange={(value) => setMultiplier(Number(value) || 1)} addonBefore="API 倍数" addonAfter={<Button type="link" size="small" className="!px-0" onClick={() => changeMultiplier(multiplier)}>应用到全部</Button>} />
                            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void load()}>刷新</Button>
                            <Button type="primary" icon={<SaveOutlined />} loading={isSaving} disabled={!dirty} onClick={() => void save()}>保存</Button>
                        </Space>
                    </Flex>
                </Card>

                {view === "preview" ? (
                    <Card variant="borderless" title="前台预览" extra={<Typography.Text type="secondary">这里展示的是尚未保存的当前编辑内容</Typography.Text>}>
                        <ModelPricingTable preview={previewRows} />
                    </Card>
                ) : (
                    <Card variant="borderless" title="计费配置" extra={<Typography.Text type={dirty ? "warning" : "secondary"}>{dirty ? "有修改未保存" : "已与后台同步"}</Typography.Text>}>
                        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                            只显示已开放到前台的模型。需要新增或移除模型，请先在「模型配置 · 开放给前台的模型」中调整；厂商图标留空时会按模型名自动识别。
                        </Typography.Paragraph>
                        <Table<AdminModelCost>
                            rowKey={(item) => item.modelId || item.model}
                            loading={isLoading}
                            dataSource={rows}
                            pagination={false}
                            size="small"
                            scroll={{ x: 1180 }}
                            columns={[
                                {
                                    title: "模型",
                                    dataIndex: "model",
                                    width: 240,
                                    fixed: "left",
                                    render: (value: string, item) => (
                                        <Space size={8}>
                                            <ModelLogo icon={item.icon} name={item.vendor || value} size={18} />
                                            <Typography.Text strong>{value}</Typography.Text>
                                        </Space>
                                    ),
                                },
                                {
                                    title: "厂商",
                                    dataIndex: "vendor",
                                    width: 190,
                                    render: (_: unknown, item) => (
                                        <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                            <Input size="small" placeholder="自动识别" value={item.vendor} onChange={(event) => updateRow(item.modelId || item.model, { vendor: event.target.value })} />
                                            <Select size="small" allowClear showSearch placeholder="图标" value={item.icon || undefined} options={vendorIconOptions} onChange={(value) => updateRow(item.modelId || item.model, { icon: value || "" })} style={{ width: "100%" }} />
                                        </Space>
                                    ),
                                },
                                {
                                    title: "计费方式",
                                    dataIndex: "billingType",
                                    width: 130,
                                    render: (_: unknown, item) => (
                                        <Select size="small" value={item.billingType} options={[{ label: "按次", value: "fixed" }, { label: "Token", value: "token" }]} onChange={(value) => updateRow(item.modelId || item.model, { billingType: value })} style={{ width: "100%" }} />
                                    ),
                                },
                                {
                                    title: "标准价",
                                    dataIndex: "credits",
                                    width: 160,
                                    render: (_: unknown, item) => (
                                        <InputNumber size="small" min={0} step={1} precision={0} className="!w-full" value={item.credits} addonAfter={billingUnit(item.billingType)} onChange={(value) => updateRow(item.modelId || item.model, { credits: Number(value) || 0 })} />
                                    ),
                                },
                                ...planPricingCodes.map((code) => ({
                                    title: code.toUpperCase(),
                                    key: code,
                                    width: 108,
                                    render: (_: unknown, item: AdminModelCost) => (
                                        <InputNumber
                                            size="small"
                                            min={0}
                                            step={1}
                                            precision={0}
                                            className="!w-full"
                                            placeholder={String(item.credits)}
                                            value={item.planCredits?.[code] || undefined}
                                            onChange={(value) => updateRow(item.modelId || item.model, { planCredits: { ...item.planCredits, [code]: Number(value) || 0 } })}
                                        />
                                    ),
                                })),
                                {
                                    title: "API 价",
                                    key: "api",
                                    width: 210,
                                    render: (_: unknown, item) => (
                                        <Space size={4}>
                                            <InputNumber size="small" min={0} step={1} precision={0} value={item.apiCredits || undefined} placeholder={String(apiCostOf(item))} onChange={(value) => updateRow(item.modelId || item.model, { apiCredits: Number(value) || 0 })} />
                                            <Typography.Text type="secondary" className="!text-xs">×{item.apiMultiplier}</Typography.Text>
                                        </Space>
                                    ),
                                },
                                {
                                    title: "预览",
                                    key: "summary",
                                    width: 150,
                                    render: (_: unknown, item) => <Tag style={{ marginInlineEnd: 0 }}>{planPricingCodes.map((code) => item.planCredits?.[code] || item.credits).join(" / ")}</Tag>,
                                },
                            ]}
                        />
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 16 }}>
                            {settings ? `当前前台开放 ${settings.public.modelChannel.availableModels.length} 个模型，共 ${rows.length} 条计费配置。` : "正在读取配置…"}
                        </Typography.Paragraph>
                    </Card>
                )}
            </Flex>
        </main>
    );
}
