"use client";

import { useEffect, useState } from "react";
import { Avatar, App, Button, Form, Input, Segmented } from "antd";
import { Save } from "lucide-react";
import { AvatarUpload } from "@/components/avatar-upload";

import { ConsoleKycCard } from "@/components/console-kyc-card";
import { COOKIE_SESSION_TOKEN, completeProfile, type AuthUser } from "@/services/api/auth";
import { createKycSession, fetchKycStatus } from "@/services/api/billing";
import { useUserStore } from "@/stores/use-user-store";

type ProfileValues = {
    displayName: string;
    accountType: "personal" | "company";
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
    const avatarUrl = user?.avatarUrl || "";
    const userName = user?.displayName || user?.username || "";

    useEffect(() => {
        form.setFieldsValue({ displayName: user?.displayName || "", accountType: user?.accountType || "personal" });
    }, [form, user?.displayName, user?.accountType]);

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
                                <h2 className="truncate text-lg font-semibold">{userName || "Aivro 用户"}</h2>
                                <p className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400">@{user?.username}</p>
                                <div className="mt-2"><AvatarUpload /></div>
                            </div>
                        </div>
                        <Form<ProfileValues> form={form} layout="vertical" requiredMark={false} onFinish={saveProfile}>
                            <Form.Item name="displayName" label="公开名称" extra="展示在个人资料、工作流卡片和分享页面中。" rules={[{ required: true, message: "请输入公开名称" }]}>
                                <Input placeholder="输入公开名称" />
                            </Form.Item>
                            <Form.Item name="accountType" label="账号类型">
                                <Segmented block options={[{ label: "个人", value: "personal" }, { label: "公司", value: "company" }]} />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={saving} icon={<Save className="size-4" />}>
                                保存资料
                            </Button>
                        </Form>
                    </div>

                    <ConsoleKycCard kyc={kyc} loading={kycLoading} onStart={startKyc} />
                </section>
            </div>
        </div>
    );
}
