import { headers } from "next/headers";

import type { Locale } from "@/i18n/messages";
import { defaultLocale, isLocale } from "@/i18n/routing";
import { buildMetadata, seoPages, type SeoPageKey } from "@/lib/seo";

export async function requestLocale(): Promise<Locale> {
    const headerStore = await headers();
    const localeHeader = headerStore.get("x-aivro-locale") || defaultLocale;
    return isLocale(localeHeader) ? localeHeader : defaultLocale;
}

export async function generateLocalizedMetadata(pageKey: SeoPageKey) {
    return buildMetadata(seoPages[pageKey], await requestLocale());
}
