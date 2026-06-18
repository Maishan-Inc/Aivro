"use client";

import { CheckCircleOutlined, DeleteOutlined, EditOutlined, FormatPainterOutlined, LoadingOutlined, MailOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { json } from "@codemirror/lang-json";
import { App, Button, Card, Checkbox, Col, Drawer, Flex, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@uiw/react-codemirror";

import { fetchAdminSettings, fetchAuthProviderStats, fetchChannelModels, saveAdminSettings, testChannelModel, testCloudStorage, testMailSettings, type AdminCloudStorageSettings, type AdminModelChannel, type AdminModelCost, type AdminPrivateAuthProvider, type AdminPublicAuthProvider, type AdminSettings } from "@/services/api/admin";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });
const jsonEditorTheme = EditorView.theme({
    "&": { backgroundColor: "var(--ant-color-bg-container)", color: "var(--ant-color-text)" },
    ".cm-content": { caretColor: "var(--ant-color-text)", padding: "12px 0" },
    ".cm-line": { padding: "0 18px" },
    ".cm-gutters": { backgroundColor: "var(--ant-color-fill-quaternary)", borderRight: "1px solid var(--ant-color-border)", color: "var(--ant-color-text-tertiary)" },
    ".cm-activeLine": { backgroundColor: "var(--ant-color-fill-quaternary)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--ant-color-fill-quaternary)", color: "var(--ant-color-text)" },
    ".cm-cursor": { borderLeftColor: "var(--ant-color-text)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--ant-control-item-bg-active)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--ant-color-fill-quaternary)", border: "1px solid var(--ant-color-border)", color: "var(--ant-color-text-tertiary)" },
    "&.cm-focused": { outline: "none" },
});

const emptyPublicProvider = (id: string, name: string, iconUrl = ""): AdminPublicAuthProvider => ({ id, name, iconUrl, enabled: false });
const emptyPrivateProvider = (id: string, name: string, iconUrl = ""): AdminPrivateAuthProvider => ({ ...emptyPublicProvider(id, name, iconUrl), clientId: "", clientSecret: "", authorizeUrl: "", tokenUrl: "", userInfoUrl: "", scope: "" });
const defaultPrivacyContent = `欢迎使用 Aivro。我们重视你的隐私，并尽量只处理提供服务所必需的信息。

一、我们处理的信息
当你注册、登录或使用 Aivro 时，我们可能会处理用户名、邮箱、第三方登录标识、登录状态、算力点记录、生成请求、提示词、参考图片、生成结果地址以及你主动保存到素材或画布中的内容。生成历史保存在数据库中，并跟随云存储文件有效期展示；如果管理员开启云存储，生成后的图片和视频会由后端转存到配置的 Cloudflare R2 或兼容 S3 存储，并在到期后按配置自动清理。

二、信息用途
这些信息用于完成账号登录、身份验证、生成服务、素材和历史记录管理、算力点扣减与返还、系统安全审计、故障排查以及必要的产品体验改进。

三、第三方服务
Aivro 可能接入 OpenAI 兼容模型渠道、Cloudflare R2 / S3 云存储、邮箱服务和第三方登录服务。你提交的生成内容可能会根据管理员配置发送给相应模型服务商处理。请不要提交你无权处理或不希望第三方服务处理的敏感内容。

四、本地存储与云端工作流
Aivro 会在浏览器本地保存语言偏好、界面状态等少量配置；工作流项目保存在云端数据库中。生成模型渠道由管理员统一配置，用户侧不会保存或填写 API Key。你可以通过浏览器设置清理本地偏好数据。

五、你的选择
你可以停止使用服务、清理浏览器本地数据，或联系站点管理员请求处理账号相关信息。管理员可在后台调整模型渠道、登录方式、邮件和云存储配置。

六、政策更新
我们可能根据功能变化更新本政策。更新后的内容会展示在本页面，继续使用 Aivro 表示你理解并同意更新后的政策。`;
const defaultTermsContent = `欢迎使用 Aivro。使用、登录或注册 Aivro，即表示你同意遵守本服务条款。

一、服务说明
Aivro 提供图片、视频、文本、提示词、素材和画布相关的 AI 创作工具。具体能力取决于管理员配置的模型渠道、算力点规则、登录方式、邮件服务和云存储服务。

二、账号与安全
你应妥善保管账号、密码、邮箱验证码、第三方登录账号和钱包签名信息。通过你的账号发起的操作视为你本人行为；如发现异常，请及时停止使用并联系站点管理员。

三、内容责任
你应确保输入、上传、生成、保存和分享的内容合法合规，并拥有必要权利。请勿使用 Aivro 生成、保存或传播违法、侵权、欺诈、骚扰、恶意代码、侵犯隐私或违反模型服务商规则的内容。

四、生成结果
AI 生成结果可能存在不准确、不稳定或不符合预期的情况。你应自行判断生成内容是否适合用于商业、公开发布或其他重要场景，并承担相应责任。

五、服务变更
管理员可能根据运营需要调整模型、算力点、登录方式、云存储、自动清理策略或暂停部分能力。因第三方模型、存储、邮箱或登录服务异常导致的不可用，Aivro 会尽力恢复但不承诺绝对连续可用。

六、条款更新
我们可能根据功能和合规要求更新本条款。更新后的内容会展示在本页面，继续使用或登录 Aivro 表示你接受更新后的条款。`;
const defaultPrivacyContentEn = `Welcome to Aivro. We respect your privacy and only process information needed to provide the service.

1. Information we process
When you register, sign in, or use Aivro, we may process your username, email address, third-party login identifier, login state, credit records, generation requests, prompts, reference images, generated result URLs, and content you actively save to assets or canvas projects. Generation history is stored in the database and displayed according to the retention period of cloud storage files. If cloud storage is enabled by the administrator, generated images and videos are stored by the backend in Cloudflare R2 or S3-compatible storage and cleaned up after expiration based on the configured policy.

2. How we use information
This information is used for account login, identity verification, generation services, asset and history management, credit deduction and refund, security auditing, troubleshooting, and necessary product experience improvements.

3. Third-party services
Aivro may integrate OpenAI-compatible model providers, Cloudflare R2 / S3 cloud storage, email services, and third-party login services. Your generation content may be sent to the configured model provider. Do not submit sensitive content that you are not authorized to process or do not want third-party services to process.

4. Local storage and cloud workflows
Aivro stores a small amount of preference data such as language and UI state in the browser. Workflow projects are stored in the cloud database. Model providers are configured centrally by the administrator, and users do not store or enter API keys on the client side. You can clear local preference data through your browser settings.

5. Your choices
You may stop using the service, clear local browser data, or contact the site administrator to request handling of account-related information. Administrators can adjust model providers, login methods, email configuration, and cloud storage settings in the admin console.

6. Policy updates
We may update this policy as features change. Updated content will be shown on this page. Continuing to use Aivro means you understand and agree to the updated policy.`;
const defaultTermsContentEn = `Welcome to Aivro. By using, signing in to, or registering for Aivro, you agree to these Terms of Service.

1. Service description
Aivro provides AI creative tools for images, videos, text, prompts, assets, and canvas workflows. Available capabilities depend on the administrator's model provider, credit rules, login methods, email service, and cloud storage configuration.

2. Account and security
You are responsible for protecting your account, password, email verification codes, third-party login account, and wallet signature information. Actions initiated through your account are treated as your own. If you notice abnormal activity, stop using the service and contact the site administrator.

3. Content responsibility
You must ensure that content you input, upload, generate, save, and share is lawful and that you have the necessary rights. Do not use Aivro to generate, store, or distribute illegal, infringing, fraudulent, harassing, malicious, privacy-invasive, or model-policy-violating content.

4. Generated results
AI-generated results may be inaccurate, unstable, or different from expectations. You are responsible for deciding whether generated content is suitable for commercial use, public publishing, or other important scenarios.

5. Service changes
Administrators may adjust models, credits, login methods, cloud storage, automatic cleanup policies, or suspend some capabilities for operational reasons. Aivro will try to recover from third-party model, storage, email, or login service failures but does not guarantee uninterrupted availability.

6. Terms updates
We may update these terms for feature and compliance reasons. Updated content will be shown on this page. Continuing to use or sign in to Aivro means you accept the updated terms.`;

