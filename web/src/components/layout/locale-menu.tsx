"use client";

import { Dropdown } from "antd";
import { Check, Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { localeLabels, type Locale } from "@/i18n/messages";
import { stripLocalePath, withLocalePath } from "@/i18n/routing";

export function LocaleMenu() {
    const pathname = usePathname();
    const { locale, setLocale, t } = useI18n();
    return (
        <Dropdown trigger={["click"]} menu={{
            selectedKeys: [locale],
            items: (Object.keys(localeLabels) as Locale[]).map((value) => ({ key: value, label: <span className="flex min-w-28 items-center justify-between gap-3">{localeLabels[value]}{value === locale ? <Check className="size-3.5" /> : null}</span> })),
            onClick: ({ key }) => {
                setLocale(key as Locale);
                window.location.href = withLocalePath(stripLocalePath(pathname), key as Locale) + window.location.search + window.location.hash;
            },
        }}>
            <button type="button" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={t("locale.switch")} title={localeLabels[locale]}>
                <Languages className="size-4" />
            </button>
        </Dropdown>
    );
}
