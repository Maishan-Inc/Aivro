import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/api/", "/admin/", "/zh-CN/admin/", "/en-US/admin/", "/assets/", "/zh-CN/assets/", "/en-US/assets/", "/canvas/", "/zh-CN/canvas/", "/en-US/canvas/", "/share/", "/zh-CN/share/", "/en-US/share/"],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