const emptySettings: AdminSettings = {
    public: {
        modelChannel: {
            availableModels: [],
            modelCosts: [],
            defaultModel: "",
            defaultImageModel: "",
            defaultVideoModel: "",
            defaultTextModel: "",
            systemPrompt: "",
        },
        auth: {
            allowRegister: true,
            emailVerification: false,
            turnstileSiteKey: "",
            linuxDo: emptyPublicProvider("linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: emptyPublicProvider("google", "Google", "/icons/google.svg"),
            github: emptyPublicProvider("github", "GitHub", "/icons/github.svg"),
            metamask: emptyPublicProvider("metamask", "MetaMask", "/icons/metamask.svg"),
            customProviders: [emptyPublicProvider("o2", "O2")],
        },
        pages: {
            privacyTitle: "隐私政策",
            privacyContent: defaultPrivacyContent,
            privacyTitleEn: "Privacy Policy",
            privacyContentEn: defaultPrivacyContentEn,
            termsTitle: "服务条款",
            termsContent: defaultTermsContent,
            termsTitleEn: "Terms of Service",
            termsContentEn: defaultTermsContentEn,
        },
        pageAccess: {
            canvasLoginRequired: false,
            imageLoginRequired: false,
            videoLoginRequired: false,
            promptsLoginRequired: false,
            assetsLoginRequired: false,
        },
        adSense: {
            enabled: false,
            code: "",
            adsTxt: "",
            pages: {
                home: true,
                pricing: true,
                image: true,
                video: true,
                model3d: true,
                canvas: true,
                prompts: true,
                assets: true,
                assetLibrary: true,
                privacy: true,
                terms: true,
            },
        },
    },
    private: {
        channels: [],
        promptSync: { enabled: true, cron: "*/5 * * * *" },
        aiQueue: { enabled: true, backend: "database", redisUrl: "", defaultPerMinute: 50, modelPerMinute: [], maxQueuedPerUser: 20, taskRetentionHours: 24 },
        turnstile: { enabled: false, siteKey: "", secretKey: "" },
        auth: {
            linuxDo: emptyPrivateProvider("linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: emptyPrivateProvider("google", "Google", "/icons/google.svg"),
            github: emptyPrivateProvider("github", "GitHub", "/icons/github.svg"),
            metamask: { enabled: false, siteName: "Aivro", siteUrl: "", signatureLogoUrl: "/icons/metamask.svg" },
            customProviders: [emptyPrivateProvider("o2", "O2")],
        },
        mail: {
            enabled: false,
            host: "",
            port: 587,
            username: "",
            password: "",
            fromEmail: "",
            fromName: "",
            codeExpireMin: 10,
            templates: {
                register: { subject: "注册验证码：{{code}}", body: "你的注册验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}" },
                reset: { subject: "找回密码验证码：{{code}}", body: "你的找回密码验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}" },
                metamask: { subject: "MetaMask 登录邮箱验证码：{{code}}", body: "你的 MetaMask 登录邮箱验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}" },
            },
        },
        cloudStorage: {
            enabled: false,
            storageMode: "local_only",
            provider: "r2",
            endpoint: "",
            region: "auto",
            accessKeyId: "",
            secretAccessKey: "",
            bucket: "",
            publicBaseUrl: "",
            imagePathTemplate: "{username}/images/{yyyy}/{mm}/{dd}/{filename}",
            videoPathTemplate: "{username}/videos/{yyyy}/{mm}/{dd}/{filename}",
            model3dPathTemplate: "{username}/models/{yyyy}/{mm}/{dd}/{filename}",
            imageExpireDays: 7,
            videoExpireDays: 7,
            model3dExpireDays: 7,
            autoCleanupEnabled: true,
            pathStyleEndpoint: true,
        },
        stripe: {
            enabled: false,
            secretKey: "",
            webhookSecret: "",
            successUrl: "",
            cancelUrl: "",
        },
        kyc: {
            enabled: false,
            provider: "didit",
            diditApiKey: "",
            diditWebhookSecret: "",
            workflowId: "",
            callbackUrl: "",
            rewardCredits: 0,
            rewardWorkflowCreateCredits: 0,
            rewardOnce: true,
        },
    },
};
const emptyChannel: AdminModelChannel = { protocol: "openai", name: "", baseUrl: "", apiKey: "", models: [], weight: 1, enabled: true, remark: "" };

type SettingsTabKey = "model" | "public" | "private" | "mail" | "thirdParty" | "cloudStorage" | "billingKyc" | "pages";
type EditorMode = "visual" | "json";
type ModelSelectTabKey = "new" | "current";
type MailTemplateKey = "register" | "reset" | "metamask";
type AuthProviderEditorState = { type: "oauth"; providerKey: "linuxDo" | "google" | "github" } | { type: "metamask" } | { type: "custom"; index: number };

export default function AdminSettingsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const { t } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [form] = Form.useForm<AdminSettings>();
    const [activeTab, setActiveTab] = useState<SettingsTabKey>(normalizeSettingsTab(searchParams.get("tab")));
    const [editorMode, setEditorMode] = useState<Record<string, EditorMode>>({ public: "visual", private: "visual" });
    const [jsonText, setJsonText] = useState<Record<string, string>>({ public: "", private: "" });
    const [channels, setChannels] = useState<AdminModelChannel[]>([]);
    const [channelForm] = Form.useForm<AdminModelChannel>();
    const [editingChannelIndex, setEditingChannelIndex] = useState<number | null>(null);
    const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
    const [testChannelIndex, setTestChannelIndex] = useState<number | null>(null);
    const [testKeyword, setTestKeyword] = useState("");
    const [selectedTestModels, setSelectedTestModels] = useState<string[]>([]);
    const [testingModels, setTestingModels] = useState<string[]>([]);
    const [testResults, setTestResults] = useState<Record<string, { status: "success" | "error"; duration?: string; message: string }>>({});
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [modelSelectSource, setModelSelectSource] = useState<string[]>([]);
    const [modelSelectExisting, setModelSelectExisting] = useState<string[]>([]);
    const [modelSelectSelected, setModelSelectSelected] = useState<string[]>([]);
    const [modelSelectKeyword, setModelSelectKeyword] = useState("");
    const [modelSelectNewModel, setModelSelectNewModel] = useState("");
    const [modelSelectTab, setModelSelectTab] = useState<ModelSelectTabKey>("new");
    const [isFetchingChannelModels, setIsFetchingChannelModels] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveHint, setSaveHint] = useState("手动保存");
    const [isTestingCloudStorage, setIsTestingCloudStorage] = useState(false);
    const [isSendingTestMail, setIsSendingTestMail] = useState(false);
    const [mailTestEmail, setMailTestEmail] = useState("");
    const [editingMailTemplate, setEditingMailTemplate] = useState<MailTemplateKey | null>(null);
    const [editingAuthProvider, setEditingAuthProvider] = useState<AuthProviderEditorState | null>(null);
    const [authProviderStats, setAuthProviderStats] = useState<Record<string, number>>({});
    const [currentOrigin, setCurrentOrigin] = useState("");
    const [modelCosts, setModelCosts] = useState<AdminModelCost[]>([]);
    const [knownModels, setKnownModels] = useState<string[]>([]);
    const publicModels = Form.useWatch(["public", "modelChannel", "availableModels"], form) || [];
    const customAuthProviders = Form.useWatch(["private", "auth", "customProviders"], form) || [];
    const channelModels = useMemo(() => collectChannelModels(channels), [channels]);
    const channelTableData = useMemo(() => channels.map((channel, index) => ({ ...channel, _index: index, _rowKey: `${index}-${channel.name}-${channel.baseUrl}` })), [channels]);
    const standaloneTab = activeTab === "model" || activeTab === "mail";
    const activeMode = activeTab === "model" || activeTab === "mail" || activeTab === "thirdParty" || activeTab === "cloudStorage" || activeTab === "billingKyc" || activeTab === "pages" ? "visual" : editorMode[activeTab];
    const activeJsonText = jsonText[activeTab] || "";
    const jsonError = activeMode === "json" ? getJsonError(activeJsonText) : "";
    const modelSelectGroups = useMemo(() => buildModelSelectGroups(modelSelectSource, modelSelectExisting), [modelSelectSource, modelSelectExisting]);
    const activeModelSelectModels = useMemo(() => {
        const keyword = modelSelectKeyword.trim().toLowerCase();
        return modelSelectGroups[modelSelectTab].filter((model) => model.toLowerCase().includes(keyword));
    }, [modelSelectGroups, modelSelectKeyword, modelSelectTab]);
    const activeSelectedCount = activeModelSelectModels.filter((model) => modelSelectSelected.includes(model)).length;
    const jsonTextRef = useRef(jsonText);
    const settingsLoadedRef = useRef(false);
    const authProviderSnapshotRef = useRef<AdminSettings | null>(null);

    useEffect(() => {
        jsonTextRef.current = jsonText;
    }, [jsonText]);

    useEffect(() => {
        setCurrentOrigin(window.location.origin);
    }, []);

    const saveSettings = useCallback(async () => {
        if (!token) return;
        const values = await collectSettings(form, editorMode, jsonTextRef.current, message);
        if (!values) {
            return;
        }
        setIsSaving(true);
        setSaveHint("保存中");
        try {
            const saved = normalizeSettings(await saveAdminSettings(token, values));
            const merged = mergeSavedSecrets(values, saved);
            form.setFieldsValue(merged);
            setChannels(merged.private.channels);
            setModelCosts(merged.public.modelChannel.modelCosts);
            rememberKnownModels(merged);
            setJsonText({
                public: JSON.stringify(merged.public, null, 2),
                private: JSON.stringify(merged.private, null, 2),
            });
            setSaveHint("已保存");
            message.success("已保存");
        } catch (error) {
            setSaveHint("保存失败");
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setIsSaving(false);
        }
    }, [editorMode, form, message, token]);

    const handleFormValuesChange = useCallback(() => {
        if (editingAuthProvider || editingMailTemplate) return;
        if (settingsLoadedRef.current) setSaveHint("有修改未保存");
    }, [editingAuthProvider, editingMailTemplate]);

    const loadSettings = useCallback(async () => {
        if (!token) return;
        settingsLoadedRef.current = false;
        setIsLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            form.setFieldsValue(data);
            setChannels(data.private.channels);
            setModelCosts(data.public.modelChannel.modelCosts);
            setKnownModels(collectKnownModels(data));
            setJsonText({
                public: JSON.stringify(data.public, null, 2),
                private: JSON.stringify(data.private, null, 2),
            });
            try {
                setAuthProviderStats(await fetchAuthProviderStats(token));
            } catch {
                setAuthProviderStats({});
            }
            settingsLoadedRef.current = true;
            setSaveHint("手动保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取设置失败");
        } finally {
            setIsLoading(false);
        }
    }, [form, message, token]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        const nextTab = normalizeSettingsTab(searchParams.get("tab"));
        setActiveTab((current) => (current === nextTab ? current : nextTab));
    }, [searchParams]);

    useEffect(() => {
        const refreshSettings = () => {
            if (document.visibilityState !== "visible" || saveHint === "有修改未保存" || isSaving || editingAuthProvider || editingMailTemplate || isChannelDrawerOpen || isModelSelectorOpen) return;
            void loadSettings();
        };
        window.addEventListener("focus", refreshSettings);
        document.addEventListener("visibilitychange", refreshSettings);
        return () => {
            window.removeEventListener("focus", refreshSettings);
            document.removeEventListener("visibilitychange", refreshSettings);
        };
    }, [editingAuthProvider, editingMailTemplate, isChannelDrawerOpen, isModelSelectorOpen, isSaving, loadSettings, saveHint]);

    const changeTab = (nextTab: SettingsTabKey) => {
        setActiveTab(nextTab);
        router.replace(nextTab === "public" ? "/admin/settings" : `/admin/settings?tab=${nextTab}`, { scroll: false });
    };

    const markUnsaved = () => {
        if (settingsLoadedRef.current) setSaveHint("有修改未保存");
    };

    const sectionSaveButton = (label = "保存") => (
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={isSaving} onClick={() => void saveSettings()}>
            {label}
        </Button>
    );

    const sendTestMail = async () => {
        if (!token) return;
        const email = mailTestEmail.trim();
        if (!email) {
            message.warning("请填写测试收件邮箱");
            return;
        }
        setIsSendingTestMail(true);
        try {
            const mail = normalizePrivateSetting(form.getFieldValue(["private"]) as Partial<AdminSettings["private"]>).mail;
            await testMailSettings(token, mail, email);
            message.success("测试邮件已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "测试邮件发送失败");
        } finally {
            setIsSendingTestMail(false);
        }
    };

    const addCustomAuthProvider = () => {
        const current = (form.getFieldValue(["private", "auth", "customProviders"]) || []) as AdminPrivateAuthProvider[];
        const nextProvider = emptyPrivateProvider(`custom-${current.length + 1}`, `自定义登录 ${current.length + 1}`);
        openAuthProviderEditor({ type: "custom", index: current.length }, () => {
            form.setFieldValue(["private", "auth", "customProviders"], [...current, nextProvider]);
        });
    };

    const openAuthProviderEditor = (state: AuthProviderEditorState, beforeOpen?: () => void) => {
        authProviderSnapshotRef.current = normalizeSettings(form.getFieldsValue(true) as AdminSettings);
        beforeOpen?.();
        setEditingAuthProvider(state);
    };

    const closeAuthProviderEditor = () => {
        setEditingAuthProvider(null);
        authProviderSnapshotRef.current = null;
    };

    const testCurrentCloudStorage = async () => {
        if (!token) return;
        const setting = normalizeCloudStorageSetting(form.getFieldValue(["private", "cloudStorage"]) as Partial<AdminCloudStorageSettings>);
        setIsTestingCloudStorage(true);
        try {
            await testCloudStorage(token, setting);
            message.success(t("cloud.test.success"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("cloud.test.error"));
        } finally {
            setIsTestingCloudStorage(false);
        }
    };

    const toggleMode = (tab: SettingsTabKey, nextMode: EditorMode) => {
        if (tab !== "public" && tab !== "private") return;
        if (nextMode === "json") {
            setJsonText((current) => ({
                ...current,
                [tab]: JSON.stringify(tab === "public" ? normalizePublicSetting(form.getFieldValue(["public"]) as Partial<AdminSettings["public"]>) : normalizePrivateSetting(form.getFieldValue(["private"]) as Partial<AdminSettings["private"]>), null, 2),
            }));
            setEditorMode((current) => ({ ...current, [tab]: nextMode }));
            return;
        }
        const parsed = parseTabJson(tab, jsonText[tab]);
        if (!parsed) {
            message.error("JSON 格式不正确");
            return;
        }
        form.setFieldsValue({ [tab]: parsed } as Partial<AdminSettings>);
        if (tab === "private") setChannels((parsed as AdminSettings["private"]).channels);
        if (tab === "public") setModelCosts((parsed as AdminSettings["public"]).modelChannel.modelCosts);
        rememberKnownModels({ ...normalizeSettings(form.getFieldsValue(true) as AdminSettings), [tab]: parsed });
        markUnsaved();
        setEditorMode((current) => ({ ...current, [tab]: nextMode }));
    };

    const formatJson = (tab: SettingsTabKey) => {
        if (tab !== "public" && tab !== "private") return;
        const parsed = parseTabJson(tab, jsonText[tab]);
        if (!parsed) {
            message.error("JSON 格式不正确");
            return;
        }
        if (tab === "public") setModelCosts((parsed as AdminSettings["public"]).modelChannel.modelCosts);
        setJsonText((current) => ({
            ...current,
            [tab]: JSON.stringify(parsed, null, 2),
        }));
    };

    const openChannelDrawer = (index: number | null) => {
        setEditingChannelIndex(index);
        setIsChannelDrawerOpen(true);
        const channel = index === null ? emptyChannel : normalizeChannel(channels[index]);
        channelForm.setFieldsValue(channel);
        rememberModels(channel.models);
    };

    const closeChannelDrawer = () => {
        setIsChannelDrawerOpen(false);
        setEditingChannelIndex(null);
        channelForm.resetFields();
    };

    const saveChannel = async () => {
        const channel = normalizeChannel(await channelForm.validateFields());
        rememberModels(channel.models);
        const nextChannels = [...channels];
        if (editingChannelIndex === null) nextChannels.push(channel);
        else nextChannels[editingChannelIndex] = channel;
        await persistChannels(nextChannels);
        closeChannelDrawer();
    };

    const fetchChannelModelList = async () => {
        if (!token) return;
        const channel = channelForm.getFieldsValue();
        if (!channel?.baseUrl) {
            message.warning("请先填写接口地址");
            return;
        }
        if (editingChannelIndex === null && !channel?.apiKey) {
            message.warning("请先填写 API Key");
            return;
        }
        setIsFetchingChannelModels(true);
        try {
            const channelModels = await fetchChannelModels(token, { index: editingChannelIndex ?? undefined, channel: normalizeChannel(channel) });
            const current = isModelSelectorOpen ? uniqueModels(modelSelectSelected) : uniqueModels(channelForm.getFieldValue("models") || []);
            rememberModels(channelModels);
            setModelSelectExisting(current);
            setModelSelectSource(uniqueModels(channelModels));
            setModelSelectSelected(uniqueModels([...current, ...channelModels]));
            setModelSelectKeyword("");
            setModelSelectNewModel("");
            setModelSelectTab("new");
            setIsModelSelectorOpen(true);
            message.success(`已获取 ${channelModels.length} 个模型，请选择后确认`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setIsFetchingChannelModels(false);
        }
    };

    const openChannelModelSelector = (sourceModels?: string[]) => {
        const current = uniqueModels(channelForm.getFieldValue("models") || []);
        const source = uniqueModels(sourceModels !== undefined ? sourceModels : [...knownModels, ...current]);
        setModelSelectExisting(current);
        setModelSelectSource(source);
        setModelSelectSelected(sourceModels ? uniqueModels([...current, ...source]) : current);
        setModelSelectKeyword("");
        setModelSelectNewModel("");
        setModelSelectTab(sourceModels ? "new" : "current");
        setIsModelSelectorOpen(true);
    };

    const closeChannelModelSelector = () => {
        setIsModelSelectorOpen(false);
        setModelSelectKeyword("");
        setModelSelectNewModel("");
    };

    const confirmChannelModelSelector = () => {
        const models = uniqueModels(modelSelectSelected);
        channelForm.setFieldValue("models", models);
        rememberModels(models);
        closeChannelModelSelector();
    };

    const toggleSelectedModel = (model: string, checked: boolean) => {
        setModelSelectSelected((current) => (checked ? uniqueModels([...current, model]) : current.filter((item) => item !== model)));
    };

    const selectActiveModels = () => {
        setModelSelectSelected((current) => uniqueModels([...current, ...activeModelSelectModels]));
    };

    const clearActiveModels = () => {
        const active = new Set(activeModelSelectModels);
        setModelSelectSelected((current) => current.filter((model) => !active.has(model)));
    };

    const addModelInSelector = () => {
        const model = modelSelectNewModel.trim();
        if (!model) return;
        setModelSelectExisting((current) => uniqueModels([...current, model]));
        setModelSelectSelected((current) => uniqueModels([...current, model]));
        setModelSelectNewModel("");
        setModelSelectTab("current");
    };

    function rememberModels(models: string[]) {
        setKnownModels((current) => uniqueModels([...current, ...models]));
    }

    function rememberKnownModels(settings: AdminSettings) {
        rememberModels(collectKnownModels(settings));
    }

    const openTestDialog = (index: number) => {
        const channel = normalizeChannel(channels[index]);
        if (!channel.baseUrl || channel.models.length === 0) {
            message.warning("请先填写接口地址和至少一个模型");
            return;
        }
        setTestChannelIndex(index);
        setTestKeyword("");
        setSelectedTestModels([]);
        setTestingModels([]);
        setTestResults({});
    };

    const closeTestDialog = () => {
        setTestChannelIndex(null);
        setTestKeyword("");
        setSelectedTestModels([]);
        setTestingModels([]);
        setTestResults({});
    };

    const testModelOnline = async (model: string) => {
        if (testChannelIndex === null) return;
        if (!token) return;
        const channel = normalizeChannel(channels[testChannelIndex]);
        setTestingModels((current) => [...current, model]);
        try {
            const startedAt = performance.now();
            const result = await testChannelModel(token, { index: testChannelIndex, channel, model });
            setTestResults((current) => ({ ...current, [model]: { status: "success", duration: `${((performance.now() - startedAt) / 1000).toFixed(2)}s`, message: result } }));
        } catch (error) {
            setTestResults((current) => ({ ...current, [model]: { status: "error", message: error instanceof Error ? error.message : "测试失败" } }));
        } finally {
            setTestingModels((current) => current.filter((item) => item !== model));
        }
    };

    const batchTestModels = async () => {
        for (const model of selectedTestModels) {
            await testModelOnline(model);
        }
    };

    const testChannel = testChannelIndex === null ? null : normalizeChannel(channels[testChannelIndex]);
    const testModels = (testChannel?.models || []).filter((model) => model.toLowerCase().includes(testKeyword.trim().toLowerCase()));

    async function persistChannels(nextChannels: AdminModelChannel[]) {
        if (!token) return;
        const values = normalizeSettings(form.getFieldsValue(true) as AdminSettings);
        const nextChannelModels = collectChannelModels(nextChannels);
        const nextSettings = normalizeSettings({
            ...values,
            public: { ...values.public, modelChannel: { ...values.public.modelChannel, availableModels: filterModels(values.public.modelChannel.availableModels, nextChannelModels) } },
            private: { ...values.private, channels: nextChannels },
        });
        const saved = normalizeSettings(await saveAdminSettings(token, nextSettings));
        const merged = mergeSavedSecrets(nextSettings, saved);
        setChannels(merged.private.channels);
        setModelCosts(merged.public.modelChannel.modelCosts);
        rememberKnownModels(merged);
        form.setFieldsValue(merged);
        setJsonText({
            public: JSON.stringify(merged.public, null, 2),
            private: JSON.stringify(merged.private, null, 2),
        });
        message.success("已保存");
    }

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        {standaloneTab ? (
                            <Typography.Title level={5} style={{ margin: 0 }}>
                                {activeTab === "model" ? "模型配置" : "邮件配置"}
                            </Typography.Title>
                        ) : (
                            <Tabs
                                tabPosition="left"
                                activeKey={activeTab}
                                onChange={(key) => changeTab(key as SettingsTabKey)}
                                items={[
                                    { key: "public", label: "注册与访问" },
                                    { key: "pages", label: "页面设置" },
                                    { key: "private", label: "后台配置" },
                                    { key: "cloudStorage", label: t("cloud.tab") },
                                    { key: "billingKyc", label: "支付与 KYC" },
                                    { key: "thirdParty", label: "第三方登录" },
                                ]}
                            />
                        )}
                        <Space>
                            <Typography.Text type={saveHint.includes("失败") ? "danger" : "secondary"}>
                                {isSaving ? <LoadingOutlined /> : saveHint === "已保存" ? <CheckCircleOutlined /> : null} {saveHint}
                            </Typography.Text>
                            <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={() => void saveSettings()}>
                                保存当前页
                            </Button>
                            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void loadSettings()}>
                                刷新
                            </Button>
                        </Space>
                    </Flex>
                </Card>

                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap style={{ marginBottom: 16 }}>
                        {activeTab === "public" || activeTab === "private" ? (
                            <Segmented
                                value={activeMode}
                                onChange={(value) => toggleMode(activeTab, value as EditorMode)}
                                options={[
                                    { label: "可视化编辑", value: "visual" },
                                    { label: "手动编辑 JSON", value: "json" },
                                ]}
                            />
                        ) : (
                            <Typography.Text type="secondary">{activeTab === "model" ? "配置模型渠道、开放模型、默认模型和算力点消耗" : activeTab === "mail" ? "SMTP 验证码和邮件模板" : activeTab === "cloudStorage" ? t("cloud.description") : activeTab === "billingKyc" ? "配置 Stripe 私有密钥和 Didit KYC 奖励" : activeTab === "pages" ? "配置前台隐私政策和服务条款内容" : "OAuth、MetaMask 和自定义登录入口"}</Typography.Text>
                        )}
                        {activeMode === "json" ? (
                            <Space>
                                {jsonError ? (
                                    <Tag color="error">{jsonError}</Tag>
                                ) : (
                                    <Tag color="success" icon={<CheckCircleOutlined />}>
                                        JSON 格式正确
                                    </Tag>
                                )}
                                <Button icon={<FormatPainterOutlined />} onClick={() => formatJson(activeTab)}>
                                    格式化
                                </Button>
                            </Space>
                        ) : (
                            <Typography.Text type="secondary">{activeTab === "public" || activeTab === "pages" ? "这些配置会暴露给前端读取" : "这些配置只会在后台保存"}</Typography.Text>
                        )}
                    </Flex>

                    {activeTab === "model" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Flex vertical gap={16}>
                                <Card size="small" title="开放给前台的模型" extra={sectionSaveButton()}>
                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item name={["public", "modelChannel", "availableModels"]} label="系统可用模型" extra="可选项来自已启用渠道中选择的模型，最终开放哪些模型由这里勾选决定。">
                                                <Select mode="multiple" placeholder="请选择系统可用模型" options={channelModels.map((item) => ({ label: item, value: item }))} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["public", "modelChannel", "defaultModel"]} label="默认模型">
                                                <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["public", "modelChannel", "defaultImageModel"]} label="默认图片模型">
                                                <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["public", "modelChannel", "defaultVideoModel"]} label="默认视频模型">
                                                <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["public", "modelChannel", "defaultTextModel"]} label="默认文本模型">
                                                <Select showSearch allowClear options={publicModels.map((item) => ({ label: item, value: item }))} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item name={["public", "modelChannel", "systemPrompt"]} label="系统提示词">
                                                <Input.TextArea rows={4} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                                <Card size="small" title="模型算力点" extra={sectionSaveButton()}>
                                    <Table
                                        rowKey="model"
                                        pagination={false}
                                        size="small"
                                        dataSource={publicModels.map((model) => ({ model, credits: modelCostCredits(modelCosts, model) }))}
                                        columns={[
                                            { title: "模型", dataIndex: "model" },
                                            {
                                                title: "每次调用扣除",
                                                dataIndex: "credits",
                                                width: 220,
                                                render: (_, item) => (
                                                    <InputNumber
                                                        min={0}
                                                        step={1}
                                                        precision={0}
                                                        className="!w-full"
                                                        value={item.credits}
                                                        addonAfter="点"
                                                        onChange={(value) => {
                                                            setModelCost(form, setModelCosts, item.model, Number(value) || 0);
                                                            markUnsaved();
                                                        }}
                                                    />
                                                ),
                                            },
                                        ]}
                                    />
                                </Card>
                                <Card
                                    size="small"
                                    title="模型渠道"
                                    extra={
                                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openChannelDrawer(null)}>
                                            新增渠道
                                        </Button>
                                    }
                                >
                                    <Table
                                        rowKey="_rowKey"
                                        pagination={false}
                                        dataSource={channelTableData}
                                        columns={[
                                            { title: "名称", dataIndex: "name", render: (value) => value || "未命名渠道" },
                                            { title: "协议", dataIndex: "protocol", width: 96, render: (value) => <Tag>{value || "openai"}</Tag> },
                                            { title: "状态", dataIndex: "enabled", width: 96, render: (value) => <Tag color={value ? "success" : "default"}>{value ? "已启用" : "已停用"}</Tag> },
                                            {
                                                title: "模型",
                                                dataIndex: "models",
                                                render: (value: string[]) => (
                                                    <Typography.Text ellipsis style={{ maxWidth: 360 }}>
                                                        {modelSummary(value || [])}
                                                    </Typography.Text>
                                                ),
                                            },
                                            { title: "权重", dataIndex: "weight", width: 88 },
                                            {
                                                title: "操作",
                                                key: "actions",
                                                width: 220,
                                                align: "right",
                                                render: (_, item) => (
                                                    <Space size={4}>
                                                        <Button size="small" onClick={() => openTestDialog(item._index)}>
                                                            测试
                                                        </Button>
                                                        <Button size="small" onClick={() => openChannelDrawer(item._index)}>
                                                            编辑
                                                        </Button>
                                                        <Button
                                                            danger
                                                            size="small"
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => {
                                                                const nextChannels = [...channels];
                                                                nextChannels.splice(item._index, 1);
                                                                void persistChannels(nextChannels);
                                                            }}
                                                        />
                                                    </Space>
                                                ),
                                            },
                                        ]}
                                    />
                                </Card>
                            </Flex>
                        </Form>
                    ) : activeTab === "public" ? (
                        activeMode === "visual" ? (
                            <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                                <Row gutter={16}>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["public", "auth", "allowRegister"]} label="是否允许用户注册" extra="关闭后隐藏注册入口，注册接口也会拒绝新用户创建" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["public", "auth", "emailVerification"]} label="是否开启邮箱验证" extra="开启后，账号密码注册必须填写邮箱验证码" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Card size="small" title="页面访问控制" extra={sectionSaveButton()}>
                                            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                                                开启后，对应页面需要登录才可以访问；关闭则保持公开访问。
                                            </Typography.Paragraph>
                                            <Row gutter={16}>
                                                <Col xs={24} md={8} lg={4}>
                                                    <Form.Item name={["public", "pageAccess", "canvasLoginRequired"]} label="工作流" valuePropName="checked">
                                                        <Switch />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={8} lg={5}>
                                                    <Form.Item name={["public", "pageAccess", "imageLoginRequired"]} label="生图工作台" valuePropName="checked">
                                                        <Switch />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={8} lg={5}>
                                                    <Form.Item name={["public", "pageAccess", "videoLoginRequired"]} label="视频创作台" valuePropName="checked">
                                                        <Switch />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={8} lg={5}>
                                                    <Form.Item name={["public", "pageAccess", "promptsLoginRequired"]} label="提示词库" valuePropName="checked">
                                                        <Switch />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={8} lg={5}>
                                                    <Form.Item name={["public", "pageAccess", "assetsLoginRequired"]} label="我的素材" valuePropName="checked">
                                                        <Switch />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </Card>
                                    </Col>
                                </Row>
                            </Form>
                        ) : (
                            <div style={{ overflow: "hidden", border: "1px solid var(--ant-color-border)", borderRadius: 6 }}>
                                <CodeMirror
                                    value={activeJsonText}
                                    height="520px"
                                    extensions={[json(), jsonEditorTheme]}
                                    basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true }}
                                    theme="none"
                                    onChange={(value) => {
                                        setJsonText((current) => ({ ...current, public: value }));
                                        markUnsaved();
                                    }}
                                    style={{ fontSize: 13 }}
                                />
                            </div>
                        )
                    ) : activeTab === "pages" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={12}>
                                    <Card size="small" title="隐私政策" extra={sectionSaveButton()}>
                                        <Form.Item name={["public", "pages", "privacyTitle"]} label="中文标题">
                                            <Input placeholder="隐私政策" />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "privacyContent"]} label="中文内容" extra="支持直接输入分段文本，前台会按换行保留排版。">
                                            <Input.TextArea rows={10} />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "privacyTitleEn"]} label="英文标题">
                                            <Input placeholder="Privacy Policy" />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "privacyContentEn"]} label="英文内容">
                                            <Input.TextArea rows={10} />
                                        </Form.Item>
                                        <Button
                                            onClick={() => {
                                                form.setFieldValue(["public", "pages", "privacyTitle"], "隐私政策");
                                                form.setFieldValue(["public", "pages", "privacyContent"], defaultPrivacyContent);
                                                form.setFieldValue(["public", "pages", "privacyTitleEn"], "Privacy Policy");
                                                form.setFieldValue(["public", "pages", "privacyContentEn"], defaultPrivacyContentEn);
                                                markUnsaved();
                                            }}
                                        >
                                            恢复默认隐私政策
                                        </Button>
                                    </Card>
                                </Col>
                                <Col xs={24} lg={12}>
                                    <Card size="small" title="服务条款" extra={sectionSaveButton()}>
                                        <Form.Item name={["public", "pages", "termsTitle"]} label="中文标题">
                                            <Input placeholder="服务条款" />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "termsContent"]} label="中文内容" extra="登录和注册页会链接到此页面。">
                                            <Input.TextArea rows={10} />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "termsTitleEn"]} label="英文标题">
                                            <Input placeholder="Terms of Service" />
                                        </Form.Item>
                                        <Form.Item name={["public", "pages", "termsContentEn"]} label="英文内容">
                                            <Input.TextArea rows={10} />
                                        </Form.Item>
                                        <Button
                                            onClick={() => {
                                                form.setFieldValue(["public", "pages", "termsTitle"], "服务条款");
                                                form.setFieldValue(["public", "pages", "termsContent"], defaultTermsContent);
                                                form.setFieldValue(["public", "pages", "termsTitleEn"], "Terms of Service");
                                                form.setFieldValue(["public", "pages", "termsContentEn"], defaultTermsContentEn);
                                                markUnsaved();
                                            }}
                                        >
                                            恢复默认服务条款
                                        </Button>
                                    </Card>
                                </Col>
                            </Row>
                        </Form>
                    ) : activeTab === "cloudStorage" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Card
                                size="small"
                                title={t("cloud.tab")}
                                extra={
                                    <Space>
                                        {sectionSaveButton()}
                                        <Button loading={isTestingCloudStorage} onClick={() => void testCurrentCloudStorage()}>
                                            {t("cloud.test")}
                                        </Button>
                                    </Space>
                                }
                            >
                                <Row gutter={16}>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "storageMode"]} label="存储策略" extra="本地、仅 S3/R2，或优先 S3/R2 失败后自动写入本地。">
                                            <Select
                                                options={[
                                                    { label: "只使用本地存储", value: "local_only" },
                                                    { label: "只使用 S3/R2", value: "s3_only" },
                                                    { label: "优先 S3/R2，失败切本地", value: "s3_with_local_fallback" },
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "provider"]} label={t("cloud.provider")}>
                                            <Select
                                                options={[
                                                    { label: "Cloudflare R2", value: "r2" },
                                                    { label: "S3", value: "s3" },
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "region"]} label={t("cloud.region")}>
                                            <Input placeholder="auto" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["private", "cloudStorage", "endpoint"]} label={t("cloud.endpoint")} extra={t("cloud.endpoint.extra")}>
                                            <Input placeholder="https://<accountid>.r2.cloudflarestorage.com" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["private", "cloudStorage", "publicBaseUrl"]} label={t("cloud.publicBaseUrl")} extra={t("cloud.publicBaseUrl.extra")}>
                                            <Input placeholder="https://cdn.example.com" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "accessKeyId"]} label={t("cloud.accessKeyId")}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "secretAccessKey"]} label={t("cloud.secretAccessKey")} extra={t("cloud.saveHint")}>
                                            <Input.Password placeholder={t("cloud.secretAccessKey.placeholder")} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Form.Item name={["private", "cloudStorage", "bucket"]} label={t("cloud.bucket")} extra={t("cloud.bucket.extra")}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["private", "cloudStorage", "imagePathTemplate"]} label={t("cloud.imagePathTemplate")} extra={t("cloud.imagePathTemplate.extra")}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["private", "cloudStorage", "videoPathTemplate"]} label={t("cloud.videoPathTemplate")} extra={t("cloud.videoPathTemplate.extra")}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item name={["private", "cloudStorage", "model3dPathTemplate"]} label="3D 模型路径模板" extra={t("cloud.videoPathTemplate.extra")}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["private", "cloudStorage", "imageExpireDays"]} label={t("cloud.imageExpireDays")} extra={t("cloud.expire.extra")}>
                                            <InputNumber min={1} max={3650} precision={0} addonAfter="天" className="!w-full" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["private", "cloudStorage", "videoExpireDays"]} label={t("cloud.videoExpireDays")} extra={t("cloud.expire.extra")}>
                                            <InputNumber min={1} max={3650} precision={0} addonAfter="天" className="!w-full" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["private", "cloudStorage", "model3dExpireDays"]} label="3D 模型保存天数" extra={t("cloud.expire.extra")}>
                                            <InputNumber min={1} max={3650} precision={0} addonAfter="天" className="!w-full" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["private", "cloudStorage", "autoCleanupEnabled"]} label={t("cloud.autoCleanup")} extra={t("cloud.autoCleanup.extra")} valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={6}>
                                        <Form.Item name={["private", "cloudStorage", "pathStyleEndpoint"]} label={t("cloud.pathStyle")} extra={t("cloud.pathStyle.extra")} valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        </Form>
                    ) : activeTab === "billingKyc" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={12}>
                                    <Card size="small" title="Stripe 私有配置" extra={sectionSaveButton()}>
                                        <Row gutter={16}>
                                            <Col span={24}>
                                                <Form.Item name={["private", "stripe", "enabled"]} label="启用 Stripe 支付" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "stripe", "secretKey"]} label="Secret Key" extra="后台返回时隐藏；留空保存表示沿用已保存密钥。">
                                                    <Input.Password placeholder="sk_live_..." />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "stripe", "webhookSecret"]} label="Webhook Secret" extra="用于校验 Stripe webhook 签名；留空保存表示沿用已保存密钥。">
                                                    <Input.Password placeholder="whsec_..." />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "stripe", "successUrl"]} label="支付成功跳转地址">
                                                    <Input placeholder="https://example.com/pricing/success?session_id={CHECKOUT_SESSION_ID}" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "stripe", "cancelUrl"]} label="取消支付跳转地址">
                                                    <Input placeholder="https://example.com/pricing" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    </Card>
                                </Col>
                                <Col xs={24} lg={12}>
                                    <Card size="small" title="Didit KYC 配置" extra={sectionSaveButton()}>
                                        <Row gutter={16}>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "kyc", "enabled"]} label="启用 KYC" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "kyc", "rewardOnce"]} label="每个用户只奖励一次" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "kyc", "diditApiKey"]} label="Didit API Key" extra="后台返回时隐藏；留空保存表示沿用已保存密钥。">
                                                    <Input.Password />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "kyc", "diditWebhookSecret"]} label="Didit Webhook Secret" extra="用于校验 Didit webhook 签名；留空保存表示沿用已保存密钥。">
                                                    <Input.Password />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "kyc", "workflowId"]} label="Didit Workflow ID">
                                                    <Input />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item name={["private", "kyc", "callbackUrl"]} label="回调地址">
                                                    <Input placeholder="https://example.com/api/webhooks/didit" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "kyc", "rewardCredits"]} label="通过奖励算力点">
                                                    <InputNumber min={0} className="!w-full" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "kyc", "rewardWorkflowCreateCredits"]} label="通过奖励工作流创建次数">
                                                    <InputNumber min={0} className="!w-full" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    </Card>
                                </Col>
                            </Row>
                        </Form>
                    ) : activeTab === "mail" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={12}>
                                    <Card size="small" title="SMTP 验证码配置" extra={sectionSaveButton()}>
                                        <Row gutter={16}>
                                            <Col xs={24} md={8}>
                                                <Form.Item name={["private", "mail", "enabled"]} label="开启邮件服务" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={16}>
                                                <Form.Item name={["private", "mail", "host"]} label="SMTP Host">
                                                    <Input placeholder="smtp.example.com" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item name={["private", "mail", "port"]} label="端口">
                                                    <InputNumber min={1} max={65535} className="!w-full" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item name={["private", "mail", "codeExpireMin"]} label="有效分钟">
                                                    <InputNumber min={1} max={60} className="!w-full" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "mail", "username"]} label="SMTP 用户名">
                                                    <Input />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "mail", "password"]} label="SMTP 密码">
                                                    <Input.Password placeholder="留空则沿用已保存的密码" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "mail", "fromName"]} label="发件名称">
                                                    <Input placeholder="Aivro" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name={["private", "mail", "fromEmail"]} label="发件邮箱">
                                                    <Input placeholder="noreply@example.com" />
                                                </Form.Item>
                                            </Col>
                                    </Row>
                                        <div style={{ marginTop: 8, borderTop: "1px solid var(--ant-color-border-secondary)", paddingTop: 16 }}>
                                            <Typography.Text strong>测试发送</Typography.Text>
                                            <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                                                <Input value={mailTestEmail} onChange={(event) => setMailTestEmail(event.target.value)} placeholder="填写测试收件邮箱" />
                                                <Button type="primary" icon={<MailOutlined />} loading={isSendingTestMail} onClick={() => void sendTestMail()}>
                                                    发送
                                                </Button>
                                            </Space.Compact>
                                            <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
                                                测试会使用当前表单中的 SMTP 配置和“绑定邮箱注册模板”发送验证码示例 123456。
                                            </Typography.Paragraph>
                                        </div>
                                    </Card>
                                </Col>
                                <Col xs={24} lg={12}>
                                    <Flex vertical gap={12}>
                                        <MailTemplateBlock form={form} name="register" title="绑定邮箱注册模板" onEdit={setEditingMailTemplate} />
                                        <MailTemplateBlock form={form} name="reset" title="找回密码模板" onEdit={setEditingMailTemplate} />
                                        <MailTemplateBlock form={form} name="metamask" title="MetaMask 邮箱验证模板" onEdit={setEditingMailTemplate} />
                                    </Flex>
                                </Col>
                            </Row>
                        </Form>
                    ) : activeTab === "thirdParty" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Row gutter={[16, 16]}>
                                <AuthProviderSummaryCard form={form} title="Linux.do 登录" iconUrl="/icons/linuxdo.svg" users={authProviderStats["linux-do"] || 0} publicEnabledPath={["public", "auth", "linuxDo", "enabled"]} privateEnabledPath={["private", "auth", "linuxDo", "enabled"]} onEdit={() => openAuthProviderEditor({ type: "oauth", providerKey: "linuxDo" })} />
                                <AuthProviderSummaryCard form={form} title="Google 登录" iconUrl="/icons/google.svg" users={authProviderStats.google || 0} publicEnabledPath={["public", "auth", "google", "enabled"]} privateEnabledPath={["private", "auth", "google", "enabled"]} onEdit={() => openAuthProviderEditor({ type: "oauth", providerKey: "google" })} />
                                <AuthProviderSummaryCard form={form} title="GitHub 登录" iconUrl="/icons/github.svg" users={authProviderStats.github || 0} publicEnabledPath={["public", "auth", "github", "enabled"]} privateEnabledPath={["private", "auth", "github", "enabled"]} onEdit={() => openAuthProviderEditor({ type: "oauth", providerKey: "github" })} />
                                <AuthProviderSummaryCard form={form} title="MetaMask 登录" iconUrl="/icons/metamask.svg" users={authProviderStats.metamask || 0} publicEnabledPath={["public", "auth", "metamask", "enabled"]} privateEnabledPath={["private", "auth", "metamask", "enabled"]} onEdit={() => openAuthProviderEditor({ type: "metamask" })} />
                                {customAuthProviders.map((provider: AdminPrivateAuthProvider, index: number) => (
                                    <AuthProviderSummaryCard key={`${provider.id}-${index}`} form={form} title={provider.name || `自定义登录 ${index + 1}`} iconUrl={provider.iconUrl} users={authProviderStats[provider.id] || 0} publicEnabledPath={["public", "auth", "customProviders", index, "enabled"]} privateEnabledPath={["private", "auth", "customProviders", index, "enabled"]} onEdit={() => openAuthProviderEditor({ type: "custom", index })} />
                                ))}
                                <Col xs={24} md={12} xl={8}>
                                    <Button block type="dashed" icon={<PlusOutlined />} style={{ height: 128 }} onClick={addCustomAuthProvider}>
                                        新建第三方登录
                                    </Button>
                                </Col>
                            </Row>
                            <OAuthProviderEditorModal form={form} state={editingAuthProvider} snapshot={authProviderSnapshotRef.current} currentOrigin={currentOrigin} onClose={closeAuthProviderEditor} onSave={() => void saveSettings()} />
                        </Form>
                    ) : activeMode === "visual" ? (
                        <Form form={form} layout="vertical" initialValues={emptySettings} requiredMark={false} onValuesChange={handleFormValuesChange}>
                            <Flex vertical gap={12}>
                                <Card size="small" title="提示词定时同步" extra={sectionSaveButton()}>
                                    <Row gutter={16} align="middle">
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "promptSync", "enabled"]} label="开启定时同步" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={16}>
                                            <Form.Item name={["private", "promptSync", "cron"]} label="Cron 表达式" extra="默认每 5 分钟同步内置 GitHub 远程提示词源">
                                                <Input placeholder="*/5 * * * *" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                                <Card size="small" title="AI 队列 / 按模型限流" extra={sectionSaveButton()}>
                                    <Row gutter={16}>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["private", "aiQueue", "enabled"]} label="启用队列" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["private", "aiQueue", "defaultPerMinute"]} label="默认每分钟请求数">
                                                <InputNumber min={1} style={{ width: "100%" }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["private", "aiQueue", "maxQueuedPerUser"]} label="单用户最大排队数">
                                                <InputNumber min={1} style={{ width: "100%" }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={6}>
                                            <Form.Item name={["private", "aiQueue", "taskRetentionHours"]} label="任务保留小时">
                                                <InputNumber min={1} style={{ width: "100%" }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Form.Item name={["private", "aiQueue", "backend"]} label="队列后端" extra="第一版固定使用 database；Redis 为后续 PostgreSQL/MySQL 多实例加速预留。">
                                        <Segmented options={[{ label: "Database", value: "database" }, { label: "Redis（预留）", value: "redis", disabled: true }]} />
                                    </Form.Item>
                                    <Form.List name={["private", "aiQueue", "modelPerMinute"]}>
                                        {(fields, { add, remove }) => (
                                            <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                                <Flex justify="space-between" align="center">
                                                    <Typography.Text strong>模型单独限流</Typography.Text>
                                                    <Button size="small" onClick={() => add({ model: "", perMinute: 50 })}>新增模型限流</Button>
                                                </Flex>
                                                {fields.map((field) => (
                                                    <Row key={field.key} gutter={8} align="middle">
                                                        <Col xs={24} md={14}>
                                                            <Form.Item {...field} name={[field.name, "model"]} label="模型" rules={[{ required: true, message: "请输入模型名称" }]}>
                                                                <Select showSearch allowClear options={channelModels.map((item) => ({ label: item, value: item }))} placeholder="选择或输入模型" />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={18} md={8}>
                                                            <Form.Item {...field} name={[field.name, "perMinute"]} label="每分钟请求数">
                                                                <InputNumber min={1} style={{ width: "100%" }} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={6} md={2}>
                                                            <Button danger onClick={() => remove(field.name)}>删除</Button>
                                                        </Col>
                                                    </Row>
                                                ))}
                                            </Space>
                                        )}
                                    </Form.List>
                                </Card>
                                <Card size="small" title="Cloudflare Turnstile" extra={sectionSaveButton()}>
                                    <Row gutter={16}>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "turnstile", "enabled"]} label="启用人机验证" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "turnstile", "siteKey"]} label="Site Key" extra="启用后会通过公开设置下发给前端。">
                                                <Input placeholder="0x..." />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name={["private", "turnstile", "secretKey"]} label="Secret Key" extra="后台返回时隐藏；留空保存表示沿用已保存密钥。">
                                                <Input.Password placeholder="0x..." />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            </Flex>
                        </Form>
                    ) : (
                        <div style={{ overflow: "hidden", border: "1px solid var(--ant-color-border)", borderRadius: 6 }}>
                            <CodeMirror
                                value={activeJsonText}
                                height="520px"
                                extensions={[json(), jsonEditorTheme]}
                                basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true }}
                                theme="none"
                                onChange={(value) => {
                                    setJsonText((current) => ({ ...current, private: value }));
                                    markUnsaved();
                                }}
                                style={{ fontSize: 13 }}
                            />
                        </div>
                    )}
                </Card>
                <MailTemplateEditorModal form={form} name={editingMailTemplate} onClose={() => setEditingMailTemplate(null)} onSave={() => void saveSettings()} />
                <Drawer
                    title={editingChannelIndex === null ? "新增渠道" : "编辑渠道"}
                    open={isChannelDrawerOpen}
                    size={560}
                    onClose={closeChannelDrawer}
                    extra={
                        <Space>
                            <Button onClick={closeChannelDrawer}>取消</Button>
                            <Button type="primary" onClick={() => void saveChannel()}>
                                保存
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Form form={channelForm} layout="vertical" requiredMark={false} initialValues={emptyChannel}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: "请输入渠道名称" }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="protocol" label="协议">
                                    <Select options={[{ label: "OpenAI", value: "openai" }]} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="weight" label="权重">
                                    <InputNumber min={1} step={1} className="!w-full" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="enabled" label="启用" valuePropName="checked">
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="baseUrl" label="接口地址" rules={[{ required: true, message: "请输入接口地址" }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="apiKey" label="API Key" rules={editingChannelIndex === null ? [{ required: true, message: "请输入 API Key" }] : []}>
                                    <Input.Password placeholder={editingChannelIndex === null ? "" : "留空则沿用已保存的 API Key"} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item label="渠道可用模型">
                                    <Space.Compact style={{ width: "100%" }}>
                                        <Form.Item name="models" noStyle>
                                            <Select mode="tags" maxTagCount="responsive" tokenSeparators={[",", "\n"]} options={knownModels.map((model) => ({ label: model, value: model }))} />
                                        </Form.Item>
                                        <Button onClick={() => openChannelModelSelector()}>选择模型</Button>
                                    </Space.Compact>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="remark" label="备注">
                                    <Input.TextArea rows={3} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Drawer>
                <Modal
                    title={
                        <Space size={12}>
                            选择渠道模型
                            <Typography.Text type="secondary">
                                已选择 {modelSelectSelected.length} / {uniqueModels([...modelSelectSource, ...modelSelectExisting]).length}
                            </Typography.Text>
                        </Space>
                    }
                    open={isModelSelectorOpen}
                    width={960}
                    onCancel={closeChannelModelSelector}
                    footer={
                        <Space>
                            <Button onClick={closeChannelModelSelector}>取消</Button>
                            <Button type="primary" onClick={confirmChannelModelSelector}>
                                保存
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Flex vertical gap={14}>
                        <Flex gap={12} wrap>
                            <Input.Search placeholder="搜索模型" allowClear value={modelSelectKeyword} onChange={(event) => setModelSelectKeyword(event.target.value)} style={{ flex: "1 1 260px" }} />
                            <Space.Compact style={{ flex: "1 1 320px" }}>
                                <Input value={modelSelectNewModel} placeholder="输入模型名称" onChange={(event) => setModelSelectNewModel(event.target.value)} onPressEnter={addModelInSelector} />
                                <Button onClick={addModelInSelector}>增加模型</Button>
                                <Button icon={<ReloadOutlined />} loading={isFetchingChannelModels} onClick={() => void fetchChannelModelList()}>
                                    拉取模型列表
                                </Button>
                            </Space.Compact>
                        </Flex>
                        <Tabs
                            activeKey={modelSelectTab}
                            onChange={(key) => setModelSelectTab(key as ModelSelectTabKey)}
                            items={[
                                { key: "new", label: `新获取的模型 (${modelSelectGroups.new.length})` },
                                { key: "current", label: `已有的模型 (${modelSelectGroups.current.length})` },
                            ]}
                        />
                        <Flex justify="space-between" align="center" gap={12} wrap>
                            <Typography.Text type="secondary">
                                当前列表已选择 {activeSelectedCount} / {activeModelSelectModels.length}
                            </Typography.Text>
                            <Space size={8}>
                                <Button size="small" disabled={!activeModelSelectModels.length || activeSelectedCount === activeModelSelectModels.length} onClick={selectActiveModels}>
                                    全选当前列表
                                </Button>
                                <Button size="small" disabled={!activeSelectedCount} onClick={clearActiveModels}>
                                    取消当前列表
                                </Button>
                            </Space>
                        </Flex>
                        <div style={{ maxHeight: 420, overflowY: "auto", borderTop: "1px solid var(--ant-color-border-secondary)", paddingTop: 12 }}>
                            {activeModelSelectModels.length ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 24, rowGap: 12 }}>
                                    {activeModelSelectModels.map((model) => (
                                        <Checkbox key={model} checked={modelSelectSelected.includes(model)} onChange={(event) => toggleSelectedModel(model, event.target.checked)}>
                                            <Typography.Text style={{ wordBreak: "break-all" }}>{model}</Typography.Text>
                                        </Checkbox>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: "48px 0", textAlign: "center" }}>
                                    <Typography.Text type="secondary">没有匹配的模型</Typography.Text>
                                </div>
                            )}
                        </div>
                    </Flex>
                </Modal>
                <Modal
                    title={
                        <Space>
                            {testChannel?.name || "渠道"} 渠道的模型测试<Typography.Text type="secondary">共 {testChannel?.models.length || 0} 个模型</Typography.Text>
                        </Space>
                    }
                    open={testChannelIndex !== null}
                    width={920}
                    onCancel={closeTestDialog}
                    footer={
                        <Space>
                            <Button onClick={closeTestDialog}>取消</Button>
                            <Button type="primary" disabled={!selectedTestModels.length || testingModels.length > 0} onClick={() => void batchTestModels()}>
                                批量测试 {selectedTestModels.length} 个模型
                            </Button>
                        </Space>
                    }
                    destroyOnHidden
                >
                    <Flex vertical gap={12}>
                        <Typography.Text type="secondary">测试会向选中模型发送一条 hi，用于确认渠道是否有响应。</Typography.Text>
                        <Input.Search placeholder="搜索模型..." allowClear value={testKeyword} onChange={(event) => setTestKeyword(event.target.value)} />
                        <Table
                            rowKey="model"
                            pagination={false}
                            scroll={{ y: 420 }}
                            dataSource={testModels.map((model) => ({ model }))}
                            rowSelection={{
                                selectedRowKeys: selectedTestModels,
                                onChange: (keys) => setSelectedTestModels(keys.map(String)),
                            }}
                            columns={[
                                { title: "模型名称", dataIndex: "model", render: (value) => <Typography.Text strong>{value}</Typography.Text> },
                                {
                                    title: "状态",
                                    dataIndex: "model",
                                    width: 260,
                                    render: (value) => {
                                        if (testingModels.includes(value)) return <Tag icon={<LoadingOutlined className="animate-spin" />}>测试中</Tag>;
                                        const result = testResults[value];
                                        if (!result) return <Tag>未开始</Tag>;
                                        return result.status === "success" ? (
                                            <Space size={6} wrap>
                                                <Tag color="success">成功</Tag>
                                                <Typography.Text type="secondary">请求时长: {result.duration}</Typography.Text>
                                            </Space>
                                        ) : (
                                            <Typography.Text type="danger">{result.message}</Typography.Text>
                                        );
                                    },
                                },
                                {
                                    title: "操作",
                                    key: "actions",
                                    width: 120,
                                    align: "right",
                                    render: (_, item) => (
                                        <Button size="small" loading={testingModels.includes(item.model)} onClick={() => void testModelOnline(item.model)}>
                                            测试
                                        </Button>
                                    ),
                                },
                            ]}
                        />
                    </Flex>
                </Modal>
            </Flex>
        </main>
    );
}

