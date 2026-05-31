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
                    headers: noStoreHeaders,
                },
            ];
        },
    };
}
