"use client";

import { useCallback } from "react";

import { messages, type Locale } from "@/i18n/messages";
import { useLocaleStore } from "@/stores/use-locale-store";

export function useI18n() {
    const locale = useLocaleStore((state) => state.locale);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const activeMessages = messages[locale] || messages["zh-CN"];
    const t = useCallback((key: keyof (typeof messages)["zh-CN"]) => activeMessages[key] || messages["zh-CN"][key] || key, [activeMessages]);
    return { locale, setLocale, t };
}

export type { Locale };
