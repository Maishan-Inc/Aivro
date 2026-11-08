import { apiGet, apiPost } from "@/services/api/request";
import type { AiConfig } from "@/stores/use-config-store";
import type { Locale } from "@/i18n/messages";
import type { ThemeName } from "@/stores/use-theme-store";

export type UserPreference = {
    freeImageAgreement?: string;
    theme?: ThemeName;
    locale?: Locale;
    config?: Partial<AiConfig>;
};

export async function fetchUserPreference(token: string) {
    return apiGet<UserPreference>("/api/v1/preferences", undefined, token);
}

export async function saveUserPreference(token: string, value: UserPreference) {
    return apiPost<UserPreference>("/api/v1/preferences", value, token);
}
