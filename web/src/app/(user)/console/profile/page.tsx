"use client";

import { useEffect, useState } from "react";
import { Avatar, App, Button, Form, Input, Segmented, Tag } from "antd";
import { BadgeCheck, Save, UserRound } from "lucide-react";

import { COOKIE_SESSION_TOKEN, completeProfile, type AuthUser } from "@/services/api/auth";
import { createKycSession, fetchKycStatus } from "@/services/api/billing";
import { useUserStore } from "@/stores/use-user-store";

type ProfileValues = {
    displayName: string;
    accountType: "personal" | "company";
    avatarUrl: string;
};

type KycStatus = Awaited<ReturnType<typeof fetchKycStatus>>;

export default function ConsoleProfilePage() {
    const { message } = App.useApp();
    const [form] = Form.useForm<ProfileValues>();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const setSession = useUserStore((state) => state.setSession);
    const [saving, setSaving] = useState(false);
    const [kyc, setKyc] = useState<KycStatus | null>(null);
    const [kycLoading, setKycLoading] = useState(false);
    const avatarUrl = Form.useWatch("avatarUrl", form) || user?.avatarUrl || "";
    const userName = user?.displayName || user?.username || "";

    useEffect(() => {
        form.setFieldsValue({ displayName: user?.displayName || "", accountType: user?.accountType || "personal", avatarUrl: user?.avatarUrl || "" });
    }, [form, user]);

    useEffect(() => {
        if (!token) return;
        fetchKycStatus(token).then(setKyc).catch(() => undefined);
    }, [token]);

    const saveProfile = async (values: ProfileValues) => {
        if (!token || !user) return;
        setSaving(true);
        try {
            const saved: AuthUser = await completeProfile(token, values);
            setSession(token || COOKIE_SESSION_TOKEN, saved);
            message.success("个人资料已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const startKyc = async () => {
        if (!token) return;
        setKycLoading(true);
        try {
            const result = await createKycSession(token);
            window.location.href = result.url;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建 KYC 认证失败");
        } finally {
            setKycLoading(false);
        }
    };

    return (
        <div className="thin-scrollbar h-full overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <section className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                    <h1 className="text-2xl font-semibold tracking-normal">个人中心</h1>
                    <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">管理头像、账户资料、KYC 身份验证，后续更多功能会继续放在这里。</p>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                        <div className="mb-5 flex items-center gap-4">
                            <Avatar size={72} src={avatarUrl || undefined} className="border border-stone-200 bg-transparent text-xl dark:border-stone-700">
                                {(userName[0] || "U").toUpperCase()}
                            </Avatar>
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-semibold">{userName || "Aivro User"}</h2>
                                <p className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400">@{user?.username}</p>
                            </div>
                        </div>
                        <Form<ProfileValues> form={form} layout="vertical" requiredMark={false} onFinish={saveProfile}>
                            <Form.Item name="avatarUrl" label="头像 URL">
                                <Input prefix={<UserRound className="size-4 text-stone-400" />} placeholder="填写图片 URL 修改头像" />
                            </Form.Item>
                            <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: "请输入显示名称" }]}>
                                <Input placeholder="显示在站内的名称" />
                            </Form.Item>
                            <Form.Item name="accountType" label="账号类型">
                                <Segmented block options={[{ label: "个人", value: "personal" }, { label: "公司", value: "company" }]} />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={saving} icon={<Save className="size-4" />}>
                                保存资料
                            </Button>
                        </Form>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-background p-5 dark:border-stone-800">
                        <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-900">
                            <BadgeCheck className="size-5" />
                        </div>
                        <h2 className="text-base font-semibold">KYC 身份验证</h2>
                        <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">通过验证后按后台配置发放奖励。认证服务由管理员配置的 KYC 提供商处理。</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Tag className="m-0">{formatKycStatus(kyc?.status)}</Tag>
                            {kyc?.enabled ? <Tag className="m-0">已启用</Tag> : <Tag className="m-0">未配置</Tag>}
                        </div>
                        {kyc?.rewards ? <p className="mt-4 text-sm leading-6 text-stone-500 dark:text-stone-400">通过奖励：{kyc.rewards.credits} 算力点，{kyc.rewards.workflowCreateCredits} 次工作流创建次数。</p> : null}
                        <Button className="mt-5" block type="primary" disabled={!kyc?.enabled || kyc?.status === "approved"} loading={kycLoading} onClick={startKyc}>
                            {kyc?.status === "approved" ? "已完成认证" : "开始 KYC 认证"}
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}

function formatKycStatus(status?: string) {
    if (status === "approved") return "已通过";
    if (status === "pending") return "认证中";
    if (status === "rejected") return "未通过";
    if (status === "expired") return "已过期";
    return "未认证";
}
