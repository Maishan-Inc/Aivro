"use client";

import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Segmented, Space } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AivroOutlineTitle } from "@/components/aivro-outline-title";
import { AivroReveal } from "@/components/aivro-reveal";
import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useTurnstileChallenge } from "@/hooks/use-turnstile-challenge";
import { fetchCurrentUser, loginWithMetaMask, sendRegisterEmailCode } from "@/services/api/auth";
import type { AdminPublicAuthProvider } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type RegisterStep = "credential" | "code" | "profile";

type LoginFormValues = {
    username: string;
    password: string;
    email?: string;
    code?: string;
    displayName?: string;
    accountType?: "personal" | "company";
};

type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const metamaskPayloadStorageKey = "aivro-metamask-login-payload-v1";

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const { message } = App.useApp();
    const { locale } = useI18n();
    const localizedPath = useLocalizedPath();
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
    const turnstileSiteKey = authSettings?.turnstileSiteKey || "";
    const allowRegister = authSettings?.allowRegister !== false;
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const { verify: verifyTurnstile, challenge: turnstileChallenge } = useTurnstileChallenge(turnstileSiteKey);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [registerStep, setRegisterStep] = useState<RegisterStep>("credential");
    const [sendingCode, setSendingCode] = useState(false);
    const [codeSeconds, setCodeSeconds] = useState(0);
    const [firstCodeSent, setFirstCodeSent] = useState(false);
    const [metaMaskAvailable, setMetaMaskAvailable] = useState(true);
    const redirect = safeRedirect(searchParams.get("redirect") || localizedPath("/"));
    const thirdPartyProviders = ([authSettings?.google, authSettings?.github, authSettings?.linuxDo, ...(authSettings?.customProviders || [])] as Array<AdminPublicAuthProvider | undefined>).filter((item): item is AdminPublicAuthProvider => item?.enabled === true);

    useEffect(() => {
        const token = searchParams.get("token");
        const error = searchParams.get("error");
        if (error) message.error(error);
        if (!token) return;
        void fetchCurrentUser(token).then((user) => {
            setSession(token, user);
            message.success("登录成功");
            router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
            router.refresh();
        });
    }, [message, redirect, router, searchParams, setSession]);

    useEffect(() => {
        if (!allowRegister && mode === "register") setMode("login");
    }, [allowRegister, mode]);

    useEffect(() => {
        setMetaMaskAvailable(Boolean((window as unknown as { ethereum?: EthereumProvider }).ethereum));
    }, []);

    useEffect(() => {
        if (codeSeconds <= 0) return;
        const timer = window.setInterval(() => setCodeSeconds((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [codeSeconds]);

    const submit = async (values: LoginFormValues) => {
        try {
            if (!publicSettings) {
                message.warning("认证配置加载中，请稍后再试");
                return;
            }
            if (mode === "register") {
                if (registerStep === "credential") {
                    await startRegisterCode(values, false);
                    return;
                }
                if (registerStep === "code") {
                    setRegisterStep("profile");
                    return;
                }
                const email = values.email || "";
                const user = await runWithOverlay("正在注册", () =>
                    register({
                        username: email,
                        password: values.password,
                        email,
                        code: values.code,
                        accountType: values.accountType || "personal",
                        displayName: values.displayName,
                    }),
                );
                message.success("注册成功");
                router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
                router.refresh();
                return;
            }
            const turnstileToken = await verifyTurnstile();
            const user = await runWithOverlay("正在登录", () => login({ username: values.username, password: values.password, turnstileToken }));
            message.success("登录成功");
            router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : mode === "register" ? "注册失败" : "登录失败");
        }
    };

    const startRegisterCode = async (values: LoginFormValues, forceHumanCheck: boolean) => {
        if (!allowRegister) {
            message.error("当前未开放注册");
            return;
        }
        if (!values.email || !values.password) {
            message.warning("请填写邮箱和密码");
            return;
        }
        const sent = await requestRegisterCode(values.email, forceHumanCheck);
        if (sent) setRegisterStep("code");
    };

    const requestRegisterCode = async (email: string, forceHumanCheck: boolean, checkedTurnstileToken = "") => {
        if (codeSeconds > 0) return false;
        if (!email) {
            message.warning("请先填写邮箱");
            return false;
        }
        setSendingCode(true);
        try {
            const turnstileToken = checkedTurnstileToken || (forceHumanCheck || !firstCodeSent ? await verifyTurnstile() : "");
            await sendRegisterEmailCode(email, turnstileToken);
            setFirstCodeSent(true);
            setCodeSeconds(60);
            message.success("验证码已发送");
            return true;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送失败");
            return false;
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
            try {
                const session = await runWithOverlay(locale === "en-US" ? "Signing in" : "正在登录", () => loginWithMetaMask({ walletAddress, message: signMessage, signature, email: "", code: "" }));
                const user = await fetchCurrentUser(session.token);
                setSession(session.token, user);
                message.success(locale === "en-US" ? "Signed in" : "登录成功");
                router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
                router.refresh();
            } catch (error) {
                const text = error instanceof Error ? error.message : "";
                if (!text.includes("验证邮箱") && !text.toLowerCase().includes("email")) throw error;
                window.sessionStorage.setItem(metamaskPayloadStorageKey, JSON.stringify({ walletAddress, message: signMessage, signature, redirect }));
                router.push(localizedPath("/metamask-email"));
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "MetaMask 签名失败");
        }
    };

    return (
        <main className="aivro-wire-surface flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background px-6 py-10">
            <AivroReveal className="w-full max-w-[420px]">
                <div data-aivro-reveal className="mb-7 text-center">
                    <span className="mx-auto mb-4 block size-12 bg-stone-950 dark:bg-stone-100" style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }} aria-label="Aivro" />
                    <AivroOutlineTitle label="Aivro" className="mx-auto mb-2 max-w-52" />
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">{mode === "register" ? (locale === "en-US" ? "Create account" : "创建账号") : locale === "en-US" ? "Account sign in" : "账号登录"}</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{mode === "register" ? (locale === "en-US" ? "Use email verification, then complete your profile." : "使用邮箱验证后，再填写账户信息。") : locale === "en-US" ? "Use email and password or a third-party account." : "支持邮箱密码和第三方登录。"}</p>
                </div>

                <Form<LoginFormValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit} className="aivro-wire-card p-5">
                    <Form.Item>
                        <Segmented
                            block
                            value={mode}
                            onChange={(value) => {
                                setMode(value as "login" | "register");
                                setRegisterStep("credential");
                                setFirstCodeSent(false);
                                setCodeSeconds(0);
                                form.resetFields();
                            }}
                            options={allowRegister ? [{ label: locale === "en-US" ? "Sign in" : "登录", value: "login" }, { label: locale === "en-US" ? "Register" : "注册", value: "register" }] : [{ label: locale === "en-US" ? "Sign in" : "登录", value: "login" }]}
                        />
                    </Form.Item>
                    <AivroReveal key={`${mode}-${registerStep}`}>
                        <div data-aivro-reveal>
                            {mode === "register" ? <RegisterFields step={registerStep} locale={locale} sendingCode={sendingCode} codeSeconds={codeSeconds} publicReady={Boolean(publicSettings)} onResend={() => void requestRegisterCode(form.getFieldValue("email"), true)} /> : <LoginFields locale={locale} />}
                        </div>
                    </AivroReveal>
                    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
                        <Button block type="primary" htmlType="submit" loading={isLoading || sendingCode} disabled={!publicSettings}>
                            {isLoading || sendingCode ? (locale === "en-US" ? "Processing" : "处理中") : registerButtonText(mode, registerStep, locale)}
                        </Button>
                        <p className="m-0 text-center text-xs leading-5 text-stone-500 dark:text-stone-400">
                            {mode === "register" ? (locale === "en-US" ? "Registering" : "注册") : locale === "en-US" ? "Signing in to" : "登录"} Aivro，{locale === "en-US" ? "means you agree to our" : "即代表你同意我们的"}{" "}
                            <a href={localizedPath("/privacy")} className="font-medium text-stone-800 underline underline-offset-4 dark:text-stone-200">
                                {locale === "en-US" ? "Privacy Policy" : "隐私政策"}
                            </a>{" "}
                            {locale === "en-US" ? "and" : "和"}{" "}
                            <a href={localizedPath("/terms")} className="font-medium text-stone-800 underline underline-offset-4 dark:text-stone-200">
                                {locale === "en-US" ? "Terms of Service" : "服务条款"}
                            </a>
                        </p>
                        {mode === "login" ? <LoginActions locale={locale} localizedPath={localizedPath} redirect={redirect} authSettings={authSettings} linuxDoEnabled={linuxDoEnabled} providers={thirdPartyProviders} metaMaskAvailable={metaMaskAvailable} onMetaMask={connectMetaMask} /> : null}
                    </Space>
                </Form>
            </AivroReveal>
            {turnstileChallenge}
            {overlay}
        </main>
    );
}

