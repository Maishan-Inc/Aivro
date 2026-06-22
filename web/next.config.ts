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
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googletagservices.com https://*.googletagmanager.com https://*.google.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https: wss:",
            "frame-src 'self' https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ].join("; "),
    },
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
                    source: "/((?!_next/static|icons|logo.svg|favicon.ico).*)",
                    headers: [...noStoreHeaders, ...securityHeaders],
                },
            ];
        },
    };
}
