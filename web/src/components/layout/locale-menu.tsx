"use client";

import { Dropdown } from "antd";
import { Check, Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { adminLocaleOptions, localeLabels, type Locale } from "@/i18n/messages";
import { stripLocalePath, withLocalePath } from "@/i18n/routing";

export function LocaleMenu({ admin = false }: { admin?: boolean }) {
    const pathname = usePathname();
    const { locale, setLocale, t } = useI18n();
    const options: Locale[] = admin ? adminLocaleOptions : (Object.keys(localeLabels) as Locale[]);
    return (
        <Dropdown trigger={["click"]} menu={{
            selectedKeys: [locale],
            items: options.map((value) => ({ key: value, label: <span data-i18n-skip className="flex min-w-28 items-center justify-between gap-3">{localeLabels[value]}{value === locale ? <Check className="size-3.5" /> : null}</span> })),
            onClick: ({ key }) => {
                const next = key as Locale;
                if (admin) {
                    setLocale(next);
                    return;
                }
                setLocale(next);
                window.location.href = withLocalePath(stripLocalePath(pathname), next) + window.location.search + window.location.hash;
            },
        }}>
            <button type="button" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={t("locale.switch")} title={localeLabels[locale]}>
                <Languages className="size-4" />
            </button>
        </Dropdown>
    );
}
