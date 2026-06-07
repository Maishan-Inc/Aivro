import { headers } from "next/headers";

import type { Locale } from "@/i18n/messages";
import { isLocale } from "@/i18n/routing";
import { buildMetadata, seoPages, type SeoPageKey } from "@/lib/seo";

export async function generateLocalizedMetadata(pageKey: SeoPageKey) {
    const headerStore = await headers();
    const localeHeader = headerStore.get("x-aivro-locale") || "zh-CN";
    const locale: Locale = isLocale(localeHeader) ? localeHeader : "zh-CN";
    return buildMetadata(seoPages[pageKey], locale);
}
