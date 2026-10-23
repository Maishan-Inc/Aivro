"use client";

import { safeRedirect } from "@/lib/safe-redirect";

import { FlowBackground } from "@/components/flow-background";
import auth from "./login.module.css";

import { EyeInvisibleOutlined, LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Segmented, Space } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AivroReveal } from "@/components/aivro-reveal";
import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useCaptchaChallenge } from "@/hooks/use-captcha-challenge";
import { COOKIE_SESSION_TOKEN, fetchCurrentUser, fetchMetaMaskChallenge, loginWithMetaMask, sendRegisterEmailCode } from "@/services/api/auth";
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
    const captcha = authSettings?.captcha?.enabled ? authSettings.captcha : authSettings?.turnstileSiteKey ? { enabled: true, provider: "turnstile" as const, siteKey: authSettings.turnstileSiteKey } : undefined;
    const allowRegister = authSettings?.allowRegister !== false;
    const { overlay, runWithOverlay } = useAuthLoadingOverlay();
    const { verify: verifyCaptcha, reset: resetCaptcha, challenge: captchaChallenge } = useCaptchaChallenge(captcha);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [registerStep, setRegisterStep] = useState<RegisterStep>("credential");
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [codeSeconds, setCodeSeconds] = useState(0);
    const [metaMaskAvailable, setMetaMaskAvailable] = useState(true);
    const redirect = safeRedirect(searchParams.get("redirect") || localizedPath("/canvas"));
    const thirdPartyProviders = ([authSettings?.google, authSettings?.github, authSettings?.linuxDo, ...(authSettings?.customProviders || [])] as Array<AdminPublicAuthProvider | undefined>).filter((item): item is AdminPublicAuthProvider => item?.enabled === true && item.id !== "metamask");

    useEffect(() => {
        const error = searchParams.get("error");
        if (error) message.error(error);
        if (error) return;
        void fetchCurrentUser().then((user) => {
            if (user.role === "guest") return;
            setSession(COOKIE_SESSION_TOKEN, user);
            message.success("登录成功");
            router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
            router.refresh();
        }).catch(() => undefined);
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
        if (submitting) return;
        setSubmitting(true);
        try {
            if (!publicSettings) {
                message.warning("认证配置加载中，请稍后再试");
                return;
            }
            if (mode === "register") {
                if (registerStep === "credential") {
                    await startRegisterCode(values);
                    return;
                }
                if (registerStep === "code") {
                    setRegisterStep("profile");
                    return;
                }
                const email = values.email || "";
                const captchaToken = await verifyCaptcha();
                const user = await runWithOverlay("正在注册", () =>
                    runWithCaptchaReset(resetCaptcha, () =>
                        register({
                            username: values.username || "",
                            password: values.password,
                            email,
                            code: values.code,
                            accountType: values.accountType || "personal",
                            displayName: values.displayName,
                            captchaToken,
                        }),
                    ),
                );
                message.success("注册成功");
                router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
                router.refresh();
                return;
            }
            const captchaToken = await verifyCaptcha();
            const user = await runWithOverlay("正在登录", () => runWithCaptchaReset(resetCaptcha, () => login({ username: values.username, password: values.password, captchaToken })));
            message.success("登录成功");
            router.replace(user.profileCompleted ? redirect : localizedPath(`/profile/setup?redirect=${encodeURIComponent(redirect)}`));
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : mode === "register" ? "注册失败" : "登录失败");
        } finally {
            setSubmitting(false);
        }
    };

    const startRegisterCode = async (values: LoginFormValues) => {
        if (!allowRegister) {
            message.error("当前未开放注册");
            return;
        }
        if (!values.email || !values.password) {
            message.warning("请填写邮箱和密码");
            return;
        }
        const sent = await requestRegisterCode(values.email);
        if (sent) setRegisterStep("code");
    };

    const requestRegisterCode = async (email: string) => {
        if (codeSeconds > 0) return false;
        if (!email) {
            message.warning("请先填写邮箱");
            return false;
        }
        setSendingCode(true);
        try {
            // 始终在发送验证码之前完成人机验证，拦截未通过验证的请求。
            const captchaToken = await verifyCaptcha();
            await runWithCaptchaReset(resetCaptcha, () => sendRegisterEmailCode(email, captchaToken));
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
            const captchaToken = await verifyCaptcha();
            const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
            const walletAddress = accounts?.[0];
            if (!walletAddress) {
                message.error("未获取到钱包地址");
                return;
            }
            const challenge = await runWithCaptchaReset(resetCaptcha, () => fetchMetaMaskChallenge(walletAddress, captchaToken));
            const signMessage = challenge.message;
            const signature = (await ethereum.request({ method: "personal_sign", params: [signMessage, walletAddress] })) as string;
            try {
                const session = await runWithOverlay("正在登录", () => runWithCaptchaReset(resetCaptcha, () => loginWithMetaMask({ walletAddress, message: signMessage, signature, email: "", code: "", captchaToken })));
                const user = await fetchCurrentUser(session.token);
                setSession(COOKIE_SESSION_TOKEN, user);
                message.success("登录成功");
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
        <main className={auth.page}>
            <FlowBackground />
            <AivroReveal className={auth.container}>
                <Form<LoginFormValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit} className={auth.form}>
                    <div data-aivro-reveal className="mb-8 flex items-center justify-center gap-3">
                        <span className="block size-10 bg-foreground" style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }} aria-hidden="true" />
                        <span className="text-4xl font-semibold leading-none tracking-normal text-foreground">Aivro</span>
                    </div>
                    <AivroReveal key={`${mode}-${registerStep}`}>
                        <div data-aivro-reveal className="aivro-auth-fields">
                            {mode === "register" ? <RegisterFields step={registerStep} sendingCode={sendingCode} codeSeconds={codeSeconds} publicReady={Boolean(publicSettings)} onResend={() => void requestRegisterCode(form.getFieldValue("email"))} /> : <LoginFields />}
                        </div>
                    </AivroReveal>
                    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
                        <Button className="!mt-1 !h-11 !rounded-md !text-sm !font-medium" block type="primary" htmlType="submit" loading={isLoading || sendingCode || submitting} disabled={!publicSettings}>
                            {isLoading || sendingCode ? "处理中" : registerButtonText(mode, registerStep)}
                        </Button>
                        <div className="flex items-center justify-between px-1 text-sm">
                            {mode === "login" ? <>
                                <a href={localizedPath("/forgot-password")} className="text-muted-foreground hover:text-foreground">找回密码</a>
                                {allowRegister ? <button type="button" className="font-medium text-foreground" onClick={() => { setMode("register"); setRegisterStep("credential"); form.resetFields(); }}>注册 Aivro 账户</button> : null}
                            </> : <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setMode("login"); setRegisterStep("credential"); form.resetFields(); }}>返回登录</button>}
                        </div>
                        <p className="m-0 px-1 text-center text-xs leading-6 text-muted-foreground">
                            {mode === "register" ? "注册" : "登录"} Aivro，即代表你同意我们的{" "}
                            <a href={localizedPath("/privacy")} className="font-medium text-foreground underline underline-offset-4">
                                隐私政策
                            </a>{" "}
                            和{" "}
                            <a href={localizedPath("/terms")} className="font-medium text-foreground underline underline-offset-4">
                                服务条款
                            </a>
                        </p>
                        {mode === "login" ? <LoginActions redirect={redirect} authSettings={authSettings} linuxDoEnabled={linuxDoEnabled} providers={thirdPartyProviders} metaMaskAvailable={metaMaskAvailable} onMetaMask={connectMetaMask} /> : null}
                    </Space>
                </Form>
            </AivroReveal>
            {captchaChallenge}
            {overlay}
        </main>
    );
}