function MailTemplateBlock({ form, name, title, onEdit }: { form: any; name: MailTemplateKey; title: string; onEdit: (name: MailTemplateKey) => void }) {
    const subject = Form.useWatch(["private", "mail", "templates", name, "subject"], form) || "";
    const body = Form.useWatch(["private", "mail", "templates", name, "body"], form) || "";
    const expireMinutes = Form.useWatch(["private", "mail", "codeExpireMin"], form) || 10;
    return (
        <Card
            size="small"
            title={title}
            extra={
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(name)}>
                    编辑模板
                </Button>
            }
        >
            <Flex vertical gap={8}>
                <Typography.Text strong ellipsis>
                    {subject || "未配置标题"}
                </Typography.Text>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                    {body || "未配置正文模板"}
                </Typography.Paragraph>
                <Space size={[6, 6]} wrap>
                    {mailTemplateVariables.map((item) => (
                        <Tag key={item}>{item}</Tag>
                    ))}
                </Space>
                <Typography.Text type="secondary">当前预览验证码有效期：{expireMinutes} 分钟</Typography.Text>
            </Flex>
        </Card>
    );
}

function MailTemplateEditorModal({ form, name, onClose, onSave }: { form: any; name: MailTemplateKey | null; onClose: () => void; onSave: () => void }) {
    const activeName = name || "register";
    const title = mailTemplateTitles[activeName];
    const expireMinutes = Form.useWatch(["private", "mail", "codeExpireMin"], form) || 10;
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const preview = renderTemplatePreview(`${subject}\n\n${body}`, expireMinutes);
    useEffect(() => {
        if (!name) return;
        setSubject(form.getFieldValue(["private", "mail", "templates", activeName, "subject"]) || "");
        setBody(form.getFieldValue(["private", "mail", "templates", activeName, "body"]) || "");
    }, [activeName, form, name]);
    const setTemplateField = (field: "subject" | "body", value: string) => {
        if (field === "subject") setSubject(value);
        else setBody(value);
    };
    const saveTemplate = () => {
        form.setFieldValue(["private", "mail", "templates", activeName, "subject"], subject);
        form.setFieldValue(["private", "mail", "templates", activeName, "body"], body);
        onClose();
        onSave();
    };
    return (
        <Modal
            title={title}
            open={!!name}
            width={1120}
            onCancel={onClose}
            footer={
                <Space>
                    <Button onClick={onClose}>取消</Button>
                    <Button type="primary" onClick={saveTemplate}>
                        保存
                    </Button>
                </Space>
            }
            destroyOnHidden
        >
            <Row gutter={16}>
                <Col xs={24} lg={12}>
                    <Flex vertical gap={12}>
                        <div>
                            <Typography.Text strong>标题</Typography.Text>
                            <Input value={subject} onChange={(event) => setTemplateField("subject", event.target.value)} style={{ marginTop: 8 }} />
                        </div>
                        <div>
                            <Typography.Text strong>正文模板</Typography.Text>
                            <Input.TextArea value={body} onChange={(event) => setTemplateField("body", event.target.value)} rows={17} style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }} />
                        </div>
                        <Typography.Text type="secondary">可用变量：{mailTemplateVariables.join("、")}</Typography.Text>
                    </Flex>
                </Col>
                <Col xs={24} lg={12}>
                    <Typography.Text strong>实时预览</Typography.Text>
                    <pre style={{ marginTop: 8, minHeight: 468, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--ant-color-border)", borderRadius: 6, padding: 12, background: "var(--ant-color-fill-quaternary)" }}>{preview}</pre>
                </Col>
            </Row>
        </Modal>
    );
}

