"use client";

import { create } from "zustand";

import type { Locale } from "@/i18n/messages";
import { defaultLocale, localeFromLanguageTag } from "@/i18n/routing";
import { saveUserPreference } from "@/services/api/preferences";
import { useUserStore } from "@/stores/use-user-store";

type LocaleStore = {
    locale: Locale;
    setLocale: (locale: Locale, sync?: boolean) => void;
};

function detectLocale(): Locale {
    if (typeof window === "undefined") return defaultLocale;
    try {
        const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
        for (const language of languages) {
            const locale = language ? localeFromLanguageTag(language) : undefined;
            if (locale) return locale;
        }
        return defaultLocale;
    } catch {
        return defaultLocale;
    }
}

export const useLocaleStore = create<LocaleStore>()((set) => ({
    locale: detectLocale(),
    setLocale: (locale, sync = true) => {
        set({ locale });
        const token = useUserStore.getState().token;
        if (sync && token) void saveUserPreference(token, { locale });
    },
}));
