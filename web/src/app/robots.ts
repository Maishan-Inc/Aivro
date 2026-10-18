import type { MetadataRoute } from "next";

import { locales } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";

const privatePaths = ["/api/", "/admin/", "/assets/", "/canvas/", "/share/"];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [...privatePaths, ...locales.flatMap((locale) => privatePaths.map((path) => `/${locale}${path}`))],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