const mailTemplateTitles: Record<MailTemplateKey, string> = {
    register: "绑定邮箱注册模板",
    reset: "找回密码模板",
    metamask: "MetaMask 邮箱验证模板",
};

const mailTemplateVariables = ["{{code}}", "{{email}}", "{{expireMinutes}}", "{{siteName}}", "{{ip}}", "{{country}}", "{{region}}"];

function AuthProviderSummaryCard({ form, title, iconUrl, users, publicEnabledPath, privateEnabledPath, onEdit }: { form: any; title: string; iconUrl?: string; users: number; publicEnabledPath: (string | number)[]; privateEnabledPath?: (string | number)[]; onEdit: () => void }) {
    const publicEnabled = Form.useWatch(publicEnabledPath, form);
    const privateEnabled = Form.useWatch(privateEnabledPath || publicEnabledPath, form);
    const ready = publicEnabled && privateEnabled;
    return (
        <Col xs={24} md={12} xl={8}>
            <Card
                size="small"
                title={<ProviderTitle title={title} iconUrl={iconUrl} />}
                extra={
                    <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
                        编辑
                    </Button>
                }
            >
                <Flex vertical gap={12}>
                    <Space>
                        <Tag color={ready ? "success" : "default"}>{ready ? "已开启" : "未开启"}</Tag>
                        <Tag color={publicEnabled ? "processing" : "default"}>前台{publicEnabled ? "显示" : "隐藏"}</Tag>
                        {privateEnabledPath ? <Tag color={privateEnabled ? "processing" : "default"}>服务端{privateEnabled ? "启用" : "未启用"}</Tag> : null}
                        <Typography.Text type="secondary">使用人数：{users}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">登录页展示以前台显示为准；保存时会同步内置登录的服务端启用状态。</Typography.Text>
                </Flex>
            </Card>
        </Col>
    );
}

