import { apiDelete, apiGet, apiPost, compactApiParams } from "@/services/api/request";
import type { Prompt, PromptListResponse } from "@/services/api/prompts";
import type { Plan } from "@/services/api/billing";

export type AdminPromptCategory = {
    category: string;
    name: string;
    description: string;
    file: string;
    githubUrl: string;
    remote: boolean;
};

export type AdminUser = {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    role: "user" | "admin";
    credits: number;
    affCode: string;
    affCount: number;
    inviterId: string;
    googleId: string;
    githubId: string;
    linuxDoId: string;
    metamaskAddress: string;
    authProvider: string;
    emailVerified: boolean;
    status: "active" | "ban";
    lastLoginAt: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminUserListResponse = {
    items: AdminUser[];
    total: number;
};

export type AdminCreditLog = {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balance: number;
    relatedId: string;
    remark: string;
    extra: string;
    createdAt: string;
};

export type AdminCreditLogListResponse = {
    items: AdminCreditLog[];
    total: number;
};

export type AdminUserQuery = {
    keyword?: string;
    page?: number;
    pageSize?: number;
};

export async function fetchAdminUsers(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminUserListResponse>("/api/admin/users", compactApiParams(query), token);
}

export async function fetchAuthProviderStats(token: string) {
    return apiGet<Record<string, number>>("/api/admin/users/auth-provider-stats", undefined, token);
}

export async function saveAdminUser(token: string, user: Partial<AdminUser> & { password?: string }) {
    return apiPost<AdminUser>("/api/admin/users", user, token);
}

export async function adjustAdminUserCredits(token: string, id: string, credits: number) {
    return apiPost<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/credits`, { credits }, token);
}

export async function deleteAdminUser(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/users/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminCreditLogs(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminCreditLogListResponse>("/api/admin/credit-logs", compactApiParams(query), token);
}

export async function saveAdminCreditLog(token: string, log: Partial<AdminCreditLog>) {
    return apiPost<AdminCreditLog>("/api/admin/credit-logs", log, token);
}

export async function deleteAdminCreditLog(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/credit-logs/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminPromptCategories(token: string) {
    return apiGet<AdminPromptCategory[]>("/api/admin/prompt-categories", undefined, token);
}

export async function syncAdminPromptCategory(token: string, category: string) {
    return apiPost<AdminPromptCategory[]>("/api/admin/prompt-categories/sync", { category }, token);
}

export type AdminPromptQuery = {
    keyword?: string;
    category?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export type AdminAsset = {
    id: string;
    title: string;
    type: "text" | "image" | "video";
    coverUrl: string;
    tags: string[];
    category: string;
    description: string;
    content: string;
    url: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminAssetListResponse = {
    items: AdminAsset[];
    tags: string[];
    total: number;
};

export async function fetchAdminPrompts(token: string, query: AdminPromptQuery = {}) {
    return apiGet<PromptListResponse>("/api/admin/prompts", compactApiParams(query), token);
}

export async function saveAdminPrompt(token: string, prompt: Partial<Prompt>) {
    return apiPost<Prompt>("/api/admin/prompts", prompt, token);
}

export async function deleteAdminPrompt(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/prompts/${encodeURIComponent(id)}`, token);
}

export async function deleteAdminPrompts(token: string, ids: string[]) {
    return apiPost<boolean>("/api/admin/prompts/batch-delete", { ids }, token);
}