function LoginFields({ locale }: { locale: string }) {
    return (
        <>
            <Form.Item name="username" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Email" : "邮箱"}</span>} rules={[{ required: true, message: "请输入邮箱" }]}>
                <Input prefix={<MailOutlined />} autoComplete="email" />
            </Form.Item>
            <Form.Item name="password" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Password" : "密码"}</span>} rules={[{ required: true, message: "请输入密码" }]}>
                <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
        </>
    );
}

function RegisterFields({ step, locale, sendingCode, codeSeconds, publicReady, onResend }: { step: RegisterStep; locale: string; sendingCode: boolean; codeSeconds: number; publicReady: boolean; onResend: () => void }) {
    return (
        <>
            <RegisterSteps active={step} locale={locale} />
            <div className="mt-5">
                {step === "credential" ? (
                    <>
                        <Form.Item name="email" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Email" : "邮箱"}</span>} rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
                            <Input prefix={<MailOutlined />} autoComplete="email" />
                        </Form.Item>
                        <Form.Item name="password" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Password" : "密码"}</span>} rules={[{ required: true, message: "请输入密码" }]}>
                            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                        </Form.Item>
                    </>
                ) : null}
                {step === "code" ? (
                    <Form.Item label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Email code" : "邮箱验证码"}</span>}>
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                                <Input autoComplete="one-time-code" />
                            </Form.Item>
                            <Button disabled={sendingCode || !publicReady || codeSeconds > 0} onClick={onResend}>
                                {codeSeconds > 0 ? `${codeSeconds}s` : locale === "en-US" ? "Resend" : "重新发送"}
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                ) : null}
                {step === "profile" ? (
                    <>
                        <Form.Item name="accountType" initialValue="personal">
                            <Segmented block options={[{ label: locale === "en-US" ? "Personal" : "个人", value: "personal" }, { label: locale === "en-US" ? "Company" : "公司", value: "company" }]} />
                        </Form.Item>
                        <Form.Item name="displayName" label={<span className="font-medium text-stone-800 dark:text-stone-200">{locale === "en-US" ? "Name" : "名称"}</span>} rules={[{ required: true, message: "请输入名称" }]}>
                            <Input prefix={<UserOutlined />} autoComplete="name" />
                        </Form.Item>
                    </>
                ) : null}
            </div>
        </>
    );
}

