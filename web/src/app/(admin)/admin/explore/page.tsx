"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { fetchExploreSettings, fetchFreeImageCampaigns, saveExploreSettings, saveFreeImageCampaign, type ExploreSettings, type FreeImageCampaign } from "@/services/api/explore";
import { generationGroups } from "@/services/api/generation-retention";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";
import { FreeImageSubmissions } from "./components/free-image-submissions";

type CampaignForm = Omit<FreeImageCampaign, "startsAt" | "endsAt"> & { period: [Dayjs, Dayjs] };

export default function ExplorePage() {
    const token = useUserStore((state) => state.token);
    const channel = useConfigStore((state) => state.publicSettings?.modelChannel);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [settingsForm] = Form.useForm<ExploreSettings>();
    const [campaignForm] = Form.useForm<CampaignForm>();
    const [editing, setEditing] = useState<FreeImageCampaign | null>(null);
    const [page, setPage] = useState(1);
    const settings = useQuery({ queryKey: ["admin", "explore", token], queryFn: () => fetchExploreSettings(token), enabled: Boolean(token), staleTime: Infinity });
    const campaigns = useQuery({ queryKey: ["admin", "free-image-campaigns", token, page], queryFn: () => fetchFreeImageCampaigns(token, page), enabled: Boolean(token), refetchInterval: 30000 });
    useEffect(() => { if (settings.data) settingsForm.setFieldsValue(settings.data); }, [settings.data, settingsForm]);
    useEffect(() => { void loadPublicSettings(); }, [loadPublicSettings]);
    const saveSettings = useMutation({ mutationFn: (input: ExploreSettings) => saveExploreSettings(token, input), onSuccess: async (input) => {
        client.setQueryData(["admin", "explore", token], input);
        await loadPublicSettings();
        message.success(tr("内置工具设置已保存"));
    }, onError: (error) => message.error(tr(error.message)) });
    const saveCampaign = useMutation({ mutationFn: (input: FreeImageCampaign) => saveFreeImageCampaign(token, input), onSuccess: async () => {
        setEditing(null);
        await Promise.all([client.invalidateQueries({ queryKey: ["admin", "free-image-campaigns"] }), client.invalidateQueries({ queryKey: ["free-image-state"] }), loadPublicSettings()]);
        message.success(tr("免费活动已保存"));
    }, onError: (error) => message.error(tr(error.message)) });
    const openCampaign = (item?: FreeImageCampaign) => {
        const value = item || { id: "", name: "", enabled: false, startsAt: "", endsAt: "", models: [], groupLimits: Object.fromEntries(generationGroups.map((group) => [group, 0])) };
        campaignForm.resetFields();
        campaignForm.setFieldsValue({ ...value, period: item ? [dayjs(item.startsAt), dayjs(item.endsAt)] : undefined });
        setEditing(value);
    };
    return <main className="space-y-4 p-3 sm:p-4 lg:p-6">
        <Card variant="borderless" title="内置工具" loading={settings.isLoading}>
            {settings.isError ? <Typography.Text type="danger" data-i18n-skip>{tr(settings.error.message)}</Typography.Text> : null}
            <Typography.Paragraph type="secondary">两个工具默认关闭；全部关闭时不显示“探索更多”。免费生图还需开启有效活动。</Typography.Paragraph>
            <Form form={settingsForm} layout="vertical" onFinish={(input) => saveSettings.mutate(input)}>
                <div className="grid gap-x-6 sm:grid-cols-2">
                    <Form.Item name="freeImageEnabled" label="免费生成图片" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="promptReverseEnabled" label="提示词反推" valuePropName="checked"><Switch /></Form.Item>
                </div>
                <Form.Item name="systemPrompt" label="反推分析提示词" extra="参考 MX-Insight 的分析维度；可手动调整内容，保留六语言 JSON 输出结构。反推只使用已开放的文本模型，按文本模型价格计费。" rules={[{ required: true, message: "请输入反推分析提示词" }]}><Input.TextArea autoSize={{ minRows: 8, maxRows: 18 }} /></Form.Item>
                <Button type="primary" htmlType="submit" loading={saveSettings.isPending} disabled={!settings.data}>保存设置</Button>
            </Form>
        </Card>
        <Card variant="borderless" title="免费生图活动" extra={<Button onClick={() => openCampaign()}>新建活动</Button>}>
            <Typography.Paragraph type="secondary">每一期活动独立计算会员次数，0 次表示不可使用。每次生成一张图片，失败或撤销返还次数；活动不可重叠，结束后自动停止。常规工作台与 API 仍按原价计费。</Typography.Paragraph>
            {campaigns.isError ? <Typography.Paragraph type="danger" data-i18n-skip>{tr(campaigns.error.message)}</Typography.Paragraph> : null}
            <Table<FreeImageCampaign> rowKey="id" loading={campaigns.isFetching} dataSource={campaigns.data?.items || []} scroll={{ x: 1050 }} pagination={{ current: page, pageSize: 20, total: campaigns.data?.total, onChange: setPage, showSizeChanger: false }} columns={[
                { title: "活动名称", dataIndex: "name", render: (value) => <span data-i18n-skip>{value}</span> },
                { title: "状态", render: (_, item) => <Tag>{tr(!item.enabled ? "未开启" : Date.parse(item.endsAt) <= Date.now() ? "已结束" : Date.parse(item.startsAt) > Date.now() ? "未开始" : "进行中")}</Tag> },
                { title: "活动时间", render: (_, item) => <span data-i18n-skip>{formatDateTime(item.startsAt)} – {formatDateTime(item.endsAt)}</span> },
                { title: "可用模型", render: (_, item) => <span data-i18n-skip>{item.models.join(", ")}</span> },
                { title: "会员次数", render: (_, item) => <span data-i18n-skip>{generationGroups.map((group) => `${group.toUpperCase()}: ${item.groupLimits[group]}`).join(" / ")}</span> },
                { title: "操作", render: (_, item) => <Button type="link" onClick={() => openCampaign(item)}>修改</Button> },
            ]} />
        </Card>
        <FreeImageSubmissions />
        <Modal title={editing?.id ? "修改免费活动" : "新建免费活动"} open={Boolean(editing)} confirmLoading={saveCampaign.isPending} onCancel={() => setEditing(null)} okText="保存" cancelText="取消" width={720} onOk={async () => {
            const { period, ...value } = await campaignForm.validateFields();
            saveCampaign.mutate({ ...editing!, ...value, startsAt: period[0].toISOString(), endsAt: period[1].toISOString() });
        }}>
            <Form form={campaignForm} layout="vertical">
                <Form.Item name="name" label="活动名称" rules={[{ required: true, message: "请输入活动名称" }]}><Input /></Form.Item>
                <Form.Item name="enabled" label="开启活动" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item name="period" label="活动起止时间" rules={[{ required: true, message: "请设置活动起止时间" }]}><DatePicker.RangePicker showTime style={{ width: "100%" }} /></Form.Item>
                <Form.Item name="models" label="本期可用图片模型" rules={[{ required: true, message: "请选择本期可用图片模型" }]}><Select mode="multiple" showSearch options={(channel?.imageModels || []).filter((model) => channel?.availableModels.includes(model)).map((model) => ({ label: model, value: model }))} /></Form.Item>
                <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">{generationGroups.map((group) => <Form.Item key={group} name={["groupLimits", group]} label={<span data-i18n-skip>{group.toUpperCase()}</span>} rules={[{ required: true, message: "请输入活动次数" }]}><InputNumber min={0} max={100000} precision={0} style={{ width: "100%" }} /></Form.Item>)}</div>
            </Form>
        </Modal>
    </main>;
}
