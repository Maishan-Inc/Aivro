"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { localeFromPath } from "@/i18n/routing";
import { useLocaleStore } from "@/stores/use-locale-store";

export function LocalePathSync() {
    const pathname = usePathname();
    const locale = localeFromPath(pathname);
    const setLocale = useLocaleStore((state) => state.setLocale);

    useEffect(() => {
        if (locale) setLocale(locale, false);
    }, [locale, setLocale]);

    return null;
}