function OAuthProviderEditorModal({ form, state, snapshot, currentOrigin, onClose, onSave }: { form: any; state: AuthProviderEditorState | null; snapshot: AdminSettings | null; currentOrigin: string; onClose: () => void; onSave: () => void }) {
    const title = authProviderEditorTitle(form, state);
    const cancel = () => {
        if (snapshot) form.setFieldsValue(snapshot);
        onClose();
    };
    const save = () => {
        onClose();
        onSave();
    };
    const removeCustomProvider = () => {
        if (!state || state.type !== "custom") return;
        const current = [...((form.getFieldValue(["private", "auth", "customProviders"]) || []) as AdminPrivateAuthProvider[])];
        current.splice(state.index, 1);
        form.setFieldValue(["private", "auth", "customProviders"], current);
        onClose();
        onSave();
    };
    return (
        <Modal
            title={title}
            open={!!state}
            width={980}
            onCancel={cancel}
            footer={
                <Flex justify="space-between" gap={12}>
                    <div>{state?.type === "custom" ? <Button danger onClick={removeCustomProvider}>删除</Button> : null}</div>
                    <Space>
                        <Button onClick={cancel}>取消</Button>
                        <Button type="primary" onClick={save}>
                            保存
                        </Button>
                    </Space>
                </Flex>
            }
            destroyOnHidden
        >
            {state?.type === "oauth" ? <OAuthProviderFields providerKey={state.providerKey} currentOrigin={currentOrigin} /> : null}
            {state?.type === "metamask" ? <MetaMaskProviderFields /> : null}
            {state?.type === "custom" ? <CustomProviderFields index={state.index} /> : null}
        </Modal>
    );
}

