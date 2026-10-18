import type { Locale } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";
import { adminTranslations } from "@/i18n/locales/admin";
import enUS from "@/i18n/locales/en-US";
import frFR from "@/i18n/locales/fr-FR";
import jaJP from "@/i18n/locales/ja-JP";
import koKR from "@/i18n/locales/ko-KR";
import zhTW from "@/i18n/locales/zh-TW";

// Chinese is the source language: components keep Simplified Chinese literals and
// every other locale resolves through these dictionaries at runtime. The admin
// console only ships Chinese and English, so its extra strings are merged into
// `en-US`.
export const runtimeTranslations: Partial<Record<Locale, Record<string, string>>> = {
    "zh-TW": zhTW,
    "en-US": { ...adminTranslations, ...enUS },
    "ja-JP": jaJP,
    "ko-KR": koKR,
    "fr-FR": frFR,
};

export const translate = createTranslator(runtimeTranslations);
