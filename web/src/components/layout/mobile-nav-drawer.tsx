"use client";

import { Drawer } from "antd";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { useI18n } from "@/hooks/use-i18n";
import { withLocalePath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/use-user-store";

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const { locale, t } = useI18n();
    const user = useUserStore((state) => state.user);

    return (
        <Drawer title={t("nav.title")} placement="left" size={280} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-1">
                {user ? (
                    <Link href={withLocalePath("/console", locale)} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-stone-900 transition hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800">
                        <LayoutDashboard className="size-5" />
                        <span>{locale === "en-US" ? "Console" : "控制台"}</span>
                    </Link>
                ) : null}
                {navigationTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    const externalHref = "localeAware" in tool && tool.localeAware && locale === "zh-CN" ? `${tool.href}/zh-CN` : tool.href ?? "#";
                    return (
                        <Link
                            key={tool.slug}
                            href={tool.external ? externalHref : withLocalePath(tool.href || `/${tool.slug}`, locale)}
                            target={tool.external ? "_blank" : undefined}
                            rel={tool.external ? "noreferrer" : undefined}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
                                active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{t(tool.labelKey)}</span>
                        </Link>
                    );
                })}
            </div>
        </Drawer>
    );
}
