"use client";

import { Dropdown } from "antd";
import { Check, Languages, Menu, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { localeLabels, type Locale } from "@/i18n/messages";
import { stripLocalePath, withLocalePath } from "@/i18n/routing";
import { useI18n } from "@/hooks/use-i18n";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { cn } from "@/lib/utils";

export function AppTopNav() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const { locale, setLocale, t } = useI18n();
    const cleanPathname = stripLocalePath(pathname);
    const localizedPath = (path: string, targetLocale: Locale = locale) => withLocalePath(path, targetLocale);
    const switchLocale = (nextLocale: Locale) => {
        setLocale(nextLocale);
        window.location.href = withLocalePath(cleanPathname, nextLocale);
    };
    const hideHeader = /^\/canvas\/[^/]+/.test(cleanPathname);
    const slug = cleanPathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;
    const languageItems = (Object.keys(localeLabels) as Locale[]).map((item) => ({
        key: item,
        label: (
            <span className="flex min-w-28 items-center justify-between gap-3">
                <span>{localeLabels[item]}</span>
                {item === locale ? <Check className="size-3.5" /> : null}
            </span>
        ),
    }));
    const nextThemeTitle = theme === "dark" ? t("theme.toLight") : t("theme.toDark");

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="mx-auto grid h-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-5 px-6">
                        <div className="flex min-w-0 items-center">
                            <Link href={localizedPath("/")} className="flex h-full shrink-0 items-center gap-2 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300">
                                <span
                                    className="size-5 shrink-0 bg-current"
                                    style={{
                                        mask: "url(/logo.svg) center / contain no-repeat",
                                        WebkitMask: "url(/logo.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="text-base font-medium">{t("app.name")}</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("nav.open")}
                                title={t("nav.title")}
                            >
                                <Menu className="size-5" />
                            </button>
                        </div>

                        <nav className="hide-scrollbar hidden h-16 min-w-0 items-center justify-center gap-7 overflow-x-auto md:flex">
                            {navigationTools.map((tool) => {
                                const Icon = tool.icon;
                                const active = tool.slug === activeToolSlug;
                                const externalHref = "localeAware" in tool && tool.localeAware && locale === "zh-CN" ? `${tool.href}/zh-CN` : tool.href ?? "#";
                                return (
                                    <Link
                                        key={tool.slug}
                                        href={tool.external ? externalHref : localizedPath(tool.href || `/${tool.slug}`)}
                                        target={tool.external ? "_blank" : undefined}
                                        rel={tool.external ? "noreferrer" : undefined}
                                        className={cn(
                                            "relative flex h-16 shrink-0 items-center gap-2 text-sm leading-6 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px",
                                            active
                                                ? "font-medium text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                : "text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                        )}
                                    >
                                        <Icon className="size-4" />
                                        <span className="truncate">{t(tool.labelKey)}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            <Dropdown
                                trigger={["click"]}
                                menu={{
                                    items: languageItems,
                                    selectable: true,
                                    selectedKeys: [locale],
                                    onClick: ({ key }) => switchLocale(key as Locale),
                                }}
                            >
                                <button
                                    type="button"
                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 px-1 text-sm text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4"
                                    aria-label={t("locale.switch")}
                                    title={t("locale.current")}
                                >
                                    <Languages className="size-4" />
                                    <span>{localeLabels[locale]}</span>
                                </button>
                            </Dropdown>
                            {isReady && user ? (
                                <>
                                    <Link href={localizedPath("/pricing")} className="hidden h-8 items-center gap-1.5 px-1 text-sm font-medium text-stone-600 transition hover:text-stone-950 sm:inline-flex dark:text-stone-300 dark:hover:text-stone-100">
                                        <WalletCards className="size-4" />
                                        <span>{locale === "en-US" ? "Plans" : "套餐"}</span>
                                    </Link>
                                    <UserStatusActions />
                                </>
                            ) : (
                                <>
                                    <AnimatedThemeToggler
                                        theme={theme}
                                        onThemeChange={setTheme}
                                        className="inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4"
                                        aria-label={nextThemeTitle}
                                        title={nextThemeTitle}
                                    />
                                    <Link href={localizedPath("/login")} className="text-sm font-medium text-stone-600 underline-offset-4 transition hover:text-stone-950 hover:underline dark:text-stone-300 dark:hover:text-stone-100">
                                        {t("common.login")}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
        </>
    );
}
