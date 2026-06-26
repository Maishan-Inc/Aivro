"use client";

import { MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Space, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useCaptchaChallenge } from "@/hooks/use-captcha-challenge";
import { COOKIE_SESSION_TOKEN, fetchCurrentUser, loginWithMetaMask, sendEmailCode } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type MetaMaskEmailValues = {
    email: string;
    code: string;
};

type MetaMaskLoginPayload = {
    walletAddress: string;
    message: string;
    signature: string;
    redirect: string;
};

const metamaskPayloadStorageKey = "aivro-metamask-login-payload-v1";

export default function MetaMaskEmailPage() {
    return (
        <Suspense fallback={null}>
            <MetaMaskEmailContent />
        </Suspense>
    );
}

function MetaMaskEmailContent() {
    const { message } = App.useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useI18n();
    const localizedPath = useLocalizedPath();
    const [form] = Form.useForm<MetaMaskEmailValues>();
    const setSession = useUserStore((state) => state.setSession);
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [codeSeconds, setCodeSeconds] = useState(0);
    const [payload, setPayload] = useState<MetaMaskLoginPayload | null>(null);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const captcha = publicSettings?.auth?.captcha?.enabled ? publicSettings.auth.captcha : publicSettings?.auth?.turnstileSiteKey ? { enabled: true, provider: "turnstile" as const, siteKey: publicSettings.auth.turnstileSiteKey } : undefined;
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const { verify: verifyCaptcha, challenge: captchaChallenge } = useCaptchaChallenge(captcha);
    const walletAddress = payload?.walletAddress || "";
    const signMessage = payload?.message || "";
    const signature = payload?.signature || "";
    const redirect = safeRedirect(payload?.redirect || searchParams.get("redirect") || localizedPath("/canvas"));

    useEffect(() => {
        if (codeSeconds <= 0) return;
        const timer = window.setInterval(() => setCodeSeconds((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [codeSeconds]);

    useEffect(() => {
        const raw = window.sessionStorage.getItem(metamaskPayloadStorageKey);
        if (!raw) return;
        try {
            const next = JSON.parse(raw) as MetaMaskLoginPayload;
            if (next.walletAddress && next.message && next.signature) setPayload(next);
        } catch {
            window.sessionStorage.removeItem(metamaskPayloadStorageKey);
        }
    }, []);

    const requestCode = async () => {
        const email = form.getFieldValue("email");
        if (!email) {
            message.warning(locale === "en-US" ? "Enter your email first" : "请先输入邮箱");
            return;
        }
        if (!publicSettings) {
            message.warning(locale === "en-US" ? "Auth settings are loading. Try again later." : "认证配置加载中，请稍后再试");
            return;
        }
        if (codeSeconds > 0) return;
        setSendingCode(true);
        try {
            const captchaToken = await verifyCaptcha();
            await sendEmailCode(email, "metamask", captchaToken);
            setCodeSeconds(60);
            message.success(locale === "en-US" ? "Code sent" : "验证码已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : locale === "en-US" ? "Send failed" : "发送失败");
        } finally {
            setSendingCode(false);
        }
    };

    const submit = async (values: MetaMaskEmailValues) => {
        if (!walletAddress || !signature) {
            message.error(locale === "en-US" ? "MetaMask signature is missing. Please sign in again." : "缺少 MetaMask 签名信息，请重新登录。");
            router.replace(localizedPath("/login"));
            return;
        }
        if (!publicSettings) {
            message.warning(locale === "en-US" ? "Auth settings are loading. Try again later." : "认证配置加载中，请稍后再试");
            return;
        }
        setSubmitting(true);
        try {
            const captchaToken = await verifyCaptcha();
            const session = await runWithOverlay(locale === "en-US" ? "Completing sign in" : "正在完成登录", () => loginWithMetaMask({ walletAddress, message: signMessage, signature, email: values.email, code: values.code, captchaToken }));
            const user = await fetchCurrentUser(session.token);
            setSession(COOKIE_SESSION_TOKEN, user);
            window.sessionStorage.removeItem(metamaskPayloadStorageKey);
            message.success(locale === "en-US" ? "Signed in" : "登录成功");
            router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : locale === "en-US" ? "Sign in failed" : "登录失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background px-6 py-10">
            <section className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">{locale === "en-US" ? "Verify email" : "验证邮箱"}</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{locale === "en-US" ? "Bind an email for your first MetaMask sign in." : "MetaMask 首次登录需要绑定一个邮箱。"}</p>
                    {walletAddress ? <Typography.Text type="secondary">{walletAddress}</Typography.Text> : null}
                </div>
                <Form<MetaMaskEmailValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
                    <Form.Item name="email" label={locale === "en-US" ? "Email" : "邮箱"} rules={[{ required: true, message: locale === "en-US" ? "Enter your email" : "请输入邮箱" }, { type: "email", message: locale === "en-US" ? "Invalid email format" : "邮箱格式不正确" }]}>
                        <Input prefix={<MailOutlined />} autoComplete="email" />
                    </Form.Item>
                    <Form.Item label={locale === "en-US" ? "Email code" : "邮箱验证码"}>
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" noStyle rules={[{ required: true, message: locale === "en-US" ? "Enter the code" : "请输入验证码" }]}>
                                <Input autoComplete="one-time-code" />
                            </Form.Item>
                            <Button loading={sendingCode} disabled={!publicSettings || codeSeconds > 0} onClick={() => void requestCode()}>
                                {codeSeconds > 0 ? `${codeSeconds}s` : locale === "en-US" ? "Send code" : "发送验证码"}
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                    <Button block type="primary" htmlType="submit" loading={submitting} disabled={!publicSettings}>
                        {submitting ? (locale === "en-US" ? "Processing" : "处理中") : locale === "en-US" ? "Complete sign in" : "完成登录"}
                    </Button>
                </Form>
            </section>
            {captchaChallenge}
            {overlay}
        </main>
    );
}

function safeRedirect(value: string) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    return value;
}
