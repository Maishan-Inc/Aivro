"use client";

import { usePathname } from "next/navigation";

import type { Locale } from "@/i18n/messages";
import { useLocaleStore } from "@/stores/use-locale-store";

// The admin console ships Chinese and English only. Any other locale chosen on the
// public site falls back to Chinese there.
export function useEffectiveLocale(): Locale {
    const locale = useLocaleStore((state) => state.locale);
    const pathname = usePathname() || "";
    if (!pathname.startsWith("/admin")) return locale;
    return locale === "en-US" ? "en-US" : "zh-CN";
}
