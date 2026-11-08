"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Modal, Table, Typography } from "antd";
import { GenerationRetentionFields } from "@/components/generation-retention-fields";
import { fetchAdminGenerationRetention, generationSections, saveAdminGenerationRetention, type GenerationRetention } from "@/services/api/generation-retention";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/hooks/use-i18n";
import { adminRealtimeQueryOptions } from "../admin-query-options";

export default function RecordStoragePage() {
    const token = useUserStore((state) => state.token);
    const { tr } = useI18n();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [editing, setEditing] = useState<GenerationRetention | null>(null);
    const [form] = Form.useForm<GenerationRetention>();
    const query = useQuery({ queryKey: ["admin", "generation-retention", token], queryFn: () => fetchAdminGenerationRetention(token), enabled: Boolean(token), ...adminRealtimeQueryOptions });
    const save = useMutation({
        mutationFn: (value: GenerationRetention) => saveAdminGenerationRetention(token, value),
        onSuccess: async () => {
            setEditing(null);
            await client.invalidateQueries({ queryKey: ["admin", "generation-retention"] });
            await client.invalidateQueries({ queryKey: ["generation-retention"] });
            message.success(tr("保存规则已更新"));
        },
        onError: (error) => message.error(error.message),
    });
    return <main className="p-3 sm:p-4 lg:p-6">
        <Card variant="borderless" title="记录保存">
            <Typography.Paragraph type="secondary">按工作台配置会员组的生成文件保存天数。用户单独设置优先，规则调整仅用于新生成结果，已生成文件保持原到期时间。</Typography.Paragraph>
            <Typography.Paragraph type="secondary">文件到期后自动删除，工作流和素材引用不会延长生成文件期限；后台任务记录仍保留提示词、参数与错误信息。</Typography.Paragraph>
            {query.isError ? <Typography.Paragraph type="danger" data-i18n-skip>{tr(query.error.message)}</Typography.Paragraph> : null}
            <Table<GenerationRetention> rowKey="group" loading={query.isFetching} dataSource={query.data || []} pagination={false} scroll={{ x: 700 }} columns={[
                { title: "会员组别", dataIndex: "group", render: (group: string) => <span data-i18n-skip>{group.toUpperCase()}</span> },
                ...generationSections.map((section) => ({ title: section.label, key: section.key, render: (_: unknown, item: GenerationRetention) => <span data-i18n-skip>{tr("{0} 天").replace("{0}", String(item.days[section.key]))}</span> })),
                { title: "操作", key: "action", render: (_, item) => <Button type="link" onClick={() => { form.setFieldsValue(item); setEditing(item); }}>修改</Button> },
            ]} />
        </Card>
        <Modal title="修改保存规则" open={Boolean(editing)} confirmLoading={save.isPending} onCancel={() => setEditing(null)} onOk={async () => save.mutate({ ...await form.validateFields(), group: editing!.group })} okText="保存" cancelText="取消">
            <Form form={form} layout="vertical"><Typography.Paragraph data-i18n-skip>{editing?.group.toUpperCase()}</Typography.Paragraph><GenerationRetentionFields /></Form>
        </Modal>
    </main>;
}
