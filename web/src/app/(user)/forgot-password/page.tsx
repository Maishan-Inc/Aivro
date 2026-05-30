"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { resetPassword, sendEmailCode } from "@/services/api/auth";

type ForgotPasswordValues = {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
};

export default function ForgotPasswordPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const [form] = Form.useForm<ForgotPasswordValues>();
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const requestCode = async () => {
        const email = form.getFieldValue("email");
        if (!email) {
            message.warning("请先输入邮箱");
            return;
        }
        setSendingCode(true);
        try {
            await sendEmailCode(email, "reset");
            message.success("验证码已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送失败");
        } finally {
            setSendingCode(false);
        }
    };

    const submit = async (values: ForgotPasswordValues) => {
        if (values.password !== values.confirmPassword) {
            message.error("两次输入的密码不一致");
            return;
        }
        setSubmitting(true);
        try {
            await resetPassword({ email: values.email, code: values.code, password: values.password });
            message.success("密码已重置");
            router.replace("/login");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "重置失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background px-6 py-10">
            <section className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">找回密码</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">通过已绑定邮箱重置账号密码。</p>
                </div>
                <Form<ForgotPasswordValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
                    <Form.Item name="email" label="邮箱" rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
                        <Input prefix={<MailOutlined />} autoComplete="email" />
                    </Form.Item>
                    <Form.Item label="邮箱验证码">
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                                <Input autoComplete="one-time-code" />
                            </Form.Item>
                            <Button loading={sendingCode} onClick={() => void requestCode()}>
                                发送验证码
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="password" label="新密码" rules={[{ required: true, message: "请输入新密码" }]}>
                        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label="确认密码" rules={[{ required: true, message: "请再次输入新密码" }]}>
                        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                    </Form.Item>
                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                        <Button block type="primary" htmlType="submit" loading={submitting}>
                            重置密码
                        </Button>
                        <Link className="block text-center text-sm text-stone-500 underline-offset-4 hover:underline dark:text-stone-400" href="/login">
                            返回登录
                        </Link>
                    </Space>
                </Form>
            </section>
        </main>
    );
}