export type AdminAssetQuery = {
    keyword?: string;
    type?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export async function fetchAdminAssets(token: string, query: AdminAssetQuery = {}) {
    return apiGet<AdminAssetListResponse>("/api/admin/assets", compactApiParams(query), token);
}

export async function saveAdminAsset(token: string, asset: Partial<AdminAsset>) {
    return apiPost<AdminAsset>("/api/admin/assets", asset, token);
}

export async function deleteAdminAsset(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/assets/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminPlans(token: string) {
    return apiGet<Plan[]>("/api/admin/plans", undefined, token);
}

export async function saveAdminPlan(token: string, plan: Partial<Plan>) {
    return apiPost<Plan>("/api/admin/plans", plan, token);
}

export type AdminModelChannel = {
    protocol: "openai";
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    weight: number;
    enabled: boolean;
    remark: string;
};

export type AdminPublicModelChannelSettings = {
    availableModels: string[];
    modelCosts: AdminModelCost[];
    defaultModel: string;
    defaultImageModel: string;
    defaultVideoModel: string;
    defaultTextModel: string;
    systemPrompt: string;
};

export type AdminModelCost = {
    model: string;
    credits: number;
};

export type AdminPublicSettings = {
    modelChannel: AdminPublicModelChannelSettings;
    auth: {
        allowRegister: boolean;
        emailVerification: boolean;
        turnstileSiteKey: string;
        linuxDo: AdminPublicAuthProvider;
        google: AdminPublicAuthProvider;
        github: AdminPublicAuthProvider;
        metamask: AdminPublicAuthProvider;
        customProviders: AdminPublicAuthProvider[];
    };
    pages: AdminPublicPagesSettings;
    pageAccess: AdminPublicPageAccessSettings;
};

export type AdminPublicPagesSettings = {
    privacyTitle: string;
    privacyContent: string;
    privacyTitleEn: string;
    privacyContentEn: string;
    termsTitle: string;
    termsContent: string;
    termsTitleEn: string;
    termsContentEn: string;
};

export type AdminPublicPageAccessSettings = {
    canvasLoginRequired: boolean;
    imageLoginRequired: boolean;
    videoLoginRequired: boolean;
    promptsLoginRequired: boolean;
    assetsLoginRequired: boolean;
};

export type AdminPublicAuthProvider = {
    id: string;
    name: string;
    iconUrl: string;
    enabled: boolean;
};

export type AdminPrivateSettings = {
    channels: AdminModelChannel[];
    promptSync: {
        enabled: boolean;
        cron: string;
    };
    turnstile: AdminTurnstileSettings;
    auth: {
        linuxDo: AdminPrivateAuthProvider;
        google: AdminPrivateAuthProvider;
        github: AdminPrivateAuthProvider;
        metamask: { enabled: boolean };
        customProviders: AdminPrivateAuthProvider[];
    };
    mail: AdminMailSettings;
    cloudStorage: AdminCloudStorageSettings;
    stripe: AdminStripeSettings;
    kyc: AdminKycSettings;
};

export type AdminTurnstileSettings = {
    enabled: boolean;
    siteKey: string;
    secretKey: string;
};

export type AdminStripeSettings = {
    enabled: boolean;
    secretKey: string;
    webhookSecret: string;
    successUrl: string;
    cancelUrl: string;
};

export type AdminKycSettings = {
    enabled: boolean;
    provider: "didit";
    diditApiKey: string;
    diditWebhookSecret: string;
    workflowId: string;
    callbackUrl: string;
    rewardCredits: number;
    rewardWorkflowCreateCredits: number;
    rewardOnce: boolean;
};

export type AdminCloudStorageSettings = {
    enabled: boolean;
    provider: "r2" | "s3";
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
    imagePathTemplate: string;
    videoPathTemplate: string;
    imageExpireDays: number;
    videoExpireDays: number;
    autoCleanupEnabled: boolean;
    pathStyleEndpoint: boolean;
};

export type AdminPrivateAuthProvider = AdminPublicAuthProvider & {
    clientId: string;
    clientSecret: string;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scope: string;
};

export type AdminMailSettings = {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    codeExpireMin: number;
    templates: {
        register: AdminMailTemplate;
        reset: AdminMailTemplate;
        metamask: AdminMailTemplate;
    };
};

export type AdminMailTemplate = {
    subject: string;
    body: string;
};

export type AdminSettings = {
    public: AdminPublicSettings;
    private: AdminPrivateSettings;
};

export type AdminDatabaseUpdateLog = {
    id: string;
    sourceFile: string;
    models: string;
    status: "success" | "error";
    error: string;
    createdAt: string;
};

export type AdminDatabaseStatus = {
    updated: boolean;
    sourceFiles: string[];
    missing: string[];
    logs: AdminDatabaseUpdateLog[];
};

export async function fetchAdminSettings(token: string) {
    return apiGet<AdminSettings>("/api/admin/settings", undefined, token);
}

export async function saveAdminSettings(token: string, settings: AdminSettings) {
    return apiPost<AdminSettings>("/api/admin/settings", settings, token);
}

export async function updateDatabase(token: string) {
    return apiPost<boolean>("/api/admin/settings/database-update", {}, token);
}

export async function fetchDatabaseStatus(token: string) {
    return apiGet<AdminDatabaseStatus>("/api/admin/database/status", undefined, token);
}

export type AdminChannelActionRequest = {
    index?: number;
    channel: AdminModelChannel;
    model?: string;
};

export async function fetchChannelModels(token: string, payload: AdminChannelActionRequest) {
    return apiPost<string[]>("/api/admin/settings/channel-models", payload, token);
}

export async function testChannelModel(token: string, payload: AdminChannelActionRequest) {
    return apiPost<string>("/api/admin/settings/channel-test", payload, token);
}

export async function testCloudStorage(token: string, setting: AdminCloudStorageSettings) {
    return apiPost<string>("/api/admin/settings/cloud-storage-test", { setting }, token);
}

export async function testMailSettings(token: string, setting: AdminMailSettings, email: string) {
    return apiPost<boolean>("/api/admin/settings/mail-test", { setting, email }, token);
}
