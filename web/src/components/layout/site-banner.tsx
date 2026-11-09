"use client";

import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { defaultBannerText } from "@/constant/home-settings";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useConfigStore } from "@/stores/use-config-store";

export function SiteBanner() {
    const home = useConfigStore((state) => state.publicSettings?.home);
    const { locale, tr } = useI18n();
    const localizedPath = useLocalizedPath();
    if (!home?.bannerEnabled) return null;

    return <aside aria-label={tr("网站公告")} className="z-40 shrink-0 bg-foreground text-background">
        <Link href={localizedPath("/models")} style={{ color: "inherit" }} className="mx-auto flex max-w-[1960px] items-center justify-center gap-2 px-4 py-2 text-center text-xs leading-5 transition-opacity hover:opacity-80 sm:text-[13px]">
            <Megaphone className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]" data-i18n-skip>{home.bannerText?.[locale]?.trim() || tr(defaultBannerText)}</span>
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
    </aside>;
}