function LoginFields() {
    return (
        <>
            <Form.Item name="username" label={<span className="font-medium text-foreground">邮箱</span>} rules={[{ required: true, message: "请输入邮箱" }]}>
                <Input prefix={<MailOutlined />} autoComplete="email" />
            </Form.Item>
            <Form.Item name="password" label={<span className="font-medium text-foreground">密码</span>} rules={[{ required: true, message: "请输入密码" }]}>
                <Input.Password prefix={<LockOutlined />} iconRender={() => <EyeInvisibleOutlined />} autoComplete="current-password" />
            </Form.Item>
        </>
    );
}

function RegisterFields({ step, sendingCode, codeSeconds, publicReady, onResend }: { step: RegisterStep; sendingCode: boolean; codeSeconds: number; publicReady: boolean; onResend: () => void }) {
    return (
        <>
            <RegisterSteps active={step} />
            <div className="mt-8">
                {step === "credential" ? (
                    <>
                        <Form.Item name="email" label={<span className="font-medium text-foreground">邮箱</span>} rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
                            <Input prefix={<MailOutlined />} autoComplete="email" />
                        </Form.Item>
                        <Form.Item name="password" label={<span className="font-medium text-foreground">密码</span>} rules={[{ required: true, message: "请输入密码" }]}>
                            <Input.Password prefix={<LockOutlined />} iconRender={() => <EyeInvisibleOutlined />} autoComplete="new-password" />
                        </Form.Item>
                    </>
                ) : null}
                {step === "code" ? (
                    <Form.Item label={<span className="font-medium text-foreground">邮箱验证码</span>}>
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                                <Input autoComplete="one-time-code" />
                            </Form.Item>
                            <Button disabled={sendingCode || !publicReady || codeSeconds > 0} onClick={onResend}>
                                {codeSeconds > 0 ? `${codeSeconds}s` : "重新发送"}
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                ) : null}
                {step === "profile" ? (
                    <>
                        <Form.Item
                            name="username"
                            label={<span className="font-medium text-foreground">路由名称</span>}
                            extra={<span className="text-muted-foreground">用于系统中的公开路由，仅支持小写字母和数字，当前系统暂不支持修改。</span>}
                            rules={[
                                { required: true, message: "请输入路由名称" },
                                { pattern: /^[a-z0-9]{3,24}$/, message: "请输入 3-24 位小写字母或数字" },
                            ]}
                        >
                            <Input prefix={<UserOutlined />} autoComplete="username" />
                        </Form.Item>
                        <Form.Item name="accountType" initialValue="personal">
                            <Segmented block options={[{ label: "个人", value: "personal" }, { label: "公司", value: "company" }]} />
                        </Form.Item>
                        <Form.Item name="displayName" label={<span className="font-medium text-foreground">公开名称</span>} extra={<span className="text-muted-foreground">展示在个人资料、工作流卡片和分享页面中。</span>} rules={[{ required: true, message: "请输入公开名称" }]}>
                            <Input prefix={<UserOutlined />} autoComplete="name" />
                        </Form.Item>
                    </>
                ) : null}
            </div>
        </>
    );
}

