import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { headers } from "next/headers";
import { AppProviders } from "@/components/layout/app-providers";
import type { Locale } from "@/i18n/messages";
import { isLocale } from "@/i18n/routing";
import { buildMetadata, seoPages } from "@/lib/seo";
import "antd/dist/reset.css";
import "./globals.css";
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const locale = await requestLocale();
    return {
        ...buildMetadata(seoPages.home, locale),
        icons: {
            icon: "/logo.svg",
            shortcut: "/logo.svg",
            apple: "/logo.svg",
        },
    };
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const locale = await requestLocale();
    return (
        <html lang={locale} suppressHydrationWarning className="font-sans">
            <body
                className="bg-background text-foreground antialiased"
                style={{
                    fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
                }}
            >
                <AntdRegistry>
                    <AppProviders>{children}</AppProviders>
                </AntdRegistry>
            </body>
        </html>
    );
}

async function requestLocale(): Promise<Locale> {
    const headerStore = await headers();
    const localeHeader = headerStore.get("x-aivro-locale") || "zh-CN";
    return isLocale(localeHeader) ? localeHeader : "zh-CN";
}