function OAuthProviderFields({ providerKey, currentOrigin }: { providerKey: "linuxDo" | "google" | "github"; currentOrigin: string }) {
    const providerId = { linuxDo: "linux-do", google: "google", github: "github" }[providerKey];
    const callbackPath = providerKey === "linuxDo" ? "/api/auth/linux-do/callback" : `/api/auth/oauth/${providerId}/callback`;
    const callbackUrl = currentOrigin ? `${currentOrigin}${callbackPath}` : `当前站点域名${callbackPath}`;
    return (
        <Row gutter={16}>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", providerKey, "enabled"]} label="前台显示" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["private", "auth", providerKey, "enabled"]} label="启用服务端" extra="保存内置登录时会跟随前台显示同步，避免前台已开启但服务端仍未开启。" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", providerKey, "name"]} label="显示名称">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", providerKey, "iconUrl"]} label="图片地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "clientId"]} label="Client ID">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "clientSecret"]} label="Client Secret">
                    <Input.Password placeholder="留空则沿用已保存的密钥" />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "authorizeUrl"]} label="授权地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "tokenUrl"]} label="Token 地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "userInfoUrl"]} label="用户信息地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={["private", "auth", providerKey, "scope"]} label="Scope">
                    <Input />
                </Form.Item>
            </Col>
            <Col span={24}>
                <Flex vertical gap={6}>
                    <Typography.Text type="secondary">授权回调地址必须与浏览器实际访问域名、协议和路径完全一致。</Typography.Text>
                    <Typography.Text copyable code>
                        {callbackUrl}
                    </Typography.Text>
                    {providerKey === "google" ? <Typography.Text type="secondary">Google 控制台的 Authorized redirect URI 请填写上面这一整行。</Typography.Text> : null}
                </Flex>
            </Col>
        </Row>
    );
}