function RegisterSteps({ active }: { active: RegisterStep }) {
    const steps: Array<{ key: RegisterStep; label: string }> = [
        { key: "credential", label: "邮箱" },
        { key: "code", label: "验证码" },
        { key: "profile", label: "资料" },
    ];
    const activeIndex = steps.findIndex((item) => item.key === active);
    return (
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border text-center text-xs font-medium">
            {steps.map((step, index) => (
                <div key={step.key} className={`py-2 ${index <= activeIndex ? "bg-foreground text-background" : "bg-transparent text-muted-foreground"}`}>
                    {step.label}
                </div>
            ))}
        </div>
    );
}

function LoginActions({ redirect, authSettings, linuxDoEnabled, providers, metaMaskAvailable, onMetaMask }: { redirect: string; authSettings?: { metamask?: AdminPublicAuthProvider }; linuxDoEnabled: boolean; providers: AdminPublicAuthProvider[]; metaMaskAvailable: boolean; onMetaMask: () => void }) {
    const { tr } = useI18n();
    return (
        <div className="w-full">
            {authSettings?.metamask?.enabled || providers.length ? (
                <div className="mt-5">
                    <div className="grid gap-3">
                        {authSettings?.metamask?.enabled ? (
                            <Button className="h-11 justify-start" block disabled={!metaMaskAvailable} title={metaMaskAvailable ? undefined : tr("未检测到 MetaMask")} icon={<ProviderIcon src={authSettings.metamask.iconUrl || "/icons/metamask.svg"} />} onClick={() => void onMetaMask()}>
                                {metaMaskAvailable ? tr(`使用 ${authSettings.metamask.name || "MetaMask"} 登录`) : tr("安装 MetaMask 后登录")}
                            </Button>
                        ) : null}
                        {providers.map((provider) =>
                            provider.id === "linux-do" ? (
                                linuxDoEnabled ? (
                                    <Button className="h-11 justify-start" key={provider.id} block href={`/api/auth/linux-do/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <ProviderIcon src={provider.iconUrl} /> : undefined}>
                                        {tr(`使用 ${provider.name} 登录`)}
                                    </Button>
                                ) : null
                            ) : (
                                <Button className="h-11 justify-start" key={provider.id} block href={`/api/auth/oauth/${encodeURIComponent(provider.id)}/authorize?redirect=${encodeURIComponent(redirect)}`} icon={provider.iconUrl ? <ProviderIcon src={provider.iconUrl} /> : undefined}>
                                    {tr(`使用 ${provider.name} 登录`)}
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

function registerButtonText(mode: "login" | "register", step: RegisterStep) {
    if (mode === "login") return "登录";
    if (step === "credential") return "注册";
    if (step === "code") return "下一步";
    return "完成";
}

async function runWithCaptchaReset<T>(resetCaptcha: () => void, action: () => Promise<T>) {
    try {
        return await action();
    } finally {
        resetCaptcha();
    }
}

