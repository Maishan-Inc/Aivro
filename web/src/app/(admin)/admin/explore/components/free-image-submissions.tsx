"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Image, Input, InputNumber, Modal, Table, Tag, Typography } from "antd";
import { fetchFreeImageSubmissions, publishFreeImage } from "@/services/api/explore";
import type { GenerationHistory } from "@/services/api/generation-history";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime } from "@/lib/datetime";

type Publication = { title: string; prompt: string; rewardCredits: number };

export function FreeImageSubmissions() {
    const token = useUserStore((state) => state.token);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<GenerationHistory | null>(null);
    const [form] = Form.useForm<Publication>();
    const query = useQuery({ queryKey: ["admin", "free-image-submissions", token, page], queryFn: () => fetchFreeImageSubmissions(token, page), enabled: Boolean(token), refetchInterval: 30000 });
    const publish = useMutation({ mutationFn: (input: Publication) => publishFreeImage(token, { ...input, historyId: selected!.id }), onSuccess: async () => {
        setSelected(null);
        await Promise.all([client.invalidateQueries({ queryKey: ["admin", "free-image-submissions"] }), client.invalidateQueries({ queryKey: ["explore-history", "free-image"] })]);
        message.success(tr("作品已公开，奖励已发放"));
    }, onError: (error) => message.error(tr(error.message)) });
    return <>
        <Card variant="borderless" title="免费作品审核">
            <Typography.Paragraph type="secondary">按图片质量挑选作品，公开图片及提示词到素材库，并发放设定的奖励算力点。同一作品只能公开和奖励一次，公开副本保留在素材库中。</Typography.Paragraph>
            {query.isError ? <Typography.Paragraph type="danger" data-i18n-skip>{tr(query.error.message)}</Typography.Paragraph> : null}
            <Table<GenerationHistory> rowKey="id" dataSource={query.data?.items || []} loading={query.isFetching} scroll={{ x: 900 }} pagination={{ current: page, pageSize: 20, total: query.data?.total, onChange: setPage, showSizeChanger: false }} columns={[
                { title: "图片", render: (_, item) => <Image src={item.media[0]?.url} width={72} height={72} style={{ objectFit: "cover" }} alt={tr("免费生成图片")} /> },
                { title: "用户", dataIndex: "userId", render: (value) => <span data-i18n-skip>{value}</span> },
                { title: "提示词", dataIndex: "prompt", render: (value) => <p className="max-w-80 line-clamp-3" data-i18n-skip>{value}</p> },
                { title: "活动", dataIndex: "campaignId", render: (value) => <span data-i18n-skip>{value}</span> },
                { title: "保存至", dataIndex: "expiresAt", render: (value) => <span data-i18n-skip>{formatDateTime(value)}</span> },
                { title: "奖励", render: (_, item) => item.publishedAssetId ? <Tag data-i18n-skip>{tr("已公开，奖励 {0} 点").replace("{0}", String(item.rewardCredits))}</Tag> : <Button type="link" disabled={Date.parse(item.expiresAt) <= Date.now()} onClick={() => { form.setFieldsValue({ title: item.title, prompt: item.prompt, rewardCredits: 1 }); setSelected(item); }}>公开并奖励</Button> },
            ]} />
        </Card>
        <Modal title="公开免费作品并发放奖励" width={640} open={Boolean(selected)} confirmLoading={publish.isPending} okText="公开并奖励" cancelText="取消" onCancel={() => setSelected(null)} onOk={async () => publish.mutate(await form.validateFields())}>
            <Image src={selected?.media[0]?.url} alt={tr("免费生成图片")} style={{ maxHeight: 320, objectFit: "contain" }} />
            <Form form={form} layout="vertical" className="mt-4">
                <Form.Item name="title" label="公开标题" rules={[{ required: true, message: "请输入公开标题" }]}><Input /></Form.Item>
                <Form.Item name="prompt" label="公开提示词" rules={[{ required: true, message: "请输入公开提示词" }]}><Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} /></Form.Item>
                <Form.Item name="rewardCredits" label="奖励算力点" rules={[{ required: true, message: "请输入奖励算力点" }]}><InputNumber min={1} max={1000000} precision={0} style={{ width: "100%" }} /></Form.Item>
            </Form>
        </Modal>
    </>;
}
