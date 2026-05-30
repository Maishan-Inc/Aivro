"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { AdminPublicPageAccessSettings } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const isPublicSettingsLoading = useConfigStore((state) => state.isPublicSettingsLoading);
    const user = useUserStore((state) => state.user);
    const isUserReady = useUserStore((state) => state.isReady);
    const isLoginPage = pathname === "/login" || pathname === "/admin/login";

    useEffect(() => {
        void loadPublicSettings();
    }, [loadPublicSettings]);

    useEffect(() => {
        if (!isLoginPage) void hydrateUser();
    }, [hydrateUser, isLoginPage]);

    useEffect(() => {
        if (isLoginPage || !publicSettings || isPublicSettingsLoading || !isUserReady || user) return;
        if (!isLoginRequiredPath(pathname, publicSettings.pageAccess)) return;
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }, [isLoginPage, isPublicSettingsLoading, isUserReady, pathname, publicSettings, router, user]);

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
