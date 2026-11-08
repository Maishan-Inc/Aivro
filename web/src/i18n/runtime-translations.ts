import type { Locale } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";
import { adminTranslations } from "@/i18n/locales/admin";
import enUS from "@/i18n/locales/en-US";
import frFR from "@/i18n/locales/fr-FR";
import jaJP from "@/i18n/locales/ja-JP";
import koKR from "@/i18n/locales/ko-KR";
import zhTW from "@/i18n/locales/zh-TW";
import { exploreTranslations, exploreAdminTranslations } from "@/i18n/locales/explore";

// Chinese is the source language: components keep Simplified Chinese literals and
// every other locale resolves through these dictionaries at runtime. The admin
// console only ships Chinese and English, so its extra strings are merged into
// `en-US`.
export const runtimeTranslations: Partial<Record<Locale, Record<string, string>>> = {
    "zh-TW": { ...zhTW, ...exploreTranslations["zh-TW"] },
    "en-US": { ...adminTranslations, ...enUS, ...exploreAdminTranslations, ...exploreTranslations["en-US"] },
    "ja-JP": { ...jaJP, ...exploreTranslations["ja-JP"] },
    "ko-KR": { ...koKR, ...exploreTranslations["ko-KR"] },
    "fr-FR": { ...frFR, ...exploreTranslations["fr-FR"] },
};

export const translate = createTranslator(runtimeTranslations);
