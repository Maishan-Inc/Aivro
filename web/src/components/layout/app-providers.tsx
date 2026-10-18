"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ProConfigProvider } from "@ant-design/pro-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import type { Locale as AntdLocale } from "antd/lib/locale";

import { ClientRootInit } from "@/components/layout/client-root-init";
import { GoogleAdSenseScript } from "@/components/layout/google-adsense-script";
import { LocalePathSync } from "@/components/layout/locale-path-sync";
import { RuntimeI18nTranslator } from "@/components/layout/runtime-i18n-translator";
import { useEffectiveLocale } from "@/hooks/use-effective-locale";
import type { Locale } from "@/i18n/messages";
import { getAntThemeConfig } from "@/lib/app-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

const antdLocales: Record<Locale, AntdLocale> = {
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    "en-US": enUS,
    "ja-JP": jaJP,
    "ko-KR": koKR,
    "fr-FR": frFR,
};

export function AppProviders({ children }: { children: ReactNode }) {
    const theme = useThemeStore((state) => state.theme);
    const locale = useEffectiveLocale();
    const dark = theme === "dark";

    useEffect(() => useUserStore.subscribe((state, previous) => {
        if (state.user?.id !== previous.user?.id) {
            queryClient.clear();
            useCanvasStore.getState().setProjects([]);
        }
    }), []);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = theme;
    }, [dark, theme]);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return (
        <ConfigProvider locale={antdLocales[locale] || zhCN} theme={getAntThemeConfig(dark)}>
            <ProConfigProvider dark={dark}>
                <App>
                    <QueryClientProvider client={queryClient}>
                        <LocalePathSync />
                        <RuntimeI18nTranslator />
                        <GoogleAdSenseScript />
                        <ClientRootInit>{children}</ClientRootInit>
                    </QueryClientProvider>
                </App>
            </ProConfigProvider>
        </ConfigProvider>
    );
}
