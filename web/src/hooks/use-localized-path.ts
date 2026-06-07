"use client";

import { usePathname } from "next/navigation";

import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { useLocaleStore } from "@/stores/use-locale-store";

export function useLocalizedPath() {
    const pathname = usePathname();
    const storeLocale = useLocaleStore((state) => state.locale);
    const locale = localeFromPath(pathname) || storeLocale;
    return (path: string) => withLocalePath(path, locale);
}