function MetaMaskProviderFields() {
    return (
        <Row gutter={16}>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", "metamask", "enabled"]} label="前台显示" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["private", "auth", "metamask", "enabled"]} label="启用服务端" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", "metamask", "name"]} label="显示名称">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={["public", "auth", "metamask", "iconUrl"]} label="图片地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={8}>
                <Form.Item name={["private", "auth", "metamask", "siteName"]} label="签名网站名称" extra="会展示在 MetaMask 签名弹窗的第一行。">
                    <Input placeholder="Aivro" />
                </Form.Item>
            </Col>
            <Col xs={24} md={8}>
                <Form.Item name={["private", "auth", "metamask", "siteUrl"]} label="签名网站 URL">
                    <Input placeholder="https://example.com" />
                </Form.Item>
            </Col>
            <Col xs={24} md={8}>
                <Form.Item name={["private", "auth", "metamask", "signatureLogoUrl"]} label="签名 Logo URL">
                    <Input placeholder="/logo.svg" />
                </Form.Item>
            </Col>
            <Col span={24}>
                <Typography.Text type="secondary">首次 MetaMask 签名后会跳转到单独邮箱验证页面，验证完成后记录钱包地址用于后续签名登录。</Typography.Text>
            </Col>
        </Row>
    );
}

function CustomProviderFields({ index }: { index: number }) {
    const base = ["private", "auth", "customProviders", index];
    return (
        <Row gutter={16}>
            <Col xs={24} md={6}>
                <Form.Item name={[...base, "enabled"]} label="启用" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={[...base, "id"]} label="ID">
                    <Input placeholder="o2" />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={[...base, "name"]} label="显示名称">
                    <Input placeholder="O2" />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item name={[...base, "iconUrl"]} label="图片地址">
                    <Input placeholder="https://..." />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "clientId"]} label="Client ID">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "clientSecret"]} label="Client Secret">
                    <Input.Password placeholder="留空则沿用已保存的密钥" />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "authorizeUrl"]} label="授权地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "tokenUrl"]} label="Token 地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "userInfoUrl"]} label="用户信息地址">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item name={[...base, "scope"]} label="Scope">
                    <Input />
                </Form.Item>
            </Col>
        </Row>
    );
}

function authProviderEditorTitle(form: any, state: AuthProviderEditorState | null) {
    if (!state) return "第三方登录";
    if (state.type === "metamask") return "MetaMask 登录";
    if (state.type === "oauth") {
        return ({ linuxDo: "Linux.do 登录", google: "Google 登录", github: "GitHub 登录" } as const)[state.providerKey];
    }
    return form.getFieldValue(["private", "auth", "customProviders", state.index, "name"]) || `自定义登录 ${state.index + 1}`;
}

function ProviderTitle({ title, iconUrl }: { title: string; iconUrl?: string }) {
    return (
        <Space>
            {iconUrl ? <img src={iconUrl} alt="" width={18} height={18} /> : null}
            {title}
        </Space>
    );
}

function renderTemplatePreview(template: string, expireMinutes: number) {
    return template
        .replaceAll("{{code}}", "123456")
        .replaceAll("{{email}}", "user@example.com")
        .replaceAll("{{expireMinutes}}", String(expireMinutes))
        .replaceAll("{{siteName}}", "Aivro")
        .replaceAll("{{ip}}", "203.0.113.8")
        .replaceAll("{{country}}", "CN")
        .replaceAll("{{region}}", "Shanghai");
}

function normalizeSettingsTab(tab: string | null): SettingsTabKey {
    if (tab === "model" || tab === "private" || tab === "mail" || tab === "thirdParty" || tab === "cloudStorage" || tab === "billingKyc" || tab === "pages") return tab;
    return "public";
}

function normalizeSettings(settings: Partial<AdminSettings> = {}): AdminSettings {
    const privateSetting = normalizePrivateSetting(settings.private);
    const publicSetting = normalizePublicSetting(settings.public);
    publicSetting.auth.customProviders = privateSetting.auth.customProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        iconUrl: provider.iconUrl,
        enabled: provider.enabled,
    }));
    publicSetting.auth.metamask.siteName = privateSetting.auth.metamask.siteName;
    publicSetting.auth.metamask.siteUrl = privateSetting.auth.metamask.siteUrl;
    publicSetting.auth.metamask.signatureLogoUrl = privateSetting.auth.metamask.signatureLogoUrl;
    return {
        public: publicSetting,
        private: privateSetting,
    };
}

