import { apiGet, apiPost } from "@/services/api/request";
import { COOKIE_SESSION_TOKEN } from "@/services/api/request";

export const AUTH_TOKEN_KEY = "aivro-auth-token-v1";
export { COOKIE_SESSION_TOKEN };

export type UserRole = "guest" | "user" | "admin";

export type AuthUser = {
    id: string;
    username: string;
    displayName: string;
    accountType: "personal" | "company";
    profileCompleted: boolean;
    avatarUrl: string;
    role: UserRole;
    credits: number;
    workflowCreateCredits: number;
    createdAt: string;
    updatedAt: string;
};

export type AuthSession = {
    token: string;
    user: AuthUser;
};

export type AuthPayload = {
    username: string;
    password: string;
    email?: string;
    code?: string;
    accountType?: "personal" | "company";
    displayName?: string;
    captchaToken?: string;
    turnstileToken?: string;
};

export type EmailCodePurpose = "register" | "reset" | "metamask";

export async function login(payload: AuthPayload) {
    return apiPost<AuthSession>("/api/auth/login", payload);
}

export async function register(payload: AuthPayload) {
    return apiPost<AuthSession>("/api/auth/register", payload);
}

export async function checkRegisterEmail(email: string) {
    return apiPost<boolean>("/api/auth/register/check", { email });
}

export async function sendRegisterEmailCode(email: string, captchaToken?: string) {
    return apiPost<boolean>("/api/auth/register/code", { email, captchaToken });
}

export async function fetchCurrentUser(token?: string) {
    return apiGet<AuthUser>("/api/auth/me", undefined, token);
}

export async function sendEmailCode(email: string, purpose: EmailCodePurpose, captchaToken?: string) {
    return apiPost<boolean>("/api/auth/email-code", { email, purpose, captchaToken });
}

export async function resetPassword(payload: { email: string; code: string; password: string; captchaToken?: string; turnstileToken?: string }) {
    return apiPost<boolean>("/api/auth/reset-password", payload);
}

export async function fetchMetaMaskChallenge(walletAddress: string) {
    return apiPost<{ walletAddress: string; nonce: string; message: string; expiresAt: string }>("/api/auth/metamask/challenge", { walletAddress });
}

export async function loginWithMetaMask(payload: { walletAddress: string; message: string; signature: string; email: string; code: string; captchaToken?: string; turnstileToken?: string }) {
    return apiPost<AuthSession>("/api/auth/metamask/login", payload);
}

export async function logout() {
    return apiPost<boolean>("/api/auth/logout", {});
}

export async function completeProfile(token: string, payload: { username?: string; accountType: "personal" | "company"; displayName: string; avatarUrl?: string }) {
    return apiPost<AuthUser>("/api/v1/profile", payload, token);
}
