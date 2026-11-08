"use client";

import { useMemo, useState } from "react";
import { Button, Card, Flex, Input, Select, Space, Table, Typography } from "antd";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Search } from "lucide-react";
import { ModelLogo } from "@/components/model-logo";
import { ModelTags } from "@/components/model-tags";
import { modelTags } from "@/constant/model-tags";
import { useAdminModelPricing } from "@/hooks/use-admin-model-pricing";
import { useI18n } from "@/hooks/use-i18n";
import type { AdminModelCost } from "@/services/api/admin";

export default function AdminModelTagsPage() {
    const { tr } = useI18n();
    const { settings, rows, isLoading, isSaving, dirty, load, save, updateRow } = useAdminModelPricing();
    const [keyword, setKeyword] = useState("");
    const filtered = useMemo(() => rows.filter((item) => `${item.model} ${item.vendor}`.toLowerCase().includes(keyword.trim().toLowerCase())), [keyword, rows]);
    const options = modelTags.map((item) => ({ value: item.value, label: <ModelTags tags={[item.value]} />, searchLabel: tr(item.label) }));
    return <main className="p-3 sm:p-4 lg:p-6"><Card variant="borderless">
        <Flex justify="space-between" align="center" gap={16} wrap className="mb-5">
            <div><Typography.Title level={5} style={{ margin: 0 }}>{tr("模型标签")}</Typography.Title><Typography.Text type="secondary">{tr("为全部渠道模型配置展示标签，选择菜单与模型定价页同步显示。标签仅用于展示，不改变模型能力或计费。")}</Typography.Text></div>
            <Space><Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void load()}>{tr("刷新")}</Button><Button type="primary" icon={<SaveOutlined />} loading={isSaving} disabled={!dirty} onClick={() => void save()}>{tr("保存")}</Button></Space>
        </Flex>
        <Input allowClear prefix={<Search className="size-3.5" />} placeholder={tr("搜索模型或厂商")} aria-label={tr("搜索模型或厂商")} value={keyword} onChange={(event) => setKeyword(event.target.value)} className="mb-4 max-w-sm" />
        <Table<AdminModelCost> rowKey={(item) => item.modelId || item.model} loading={isLoading} dataSource={filtered} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 760 }} columns={[
            { title: tr("模型"), dataIndex: "model", width: 280, render: (value: string, item) => <Space><ModelLogo icon={item.icon} name={item.vendor || value} size={18} /><span data-i18n-skip>{value}</span></Space> },
            { title: tr("厂商"), dataIndex: "vendor", width: 140, render: (value: string) => tr(value) || "—" },
            { title: tr("状态"), width: 100, render: (_, item) => tr(settings?.public.modelChannel.availableModels.includes(item.model) ? "已开放" : "未开放") },
            { title: tr("模型标签"), render: (_, item) => <Select mode="multiple" className="w-full" aria-label={`${tr("模型标签")} ${item.model}`} placeholder={tr("选择标签")} options={options} showSearch={{ optionFilterProp: "searchLabel" }} value={item.tags} onChange={(tags) => updateRow(item.modelId || item.model, { tags })} /> },
        ]} />
    </Card></main>;
}
