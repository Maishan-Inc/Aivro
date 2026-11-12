"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { AdminPublicPageAccessSettings } from "@/services/api/admin";
import { localeFromPath, stripLocalePath, withLocalePath } from "@/i18n/routing";
import { fetchUserPreference } from "@/services/api/preferences";
import { useConfigStore } from "@/stores/use-config-store";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { canAccessPath, defaultWorkspacePath, sectionForPath } from "@/lib/user-sections";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const setConfig = useConfigStore((state) => state.setConfig);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const isPublicSettingsLoading = useConfigStore((state) => state.isPublicSettingsLoading);
    const user = useUserStore((state) => state.user);
    const token = useUserStore((state) => state.token);
    const setTheme = useThemeStore((state) => state.setTheme);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const isUserReady = useUserStore((state) => state.isReady);
    const pathLocale = localeFromPath(pathname);
    const locale = pathLocale || "zh-CN";
    const cleanPathname = stripLocalePath(pathname);
    const isLoginPage = cleanPathname === "/login" || cleanPathname === "/admin/login";
    const isProfileSetupPage = cleanPathname === "/profile/setup";
    const accessDenied = Boolean(user && !canAccessPath(user, cleanPathname));
    const redirectHome = cleanPathname === "/" && Boolean(user);
    const redirectGuestHome = cleanPathname === "/home" && isUserReady && !user;

    useEffect(() => {
        void loadPublicSettings(false).catch(() => {});
    }, [loadPublicSettings, pathname]);

    useEffect(() => {
        if (!isLoginPage) void hydrateUser(false);
    }, [hydrateUser, isLoginPage, pathname]);

    useEffect(() => {
        const refresh = () => { if (!document.hidden) void loadPublicSettings(false).catch(() => {}); };
        const timer = window.setInterval(() => { if (!document.hidden) void loadPublicSettings().catch(() => {}); }, 30_000);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [loadPublicSettings]);

    useEffect(() => {
        if (!token || isLoginPage) return;
        const refresh = () => { if (!document.hidden) void hydrateUser(); };
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
    }, [hydrateUser, isLoginPage, token]);

    useEffect(() => {
        if (!token || !user) return;
        void fetchUserPreference(token).then((preference) => {
            if (preference.theme) setTheme(preference.theme, false);
            if (preference.locale && !pathLocale) setLocale(preference.locale, false);
            if (preference.config) setConfig(preference.config, false);
        });
    }, [pathLocale, setConfig, setLocale, setTheme, token, user?.id]);

    useEffect(() => {
        if (isLoginPage || !publicSettings || isPublicSettingsLoading || !isUserReady || user) return;
        if (!isLoginRequiredPath(cleanPathname, publicSettings.pageAccess)) return;
        router.replace(withLocalePath(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`, locale));
    }, [cleanPathname, isLoginPage, isPublicSettingsLoading, isUserReady, locale, pathname, publicSettings, router, user]);

    useEffect(() => {
        if (!isUserReady || !user || user.role === "guest" || user.profileCompleted || isProfileSetupPage || isLoginPage) return;
        router.replace(withLocalePath(`/profile/setup?redirect=${encodeURIComponent(pathname + window.location.search)}`, locale));
    }, [isLoginPage, isProfileSetupPage, isUserReady, locale, pathname, router, user]);

    useEffect(() => {
        if (redirectGuestHome) router.replace(withLocalePath("/", locale));
    }, [locale, redirectGuestHome, router]);

    useEffect(() => {
        if (!isUserReady || !user?.profileCompleted || (!accessDenied && !redirectHome)) return;
        router.replace(withLocalePath(defaultWorkspacePath(user), locale));
    }, [accessDenied, isUserReady, locale, redirectHome, router, user]);

    if (((sectionForPath(cleanPathname) || cleanPathname === "/home") && !isUserReady) || redirectGuestHome || (user?.profileCompleted && (accessDenied || redirectHome))) {
        return <div className="grid h-dvh place-items-center bg-background text-sm text-muted-foreground" role="status">正在打开工作空间…</div>;
    }

    return <>{children}</>;
}

function isLoginRequiredPath(pathname: string, pageAccess?: Partial<AdminPublicPageAccessSettings>) {
    if (!pageAccess) return false;
    if (pageAccess.canvasLoginRequired && (pathname === "/canvas" || pathname.startsWith("/canvas/"))) return true;
    if (pageAccess.imageLoginRequired && pathname === "/image") return true;
    if (pageAccess.videoLoginRequired && pathname === "/video") return true;
    if (pageAccess.promptsLoginRequired && pathname === "/prompts") return true;
    if (pageAccess.assetsLoginRequired && pathname === "/assets") return true;
    return false;
}
