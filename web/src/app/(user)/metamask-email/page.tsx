"use client";

import { MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Space, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { TurnstileField } from "@/components/turnstile-field";
import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { fetchCurrentUser, loginWithMetaMask, sendEmailCode } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type MetaMaskEmailValues = {
    email: string;
    code: string;
};

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
    const [form] = Form.useForm<MetaMaskEmailValues>();
    const setSession = useUserStore((state) => state.setSession);
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileResetKey, setTurnstileResetKey] = useState(0);
    const turnstileSiteKey = useConfigStore((state) => state.publicSettings?.auth?.turnstileSiteKey || "");
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const walletAddress = searchParams.get("walletAddress") || "";
    const signMessage = searchParams.get("message") || "";
    const signature = searchParams.get("signature") || "";
    const redirect = safeRedirect(searchParams.get("redirect") || "/");
    const resetTurnstile = useCallback(() => {
        setTurnstileToken("");
        setTurnstileResetKey((value) => value + 1);
    }, []);

    const requestCode = async () => {
        const email = form.getFieldValue("email");
        if (!email) {
            message.warning("请先输入邮箱");
            return;
        }
        setSendingCode(true);
        try {
            await sendEmailCode(email, "metamask", turnstileToken);
            message.success("验证码已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送失败");
        } finally {
            setSendingCode(false);
            resetTurnstile();
        }
    };

    const submit = async (values: MetaMaskEmailValues) => {
        if (!walletAddress || !signature) {
            message.error("缺少 MetaMask 签名信息");
            return;
        }
        setSubmitting(true);
        try {
            const session = await runWithOverlay("正在完成登录", () => loginWithMetaMask({ walletAddress, message: signMessage, signature, email: values.email, code: values.code, turnstileToken }));
            const user = await fetchCurrentUser(session.token);
            setSession(session.token, user);
            message.success("登录成功");
            router.replace(redirect);
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "登录失败");
        } finally {
            setSubmitting(false);
            resetTurnstile();
        }
    };

    return (
        <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background px-6 py-10">
            <section className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">验证邮箱</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">MetaMask 首次登录需要绑定一个邮箱。</p>
                    {walletAddress ? <Typography.Text type="secondary">{walletAddress}</Typography.Text> : null}
                </div>
                <Form<MetaMaskEmailValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
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
                    <TurnstileField siteKey={turnstileSiteKey} resetKey={turnstileResetKey} onVerify={setTurnstileToken} />
                    <Button block type="primary" htmlType="submit" loading={submitting} icon={submitting ? <AivroDrawableLoader compact className="h-4 w-14 text-white dark:text-white" /> : undefined}>
                        {submitting ? "处理中" : "完成登录"}
                    </Button>
                </Form>
            </section>
            {overlay}
        </main>
    );
}

function safeRedirect(value: string) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    return value;
}
