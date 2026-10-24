"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, App, Button, Empty, Form, Input, Modal, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowUpRight, BookOpen, Copy, KeyRound, Plus, RefreshCw } from "lucide-react";

import { useCopyText } from "@/hooks/use-copy-text";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { formatDateTime } from "@/lib/datetime";
import { useUserStore } from "@/stores/use-user-store";
import { createAPIKey, listAPIKeys, revokeAPIKey, type CreatedUserAPIKey, type UserAPIKey, type UserAPIKeyList } from "@/services/api/api-keys";

const dateText = (value: string) => value ? formatDateTime(value) : "尚未使用";

export default function APIKeysPage() {
    const token = useUserStore((state) => state.token);
    const userID = useUserStore((state) => state.user?.id);
    const localizedPath = useLocalizedPath();
    const copyText = useCopyText();
    const { message, modal } = App.useApp();
    const [form] = Form.useForm<{ name: string }>();
    const [data, setData] = useState<UserAPIKeyList>({ items: [], total: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<CreatedUserAPIKey | null>(null);

    useEffect(() => {
        setCreated(null);
        setCreateOpen(false);
        setData({ items: [], total: 0 });
        setPage(1);
    }, [userID]);

    useEffect(() => {
        if (!token || !userID) return;
        let active = true;
        setLoading(true);
        setError("");
        listAPIKeys(token, page, pageSize).then((result) => { if (active) setData(result); }).catch((err: Error) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, userID, page, pageSize, revision]);

    async function create(values: { name: string }) {
        if (!token || creating) return;
        setCreating(true);
        try {
            const result = await createAPIKey(token, values.name.trim());
            if (useUserStore.getState().user?.id !== userID) return;
            setCreated(result);
            setCreateOpen(false);
            form.resetFields();
            setPage(1);
            setRevision((value) => value + 1);
        } catch (err) { message.error(err instanceof Error ? err.message : "创建失败"); }
        finally { setCreating(false); }
    }

    function revoke(item: UserAPIKey) {
        modal.confirm({
            title: `撤销「${item.name}」？`,
            content: "撤销后无法恢复，使用此密钥的新请求将立即被拒绝。已经提交的生成任务会继续执行。",
            okText: "确认撤销", cancelText: "取消", okButtonProps: { danger: true },
            onOk: async () => {
                if (!token) return;
                try {
                    await revokeAPIKey(token, item.id);
                    message.success("密钥已撤销");
                    setRevision((value) => value + 1);
                } catch (err) { message.error(err instanceof Error ? err.message : "撤销失败"); throw err; }
            },
        });
    }

    const columns: ColumnsType<UserAPIKey> = [
        { title: "名称", dataIndex: "name", render: (name: string) => <span data-i18n-skip className="font-medium">{name}</span> },
        { title: "密钥标识", dataIndex: "preview", render: (preview: string) => <code className="text-xs text-muted-foreground">{preview}</code> },
        { title: "状态", dataIndex: "status", render: (status: string) => <Tag color={status === "active" ? "success" : "default"}>{status === "active" ? "可用" : "已撤销"}</Tag> },
        { title: "创建时间", dataIndex: "createdAt", render: dateText },
        { title: "最近调用", dataIndex: "lastUsedAt", render: dateText },
        { title: "操作", width: 90, render: (_, item) => <Button type="text" danger disabled={item.status === "revoked"} onClick={() => revoke(item)}>撤销</Button> },
    ];

    return <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
                <div><div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><KeyRound className="size-4" />程序化调用</div><h1 className="text-2xl font-semibold tracking-tight">密钥管理</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">用一个密钥连接本站模型，在你的应用中调用图片、对话、视频和 3D 生成。</p></div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>创建密钥</Button>
            </header>
            <Alert type="info" showIcon title="完整密钥只显示一次" description="创建成功后请立即复制保存。本站仅保存密钥摘要，之后无法再次查看。名称在当前账号内唯一，忽略首尾空格与字母大小写；已撤销的名称仍保留。" />
            <section className="min-w-0 rounded-xl border border-border p-4 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-sm font-medium">我的密钥 <span className="ml-2 font-normal tabular-nums text-muted-foreground">{data.total}</span></h2><Button type="text" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => setRevision((value) => value + 1)}>刷新</Button></div>
                {error ? <Alert className="mb-4" type="error" showIcon title={error} /> : null}
                <Table<UserAPIKey> rowKey="id" columns={columns} dataSource={data.items} loading={loading} scroll={{ x: 900 }} pagination={{ current: page, pageSize, total: data.total, showSizeChanger: true, onChange: (nextPage, size) => { setPage(size !== pageSize ? 1 : nextPage); setPageSize(size); }, showTotal: (total) => `共 ${total} 个密钥` }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "暂时无法加载密钥" : "还没有密钥，创建后即可开始调用"} /> }} />
            </section>
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground"><p>API 调用使用当前账号的算力点，按模型定价表中的 API 价格结算。</p><Link href={localizedPath("/developers")} className="inline-flex items-center gap-2 text-foreground hover:opacity-70"><BookOpen className="size-4" />阅读开发文档<ArrowUpRight className="size-3.5" /></Link></div>
        </div>
        <Modal title="创建 API 密钥" open={createOpen} onCancel={() => { if (!creating) setCreateOpen(false); }} onOk={() => form.submit()} okText="创建密钥" cancelText="取消" confirmLoading={creating} cancelButtonProps={{ disabled: creating }} closable={!creating} mask={{ closable: !creating }} destroyOnHidden>
            <Form form={form} layout="vertical" preserve={false} clearOnDestroy onFinish={create} className="pt-4"><Form.Item label="密钥名称" name="name" rules={[{ required: true, whitespace: true, message: "请输入密钥名称" }, { max: 50, message: "名称最多 50 个字符" }]}><Input autoFocus maxLength={50} placeholder="例如：我的应用、服务器、自动化脚本" disabled={creating} /></Form.Item><p className="text-xs leading-6 text-muted-foreground">使用容易辨认的名称。完整密钥由后端自动生成，创建后仅展示一次。</p></Form>
        </Modal>
        <Modal title="请保存你的密钥" open={created !== null} onCancel={() => setCreated(null)} keyboard={false} mask={{ closable: false }} destroyOnHidden footer={<Button type="primary" onClick={() => setCreated(null)}>我已保存，关闭</Button>}>
            {created ? <div className="space-y-4 py-3"><Alert type="warning" showIcon title="关闭后无法再次查看" description="请立即复制完整密钥，并存放在服务器环境变量或密钥管理工具中。请勿提交到代码仓库或嵌入浏览器页面。" /><div className="rounded-lg border border-border bg-muted/40 p-4"><p data-i18n-skip className="mb-2 text-xs text-muted-foreground">{created.item.name}</p><code className="block break-all text-sm" data-i18n-skip>{created.key}</code></div><Button block icon={<Copy className="size-4" />} onClick={() => copyText(created.key, "完整密钥已复制，请妥善保存")}>复制完整密钥</Button></div> : null}
        </Modal>
    </div>;
}
