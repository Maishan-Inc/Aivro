"use client";

import { useCallback } from "react";

import { messages, type Locale } from "@/i18n/messages";
import { translate } from "@/i18n/runtime-translations";
import { useEffectiveLocale } from "@/hooks/use-effective-locale";
import { useLocaleStore } from "@/stores/use-locale-store";

type MessageKey = keyof (typeof messages)["zh-CN"];

export function useI18n() {
    const locale = useEffectiveLocale();
    const setLocale = useLocaleStore((state) => state.setLocale);
    const activeMessages = (messages[locale as keyof typeof messages] || messages["zh-CN"]) as Record<MessageKey, string>;
    const t = useCallback((key: MessageKey) => activeMessages[key] || messages["zh-CN"][key] || key, [activeMessages]);
    // `tr` translates a Chinese runtime string (including {0} placeholders) with the
    // active locale, for text that cannot be expressed as a static translation key.
    const tr = useCallback((value: string) => translate(value, locale), [locale]);
    return { locale, setLocale, t, tr };
}

export type { Locale };
