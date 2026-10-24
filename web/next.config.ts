import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseChangelog } from "@/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");
const noStoreHeaders = [
    { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate" },
    { key: "CDN-Cache-Control", value: "no-store" },
    { key: "Surrogate-Control", value: "no-store" },
    { key: "Pragma", value: "no-cache" },
    { key: "Expires", value: "0" },
];

const securityHeaders = [
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
];

export default function nextConfig(phase: string): NextConfig {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;
    const releases = parseChangelog(localChangelog);

    return {
        allowedDevOrigins: isDev ? ["127.0.0.1", "localhost"] : [],
        env: {
            NEXT_PUBLIC_APP_VERSION: localVersion,
            NEXT_PUBLIC_APP_RELEASES: JSON.stringify(releases),
        },
        async headers() {
            return [
                {
                    source: "/((?!_next/static|icons|showcase|logo.svg|logo-mail-dark.png|logo-mail-light.png|favicon.ico).*)",
                    headers: [...noStoreHeaders, ...securityHeaders],
                },
                {
                    source: "/showcase/:path*",
                    headers: [
                        { key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
                        { key: "CDN-Cache-Control", value: "public, max-age=604800, stale-while-revalidate=604800" },
                        { key: "Surrogate-Control", value: "max-age=604800, stale-while-revalidate=604800" },
                    ],
                },
            ];
        },
    };
}
