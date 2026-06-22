"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useCaptchaChallenge } from "@/hooks/use-captcha-challenge";
import { resetPassword, sendEmailCode } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";

type ForgotPasswordValues = {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
};

export default function ForgotPasswordPage() {
    const { message } = App.useApp();
    const { locale } = useI18n();
    const localizedPath = useLocalizedPath();
    const router = useRouter();
    const [form] = Form.useForm<ForgotPasswordValues>();
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const captcha = publicSettings?.auth?.captcha?.enabled ? publicSettings.auth.captcha : publicSettings?.auth?.turnstileSiteKey ? { enabled: true, provider: "turnstile" as const, siteKey: publicSettings.auth.turnstileSiteKey } : undefined;
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const { verify: verifyCaptcha, challenge: captchaChallenge } = useCaptchaChallenge(captcha);

    const requestCode = async () => {
        const email = form.getFieldValue("email");
        if (!email) {
            message.warning("请先输入邮箱");
            return;
        }
        if (!publicSettings) {
            message.warning("认证配置加载中，请稍后再试");
            return;
        }
        setSendingCode(true);
        try {
            const captchaToken = await verifyCaptcha();
            await sendEmailCode(email, "reset", captchaToken);
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
        if (!publicSettings) {
            message.warning("认证配置加载中，请稍后再试");
            return;
        }
        setSubmitting(true);
        try {
            const captchaToken = await verifyCaptcha();
            await runWithOverlay("正在重置密码", () => resetPassword({ email: values.email, code: values.code, password: values.password, captchaToken }));
            message.success("密码已重置");
            router.replace(localizedPath("/login"));
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
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">{locale === "en-US" ? "Forgot password" : "找回密码"}</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{locale === "en-US" ? "Reset your password with your verified email." : "通过已绑定邮箱重置账号密码。"}</p>
                </div>
                <Form<ForgotPasswordValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
                    <Form.Item name="email" label={locale === "en-US" ? "Email" : "邮箱"} rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
                        <Input prefix={<MailOutlined />} autoComplete="email" />
                    </Form.Item>
                    <Form.Item label={locale === "en-US" ? "Email code" : "邮箱验证码"}>
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                                <Input autoComplete="one-time-code" />
                            </Form.Item>
                            <Button loading={sendingCode} disabled={!publicSettings} onClick={() => void requestCode()}>
                                {locale === "en-US" ? "Send code" : "发送验证码"}
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="password" label={locale === "en-US" ? "New password" : "新密码"} rules={[{ required: true, message: "请输入新密码" }]}>
                        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label={locale === "en-US" ? "Confirm password" : "确认密码"} rules={[{ required: true, message: "请再次输入新密码" }]}>
                        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                    </Form.Item>
                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                        <Button block type="primary" htmlType="submit" loading={submitting} disabled={!publicSettings}>
                            {submitting ? (locale === "en-US" ? "Processing" : "处理中") : locale === "en-US" ? "Reset password" : "重置密码"}
                        </Button>
                        <Link className="block text-center text-sm text-stone-500 underline-offset-4 hover:underline dark:text-stone-400" href={localizedPath("/login")}>
                            {locale === "en-US" ? "Back to sign in" : "返回登录"}
                        </Link>
                    </Space>
                </Form>
            </section>
            {captchaChallenge}
            {overlay}
        </main>
    );
}
