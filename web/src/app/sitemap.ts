import type { MetadataRoute } from "next";

import { locales } from "@/i18n/routing";
import { localizedUrl, seoPages } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    return Object.values(seoPages)
        .filter((page) => page.index)
        .flatMap((page) =>
            locales.map((locale) => ({
                url: localizedUrl(page.path, locale),
                lastModified: now,
                changeFrequency: page.path === "/" ? "daily" : "weekly",
                priority: page.path === "/" ? 1 : 0.7,
                alternates: {
                    languages: {
                        "zh-CN": localizedUrl(page.path, "zh-CN"),
                        "en-US": localizedUrl(page.path, "en-US"),
                        "x-default": localizedUrl(page.path, "zh-CN"),
                    },
                },
            })),
        );
}
