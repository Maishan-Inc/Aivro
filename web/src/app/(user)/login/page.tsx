"use client";

import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Segmented, Space } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useTurnstileChallenge } from "@/hooks/use-turnstile-challenge";
import { fetchCurrentUser, sendEmailCode } from "@/services/api/auth";
import type { AdminPublicAuthProvider } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type LoginFormValues = {
    username: string;
    password: string;
    email?: string;
    code?: string;
    confirmPassword?: string;
};

type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

function safeRedirect(value: string) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    return value;
}

function LoginContent() {
    const { message } = App.useApp();
    const { locale } = useI18n();
    const [form] = Form.useForm<LoginFormValues>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const login = useUserStore((state) => state.login);
    const register = useUserStore((state) => state.register);
    const setSession = useUserStore((state) => state.setSession);
    const isLoading = useUserStore((state) => state.isLoading);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const authSettings = publicSettings?.auth;
    const linuxDoEnabled = authSettings?.linuxDo?.enabled === true;
    const emailVerification = authSettings?.emailVerification === true;
    const turnstileSiteKey = authSettings?.turnstileSiteKey || "";
    const allowRegister = useConfigStore((state) => state.publicSettings?.auth?.allowRegister !== false);
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const { verify: verifyTurnstile, challenge: turnstileChallenge } = useTurnstileChallenge(turnstileSiteKey);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [sendingCode, setSendingCode] = useState(false);
    const redirect = safeRedirect(searchParams.get("redirect") || "/");
    const thirdPartyProviders = ([
        authSettings?.google,
        authSettings?.github,
        authSettings?.linuxDo,
        ...(authSettings?.customProviders || []),
    ] as Array<AdminPublicAuthProvider | undefined>).filter((item): item is AdminPublicAuthProvider => item?.enabled === true);

    useEffect(() => {
        const token = searchParams.get("token");
        const error = searchParams.get("error");
        if (error) message.error(error);
        if (!token) return;
        void fetchCurrentUser(token).then((user) => {
            setSession(token, user);
            message.success("登录成功");
            router.replace(redirect);
            router.refresh();
        });
    }, [message, redirect, router, searchParams, setSession]);

    useEffect(() => {
        if (!allowRegister && mode === "register") setMode("login");
    }, [allowRegister, mode]);

    const submit = async (values: LoginFormValues) => {
        try {
            if (!publicSettings) {
                message.warning("认证配置加载中，请稍后再试");
                return;
            }
            if (mode === "register" && !allowRegister) {
                message.error("当前未开放注册");
                return;
            }
            if (mode === "register" && values.password !== values.confirmPassword) {
                message.error("两次输入的密码不一致");
                return;
            }
            const turnstileToken = await verifyTurnstile();
            const action = mode === "register" ? register : login;
            const user = await runWithOverlay(mode === "register" ? "正在注册" : "正在登录", () => action({ username: values.username, password: values.password, email: values.email, code: values.code, turnstileToken }));
            message.success(mode === "register" ? "注册成功" : "登录成功");
            router.replace(redirect);
            router.refresh();
            if (user.role !== "admin") router.replace("/");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "登录失败");
        }
    };

    const requestRegisterCode = async (formEmail: string | undefined) => {
        if (!formEmail) {
            message.warning("请先输入邮箱");
            return;
        }
        if (!publicSettings) {
            message.warning("认证配置加载中，请稍后再试");
            return;
        }
        setSendingCode(true);
        try {
            const turnstileToken = await verifyTurnstile();
            await sendEmailCode(formEmail, "register", turnstileToken);
            message.success("验证码已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送失败");
        } finally {
            setSendingCode(false);
        }
    };

    const connectMetaMask = async () => {
        const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
        if (!ethereum) {
            message.error("未检测到 MetaMask");
            return;
        }
        try {
            const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
            const walletAddress = accounts?.[0];
            if (!walletAddress) {
                message.error("未获取到钱包地址");
                return;
            }
            const signMessage = `Aivro MetaMask login\nWallet: ${walletAddress}\nTime: ${Date.now()}`;
            const signature = (await ethereum.request({ method: "personal_sign", params: [signMessage, walletAddress] })) as string;
            const params = new URLSearchParams({ walletAddress, message: signMessage, signature, redirect });
            router.push(`/metamask-email?${params.toString()}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "MetaMask 签名失败");
        }
    };

    return (
        <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-10 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]">
            <section className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <span
                        className="mx-auto mb-4 block size-12 bg-stone-950 dark:bg-stone-100"
                        style={{
                            mask: "url(/logo.svg) center / contain no-repeat",
                            WebkitMask: "url(/logo.svg) center / contain no-repeat",
                        }}
                        aria-label="边缘幻星"
                    />
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">{mode === "register" ? (locale === "en-US" ? "Create account" : "创建账号") : locale === "en-US" ? "Account sign in" : "账号登录"}</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{mode === "register" ? (locale === "en-US" ? "Create an Aivro account to keep your generation history and assets." : "创建 Aivro 账号，开始保存你的生成记录与素材。") : locale === "en-US" ? "Use password, email verification, or third-party sign in." : "支持账号密码、邮箱验证和第三方登录。"}</p>
                </div>

                <Form<LoginFormValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
                    <Form.Item>
                        <Segmented
                            block
                            value={mode}
                            onChange={(value) => setMode(value as "login" | "register")}
                            options={allowRegister ? [{ label: locale === "en-US" ? "Sign in" : "登录", value: "login" }, { label: locale === "en-US" ? "Register" : "注册", value: "register" }] : [{ label: locale === "en-US" ? "Sign in" : "登录", value: "login" }]}
                        />
                    </Form.Item>
                    <AnimatePresence mode="wait">
                        <motion.div key={mode} initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(6px)" }} transition={{ duration: 0.22, ease: "easeOut" }}>
                            {mode === "register" && emailVerification ? (
                                <>
                                    <Form.Item name="email" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Email" : "邮箱"}</span>} rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
                                        <Input prefix={<MailOutlined />} autoComplete="email" />
                                    </Form.Item>
                                    <Form.Item label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Email code" : "邮箱验证码"}</span>}>
                                        <Space.Compact style={{ width: "100%" }}>
                                            <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                                                <Input autoComplete="one-time-code" />
                                            </Form.Item>
                                            <Button
                                                disabled={sendingCode || !publicSettings}
                                                icon={sendingCode ? <AivroDrawableLoader compact className="h-4 w-12 text-stone-950 dark:text-stone-100" /> : undefined}
                                                onClick={() => void requestRegisterCode(form.getFieldValue("email"))}
                                            >
                                                {sendingCode ? (locale === "en-US" ? "Sending" : "发送中") : locale === "en-US" ? "Send code" : "发送验证码"}
                                            </Button>
                                        </Space.Compact>
                                    </Form.Item>
                                </>
                            ) : null}
                            <Form.Item name="username" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Username" : "用户名"}</span>} rules={[{ required: true, message: "请输入用户名" }]}>
                                <Input prefix={<UserOutlined />} autoComplete="username" />
                            </Form.Item>
                            <Form.Item name="password" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Password" : "密码"}</span>} rules={[{ required: true, message: "请输入密码" }]}>
                                <Input.Password prefix={<LockOutlined />} autoComplete={mode === "register" ? "new-password" : "current-password"} />
                            </Form.Item>
                            {mode === "register" ? (
                                <Form.Item name="confirmPassword" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Confirm password" : "确认密码"}</span>} rules={[{ required: true, message: "请再次输入密码" }]}>
                                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                                </Form.Item>
                            ) : null}
                        </motion.div>
                    </AnimatePresence>
                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                        <Button
                            block
                            type="primary"
                            htmlType="submit"
                            disabled={isLoading || !publicSettings}
                            icon={isLoading ? <AivroDrawableLoader compact className="h-4 w-14 text-white dark:text-white" /> : undefined}
                        >
                            {isLoading ? (locale === "en-US" ? "Processing" : "处理中") : mode === "register" ? (locale === "en-US" ? "Register" : "注册") : locale === "en-US" ? "Sign in" : "登录"}
                        </Button>
                        <p className="m-0 text-center text-xs leading-5 text-stone-500 dark:text-stone-400">
                            {mode === "register" ? (locale === "en-US" ? "Registering" : "注册") : locale === "en-US" ? "Signing in to" : "登录"} Aivro，{locale === "en-US" ? "means you agree to our" : "即代表你同意我们的"}{" "}
                            <a href="/privacy" className="font-medium text-stone-800 underline underline-offset-4 dark:text-stone-200">
                                {locale === "en-US" ? "Privacy Policy" : "隐私政策"}
                            </a>{" "}
                            {locale === "en-US" ? "and" : "和"}{" "}
                            <a href="/terms" className="font-medium text-stone-800 underline underline-offset-4 dark:text-stone-200">
                                {locale === "en-US" ? "Terms of Service" : "服务条款"}
                            </a>
                        </p>
                        {mode === "login" ? (
                            <Button block type="link" href="/forgot-password">
                                {locale === "en-US" ? "Forgot password" : "找回密码"}
                            </Button>
                        ) : null}
                        {mode === "login" && authSettings?.metamask?.enabled ? (
                            <Button block onClick={() => void connectMetaMask()}>
                                {locale === "en-US" ? "Sign in with MetaMask" : "使用 MetaMask 登录"}
                            </Button>
                        ) : null}
                        {mode === "login"
                            ? thirdPartyProviders.map((provider) =>
                                  provider?.id === "linux-do" && linuxDoEnabled ? (
                                      <Button key={provider.id} block href={`/api/auth/linux-do/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <img src={provider.iconUrl} alt="" width={18} height={18} /> : undefined}>
                                          {locale === "en-US" ? "Sign in with" : "使用"} {provider.name} {locale === "en-US" ? "" : "登录"}
                                      </Button>
                                  ) : (
                                      <Button key={provider.id} block href={`/api/auth/oauth/${encodeURIComponent(provider.id)}/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <img src={provider.iconUrl} alt="" width={18} height={18} /> : undefined}>
                                          {locale === "en-US" ? "Sign in with" : "使用"} {provider.name} {locale === "en-US" ? "" : "登录"}
                                      </Button>
                                  ),
                              )
                            : null}
                    </Space>
                </Form>
            </section>
            {turnstileChallenge}
            {overlay}
        </main>
    );
}