function RegisterSteps({ active, locale }: { active: RegisterStep; locale: string }) {
    const steps: Array<{ key: RegisterStep; label: string }> = [
        { key: "credential", label: locale === "en-US" ? "Email" : "邮箱" },
        { key: "code", label: locale === "en-US" ? "Code" : "验证码" },
        { key: "profile", label: locale === "en-US" ? "Profile" : "资料" },
    ];
    const activeIndex = steps.findIndex((item) => item.key === active);
    return (
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-stone-200 text-center text-xs font-medium dark:border-stone-800">
            {steps.map((step, index) => (
                <div key={step.key} className={`py-2 ${index <= activeIndex ? "bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950" : "bg-background text-stone-500"}`}>
                    {step.label}
                </div>
            ))}
        </div>
    );
}

function LoginActions({ locale, localizedPath, redirect, authSettings, linuxDoEnabled, providers, metaMaskAvailable, onMetaMask }: { locale: string; localizedPath: (path: string) => string; redirect: string; authSettings?: { metamask?: AdminPublicAuthProvider }; linuxDoEnabled: boolean; providers: AdminPublicAuthProvider[]; metaMaskAvailable: boolean; onMetaMask: () => void }) {
    return (
        <div className="w-full">
            <Button block type="link" href={localizedPath("/forgot-password")}>
                {locale === "en-US" ? "Forgot password" : "找回密码"}
            </Button>
            {authSettings?.metamask?.enabled || providers.length ? (
                <div className="mt-5 border-t border-stone-200 pt-5 dark:border-stone-800">
                    <div className="mb-4 flex items-center gap-3 text-xs text-stone-400">
                        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
                        <span>{locale === "en-US" ? "Third-party sign in" : "第三方登录"}</span>
                        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
                    </div>
                    <div className="grid gap-3">
                        {authSettings?.metamask?.enabled ? (
                            <Button className="h-11 justify-start" block disabled={!metaMaskAvailable} title={metaMaskAvailable ? undefined : locale === "en-US" ? "MetaMask is not installed" : "未检测到 MetaMask"} icon={<ProviderIcon src={authSettings.metamask.iconUrl || "/icons/metamask.svg"} />} onClick={() => void onMetaMask()}>
                                {metaMaskAvailable ? (locale === "en-US" ? "Sign in with MetaMask" : "使用 MetaMask 登录") : locale === "en-US" ? "Install MetaMask to sign in" : "安装 MetaMask 后登录"}
                            </Button>
                        ) : null}
                        {providers.map((provider) =>
                            provider.id === "linux-do" && linuxDoEnabled ? (
                                <Button className="h-11 justify-start" key={provider.id} block href={`/api/auth/linux-do/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <ProviderIcon src={provider.iconUrl} /> : undefined}>
                                    {locale === "en-US" ? "Sign in with" : "使用"} {provider.name} {locale === "en-US" ? "" : "登录"}
                                </Button>
                            ) : (
                                <Button className="h-11 justify-start" key={provider.id} block href={`/api/auth/oauth/${encodeURIComponent(provider.id)}/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <ProviderIcon src={provider.iconUrl} /> : undefined}>
                                    {locale === "en-US" ? "Sign in with" : "使用"} {provider.name} {locale === "en-US" ? "" : "登录"}
                                </Button>
                            ),
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function ProviderIcon({ src }: { src: string }) {
    return <img src={src} alt="" width={20} height={20} className="shrink-0" />;
}

function registerButtonText(mode: "login" | "register", step: RegisterStep, locale: string) {
    if (mode === "login") return locale === "en-US" ? "Sign in" : "登录";
    if (step === "credential") return locale === "en-US" ? "Register" : "注册";
    if (step === "code") return locale === "en-US" ? "Next" : "下一步";
    return locale === "en-US" ? "Complete" : "完成";
}

function safeRedirect(value: string) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    return value;
}
