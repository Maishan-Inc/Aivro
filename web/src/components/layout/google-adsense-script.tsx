"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import type { AdminAdSenseSettings } from "@/services/api/admin";
import { stripLocalePath } from "@/i18n/routing";
import { useConfigStore } from "@/stores/use-config-store";

export function GoogleAdSenseScript() {
    const pathname = stripLocalePath(usePathname());
    const adSense = useConfigStore((state) => state.publicSettings?.adSense);
    const src = adSenseScriptSrc(adSense?.code || "");
    if (!adSense?.enabled || !src || !isAdSensePageEnabled(pathname, adSense)) return null;
    return <Script id="google-adsense" src={src} strategy="afterInteractive" async crossOrigin="anonymous" />;
}

function adSenseScriptSrc(code: string) {
    const value = code.trim();
    const src = value.match(/\ssrc=["']([^"']+)["']/i)?.[1] || (value.startsWith("https://") ? value : "");
    if (!src.startsWith("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) return "";
    return src;
}

function isAdSensePageEnabled(pathname: string, setting: AdminAdSenseSettings) {
    const pages = setting.pages;
    if (pathname === "/") return pages.home;
    if (pathname === "/pricing") return pages.pricing;
    if (pathname === "/image") return pages.image;
    if (pathname === "/video") return pages.video;
    if (pathname === "/model-3d") return pages.model3d;
    if (pathname === "/canvas" || pathname.startsWith("/canvas/")) return pages.canvas;
    if (pathname === "/prompts") return pages.prompts;
    if (pathname === "/assets") return pages.assets;
    if (pathname === "/asset-library") return pages.assetLibrary;
    if (pathname === "/privacy") return pages.privacy;
    if (pathname === "/terms") return pages.terms;
    return false;
}