function normalizePublicSetting(setting: Partial<AdminSettings["public"]> = {}): AdminSettings["public"] {
    const modelChannel = (setting.modelChannel || {}) as Partial<AdminSettings["public"]["modelChannel"]>;
    return {
        ...emptySettings.public,
        modelChannel: {
            ...emptySettings.public.modelChannel,
            availableModels: modelChannel.availableModels || [],
            modelCosts: normalizeModelCosts(modelChannel.modelCosts || []),
            defaultModel: modelChannel.defaultModel || "",
            defaultImageModel: modelChannel.defaultImageModel || "",
            defaultVideoModel: modelChannel.defaultVideoModel || "",
            defaultTextModel: modelChannel.defaultTextModel || "",
            systemPrompt: modelChannel.systemPrompt || "",
        },
        auth: {
            allowRegister: setting.auth?.allowRegister !== false,
            emailVerification: setting.auth?.emailVerification === true,
            turnstileSiteKey: setting.auth?.turnstileSiteKey || "",
            linuxDo: normalizePublicProvider(setting.auth?.linuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: normalizePublicProvider(setting.auth?.google, "google", "Google", "/icons/google.svg"),
            github: normalizePublicProvider(setting.auth?.github, "github", "GitHub", "/icons/github.svg"),
            metamask: normalizePublicProvider(setting.auth?.metamask, "metamask", "MetaMask", "/icons/metamask.svg"),
            customProviders: (setting.auth?.customProviders?.length ? setting.auth.customProviders : [emptyPublicProvider("o2", "O2")]).map((item) => normalizePublicProvider(item, item.id || "o2", item.name || "O2")),
        },
        pages: normalizePublicPagesSetting(setting.pages),
        pageAccess: normalizePublicPageAccessSetting(setting.pageAccess),
        adSense: normalizeAdSenseSetting(setting.adSense),
    };
}

function normalizePublicPageAccessSetting(setting: Partial<AdminSettings["public"]["pageAccess"]> = {}): AdminSettings["public"]["pageAccess"] {
    return {
        canvasLoginRequired: setting.canvasLoginRequired === true,
        imageLoginRequired: setting.imageLoginRequired === true,
        videoLoginRequired: setting.videoLoginRequired === true,
        promptsLoginRequired: setting.promptsLoginRequired === true,
        assetsLoginRequired: setting.assetsLoginRequired === true,
    };
}

function normalizePublicPagesSetting(setting: Partial<AdminSettings["public"]["pages"]> = {}): AdminSettings["public"]["pages"] {
    return {
        privacyTitle: setting.privacyTitle || "隐私政策",
        privacyContent: setting.privacyContent || defaultPrivacyContent,
        privacyTitleEn: setting.privacyTitleEn || "Privacy Policy",
        privacyContentEn: setting.privacyContentEn || defaultPrivacyContentEn,
        termsTitle: setting.termsTitle || "服务条款",
        termsContent: setting.termsContent || defaultTermsContent,
        termsTitleEn: setting.termsTitleEn || "Terms of Service",
        termsContentEn: setting.termsContentEn || defaultTermsContentEn,
    };
}

function normalizeAdSenseSetting(setting: Partial<AdminSettings["public"]["adSense"]> = {}): AdminSettings["public"]["adSense"] {
    const pages = {
        ...emptySettings.public.adSense.pages,
        ...(setting.pages || {}),
    };
    if (!setting.enabled && !setting.code && !Object.values(pages).some(Boolean)) {
        Object.assign(pages, emptySettings.public.adSense.pages);
    }
    return {
        ...emptySettings.public.adSense,
        enabled: setting.enabled === true,
        code: setting.code || "",
        adsTxt: setting.adsTxt || "",
        pages,
    };
}

function normalizeModelCosts(items: Partial<AdminSettings["public"]["modelChannel"]["modelCosts"][number]>[]) {
    return items.filter((item) => item.model).map((item) => ({ model: item.model || "", credits: Math.max(0, Number(item.credits) || 0) }));
}

function normalizePrivateSetting(setting: Partial<AdminSettings["private"]> = {}): AdminSettings["private"] {
    return {
        channels: (setting.channels || []).map(normalizeChannel),
        promptSync: {
            enabled: setting.promptSync?.enabled !== false,
            cron: setting.promptSync?.cron || "*/5 * * * *",
        },
        aiQueue: {
            ...emptySettings.private.aiQueue,
            ...(setting.aiQueue || {}),
            enabled: setting.aiQueue?.enabled !== false,
            backend: "database",
            redisUrl: setting.aiQueue?.redisUrl || "",
            defaultPerMinute: Math.max(1, Number(setting.aiQueue?.defaultPerMinute) || 50),
            modelPerMinute: (setting.aiQueue?.modelPerMinute || [])
                .filter((item) => item.model?.trim())
                .map((item) => ({ model: item.model.trim(), perMinute: Math.max(1, Number(item.perMinute) || 50) })),
            maxQueuedPerUser: Math.max(1, Number(setting.aiQueue?.maxQueuedPerUser) || 20),
            taskRetentionHours: Math.max(1, Number(setting.aiQueue?.taskRetentionHours) || 24),
        },
        turnstile: {
            ...emptySettings.private.turnstile,
            ...(setting.turnstile || {}),
            enabled: setting.turnstile?.enabled === true,
            siteKey: setting.turnstile?.siteKey || "",
            secretKey: setting.turnstile?.secretKey || "",
        },
        auth: {
            linuxDo: normalizePrivateProvider(setting.auth?.linuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg"),
            google: normalizePrivateProvider(setting.auth?.google, "google", "Google", "/icons/google.svg"),
            github: normalizePrivateProvider(setting.auth?.github, "github", "GitHub", "/icons/github.svg"),
            metamask: normalizeMetaMaskSetting(setting.auth?.metamask),
            customProviders: (setting.auth?.customProviders?.length ? setting.auth.customProviders : [emptyPrivateProvider("o2", "O2")]).map((item) => normalizePrivateProvider(item, item.id || "o2", item.name || "O2")),
        },
        mail: {
            ...emptySettings.private.mail,
            ...(setting.mail || {}),
            templates: {
                register: { ...emptySettings.private.mail.templates.register, ...(setting.mail?.templates?.register || {}) },
                reset: { ...emptySettings.private.mail.templates.reset, ...(setting.mail?.templates?.reset || {}) },
                metamask: { ...emptySettings.private.mail.templates.metamask, ...(setting.mail?.templates?.metamask || {}) },
            },
        },
        cloudStorage: normalizeCloudStorageSetting(setting.cloudStorage),
        stripe: {
            ...emptySettings.private.stripe,
            ...(setting.stripe || {}),
        },
        kyc: {
            ...emptySettings.private.kyc,
            ...(setting.kyc || {}),
            provider: "didit",
            rewardCredits: Math.max(0, Number(setting.kyc?.rewardCredits) || 0),
            rewardWorkflowCreateCredits: Math.max(0, Number(setting.kyc?.rewardWorkflowCreateCredits) || 0),
            rewardOnce: setting.kyc?.rewardOnce !== false,
        },
    };
}

function normalizeCloudStorageSetting(setting: Partial<AdminCloudStorageSettings> = {}): AdminCloudStorageSettings {
    const storageMode = setting.storageMode === "s3_only" || setting.storageMode === "s3_with_local_fallback" || setting.storageMode === "local_only" ? setting.storageMode : setting.enabled ? "s3_only" : "local_only";
    return {
        ...emptySettings.private.cloudStorage,
        ...setting,
        enabled: storageMode !== "local_only",
        storageMode,
        provider: setting.provider === "s3" ? "s3" : "r2",
        endpoint: setting.endpoint || "",
        region: setting.region || "auto",
        accessKeyId: setting.accessKeyId || "",
        secretAccessKey: setting.secretAccessKey || "",
        bucket: setting.bucket || "",
        publicBaseUrl: setting.publicBaseUrl || "",
        imagePathTemplate: setting.imagePathTemplate || "{username}/images/{yyyy}/{mm}/{dd}/{filename}",
        videoPathTemplate: setting.videoPathTemplate || "{username}/videos/{yyyy}/{mm}/{dd}/{filename}",
        model3dPathTemplate: setting.model3dPathTemplate || "{username}/models/{yyyy}/{mm}/{dd}/{filename}",
        imageExpireDays: Math.max(1, Number(setting.imageExpireDays) || 7),
        videoExpireDays: Math.max(1, Number(setting.videoExpireDays) || 7),
        model3dExpireDays: Math.max(1, Number(setting.model3dExpireDays) || 7),
        autoCleanupEnabled: setting.autoCleanupEnabled !== false,
        pathStyleEndpoint: setting.pathStyleEndpoint !== false,
    };
}

function normalizePublicProvider(item: Partial<AdminPublicAuthProvider> = {}, id: string, name: string, iconUrl = ""): AdminPublicAuthProvider {
    return { id: item.id || id, name: item.name || name, iconUrl: item.iconUrl || iconUrl, enabled: item.enabled === true, siteName: item.siteName, siteUrl: item.siteUrl, signatureLogoUrl: item.signatureLogoUrl };
}

function normalizePrivateProvider(item: Partial<AdminPrivateAuthProvider> = {}, id: string, name: string, iconUrl = ""): AdminPrivateAuthProvider {
    return { ...emptyPrivateProvider(id, name, iconUrl), ...item, id: item.id || id, name: item.name || name, iconUrl: item.iconUrl || iconUrl, enabled: item.enabled === true };
}

function normalizeMetaMaskSetting(item: Partial<AdminSettings["private"]["auth"]["metamask"]> = {}): AdminSettings["private"]["auth"]["metamask"] {
    return {
        enabled: item.enabled === true,
        siteName: item.siteName || "Aivro",
        siteUrl: item.siteUrl || "",
        signatureLogoUrl: item.signatureLogoUrl || "/icons/metamask.svg",
    };
}

function normalizeChannel(item: Partial<AdminModelChannel> = {}): AdminModelChannel {
    return {
        protocol: "openai",
        name: item.name || "",
        baseUrl: item.baseUrl || "",
        apiKey: item.apiKey || "",
        models: item.models || [],
        weight: Math.max(1, Number(item.weight) || 1),
        enabled: item.enabled !== false,
        remark: item.remark || "",
    };
}

function modelCostCredits(items: AdminSettings["public"]["modelChannel"]["modelCosts"], model: string) {
    return items.find((item) => item.model === model)?.credits || 0;
}

function setModelCost(form: any, setModelCosts: (items: AdminModelCost[]) => void, model: string, credits: number) {
    const current = (form.getFieldValue(["public", "modelChannel", "modelCosts"]) || []) as AdminSettings["public"]["modelChannel"]["modelCosts"];
    const next = current.filter((item) => item.model !== model);
    next.push({ model, credits: Math.max(0, credits) });
    form.setFieldValue(["public", "modelChannel", "modelCosts"], next);
    setModelCosts(next);
}

function mergeSavedSecrets(currentSettings: AdminSettings, saved: AdminSettings): AdminSettings {
    const channels = saved.private.channels.map((item, index) => ({
        ...item,
        apiKey: currentSettings.private.channels[index]?.apiKey || item.apiKey,
    }));
    const auth = {
        ...saved.private.auth,
        linuxDo: { ...saved.private.auth.linuxDo, clientSecret: currentSettings.private.auth.linuxDo.clientSecret || saved.private.auth.linuxDo.clientSecret },
        google: { ...saved.private.auth.google, clientSecret: currentSettings.private.auth.google.clientSecret || saved.private.auth.google.clientSecret },
        github: { ...saved.private.auth.github, clientSecret: currentSettings.private.auth.github.clientSecret || saved.private.auth.github.clientSecret },
        customProviders: saved.private.auth.customProviders.map((item, index) => ({
            ...item,
            clientSecret: currentSettings.private.auth.customProviders[index]?.clientSecret || item.clientSecret,
        })),
    };
    return {
        public: saved.public,
        private: {
            ...saved.private,
            channels,
            auth,
            turnstile: {
                ...saved.private.turnstile,
                secretKey: currentSettings.private.turnstile.secretKey || saved.private.turnstile.secretKey,
            },
            mail: {
                ...saved.private.mail,
                password: currentSettings.private.mail.password || saved.private.mail.password,
            },
            cloudStorage: { ...saved.private.cloudStorage, secretAccessKey: currentSettings.private.cloudStorage.secretAccessKey || saved.private.cloudStorage.secretAccessKey },
            stripe: {
                ...saved.private.stripe,
                secretKey: currentSettings.private.stripe.secretKey || saved.private.stripe.secretKey,
                webhookSecret: currentSettings.private.stripe.webhookSecret || saved.private.stripe.webhookSecret,
            },
            kyc: {
                ...saved.private.kyc,
                diditApiKey: currentSettings.private.kyc.diditApiKey || saved.private.kyc.diditApiKey,
                diditWebhookSecret: currentSettings.private.kyc.diditWebhookSecret || saved.private.kyc.diditWebhookSecret,
            },
        },
    };
}

function collectChannelModels(channels: AdminModelChannel[]) {
    return uniqueModels(channels.filter((channel) => channel.enabled).flatMap((channel) => channel.models || []));
}

function collectKnownModels(settings: AdminSettings) {
    return uniqueModels([
        ...(settings.public.modelChannel.availableModels || []),
        ...(settings.public.modelChannel.modelCosts || []).map((item) => item.model),
        ...settings.private.channels.flatMap((channel) => channel.models || []),
    ]);
}

function buildModelSelectGroups(sourceModels: string[], existingModels: string[]): Record<ModelSelectTabKey, string[]> {
    const source = uniqueModels(sourceModels);
    const existing = uniqueModels(existingModels);
    const existingSet = new Set(existing);
    return {
        new: source.filter((model) => !existingSet.has(model)),
        current: existing,
    };
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.filter(Boolean)));
}

function filterModels(models: string[], options: string[]) {
    const optionSet = new Set(options);
    return uniqueModels(models).filter((model) => optionSet.has(model));
}

function modelSummary(models: string[]) {
    if (!models.length) return "未配置模型";
    const preview = models.slice(0, 3).join(", ");
    return models.length > 3 ? `${models.length} 个模型：${preview}...` : preview;
}

function parseTabJson(tab: "public", value: string): AdminSettings["public"] | null;
function parseTabJson(tab: "private", value: string): AdminSettings["private"] | null;
function parseTabJson(tab: "public" | "private", value: string): AdminSettings["public"] | AdminSettings["private"] | null;
function parseTabJson(tab: "public" | "private", value: string): AdminSettings["public"] | AdminSettings["private"] | null {
    try {
        return tab === "public" ? normalizePublicSetting(JSON.parse(value) as Partial<AdminSettings["public"]>) : normalizePrivateSetting(JSON.parse(value) as Partial<AdminSettings["private"]>);
    } catch {
        return null;
    }
}

async function collectSettings(form: any, editorMode: Record<string, EditorMode>, jsonText: Record<string, string>, message: { error: (value: string) => void }) {
    const values = normalizeSettings(form.getFieldsValue(true) as AdminSettings);
    if (editorMode.public === "json") {
        const publicSetting = parseTabJson("public", jsonText.public);
        if (!publicSetting) {
            message.error("公开配置 JSON 格式不正确");
            return null;
        }
        values.public = publicSetting;
    }
    if (editorMode.private === "json") {
        const privateSetting = parseTabJson("private", jsonText.private);
        if (!privateSetting) {
            message.error("私有配置 JSON 格式不正确");
            return null;
        }
        values.private = privateSetting;
    }
    values.public.modelChannel.availableModels = filterModels(values.public.modelChannel.availableModels, collectChannelModels(values.private.channels));
    values.public.auth.customProviders = values.private.auth.customProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        iconUrl: provider.iconUrl,
        enabled: provider.enabled,
    }));
    values.private.auth.linuxDo.enabled = values.public.auth.linuxDo.enabled;
    values.private.auth.google.enabled = values.public.auth.google.enabled;
    values.private.auth.github.enabled = values.public.auth.github.enabled;
    values.private.auth.metamask.enabled = values.public.auth.metamask.enabled;
    values.public.auth.metamask.siteName = values.private.auth.metamask.siteName;
    values.public.auth.metamask.siteUrl = values.private.auth.metamask.siteUrl;
    values.public.auth.metamask.signatureLogoUrl = values.private.auth.metamask.signatureLogoUrl;
    return normalizeSettings(values);
}

function getJsonError(value: string) {
    try {
        JSON.parse(value);
        return "";
    } catch (error) {
        return error instanceof Error ? error.message : "JSON 格式不正确";
    }
}
