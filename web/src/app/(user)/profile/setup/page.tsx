"use client";

import { safeRedirect } from "@/lib/safe-redirect";

import { FlowBackground } from "@/components/flow-background";

import { UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Segmented } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { COOKIE_SESSION_TOKEN, completeProfile } from "@/services/api/auth";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useUserStore } from "@/stores/use-user-store";

type ProfileValues = {
    username: string;
    accountType: "personal" | "company";
    displayName: string;
};

export default function ProfileSetupPage() {
    return (
        <Suspense fallback={null}>
            <ProfileSetupContent />
        </Suspense>
    );
}

function ProfileSetupContent() {
    const { message } = App.useApp();
    const router = useRouter();
    const search = useSearchParams();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const setSession = useUserStore((state) => state.setSession);
    const localizedPath = useLocalizedPath();
    const [saving, setSaving] = useState(false);
    const redirect = safeRedirect(search.get("redirect") || localizedPath("/canvas"));

    useEffect(() => {
        if (user?.profileCompleted) router.replace(redirect);
    }, [redirect, router, user?.profileCompleted]);

    const submit = async (values: ProfileValues) => {
        if (!token || !user) {
            router.replace(localizedPath(`/login?redirect=${encodeURIComponent(redirect)}`));
            return;
        }
        setSaving(true);
        try {
            const nextUser = await completeProfile(token, values);
            setSession(token || COOKIE_SESSION_TOKEN, nextUser);
            message.success("资料已完成");
            router.replace(redirect);
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background px-6 py-10">
            <FlowBackground />
            <section className="relative z-10 m-auto w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">完善账户信息</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">确认路由名称，选择账户类型并填写公开名称。</p>
                </div>
                <Form<ProfileValues> layout="vertical" size="large" requiredMark={false} initialValues={{ username: user?.username || "", accountType: "personal", displayName: user?.displayName || "" }} onFinish={submit}>
                    <Form.Item
                        name="username"
                        label="路由名称"
                        extra="用于系统中的公开路由，仅支持小写字母和数字，当前系统暂不支持修改。"
                        rules={[
                            { required: true, message: "请输入路由名称" },
                            { pattern: /^[a-z0-9]{3,24}$/, message: "请输入 3-24 位小写字母或数字" },
                        ]}
                    >
                        <Input prefix={<UserOutlined />} autoComplete="username" />
                    </Form.Item>
                    <Form.Item name="accountType">
                        <Segmented block options={[{ label: "个人", value: "personal" }, { label: "公司", value: "company" }]} />
                    </Form.Item>
                    <Form.Item name="displayName" label="公开名称" extra="展示在个人资料、工作流卡片和分享页面中。" rules={[{ required: true, message: "请输入公开名称" }]}>
                        <Input prefix={<UserOutlined />} autoComplete="name" />
                    </Form.Item>
                    <Button block type="primary" htmlType="submit" loading={saving}>
                        完成
                    </Button>
                </Form>
            </section>
        </main>
    );
}

