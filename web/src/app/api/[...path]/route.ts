import type { NextRequest } from "next/server";
import { isIP } from "node:net";
import { apiSecurityHeaders } from "@/lib/security-headers";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
    params: Promise<{ path: string[] }>;
};

const clientLocationHeaders = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country"];
const clientRegionHeaders = ["cf-region", "x-vercel-ip-country-region", "x-region"];

function proxyHeaders(request: NextRequest) {
    const headers = new Headers(request.headers);
    const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
    const clientIP = trustedHeader ? request.headers.get(trustedHeader)?.trim() : "";
    const trustedCountryHeaders = (process.env.TRUSTED_CLIENT_COUNTRY_HEADERS || clientLocationHeaders.join(",")).toLowerCase().split(",").map((key) => key.trim()).filter(Boolean);
    const trustedRegionHeaders = (process.env.TRUSTED_CLIENT_REGION_HEADERS || clientRegionHeaders.join(",")).toLowerCase().split(",").map((key) => key.trim()).filter(Boolean);
    for (const key of ["host", "content-length", "connection", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "cf-connecting-ip", "true-client-ip", "x-client-ip", "x-cluster-client-ip", "x-aivro-client-ip", "x-aivro-client-country", "x-aivro-client-region", ...clientLocationHeaders, ...clientRegionHeaders]) {
        headers.delete(key);
    }
    if (clientIP && isIP(clientIP)) {
        headers.set("x-aivro-client-ip", clientIP);
        const country = trustedCountryHeaders.map((key) => request.headers.get(key)?.trim()).find(Boolean);
        const region = trustedRegionHeaders.map((key) => request.headers.get(key)?.trim()).find(Boolean);
        if (country) headers.set("x-aivro-client-country", country.slice(0, 64));
        if (region) headers.set("x-aivro-client-region", region.slice(0, 128));
    }
    headers.set("x-forwarded-host", request.nextUrl.host);
    headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
    return headers;
}

function responseHeaders(response: Response, path: string[], method: string) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(apiSecurityHeaders)) headers.set(key, value);
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
    if (setCookies.length) {
        headers.delete("set-cookie");
        for (const cookie of setCookies) headers.append("set-cookie", cookie);
    }
    if (path[0] !== "auth" && path.join("/") !== "admin/login") headers.delete("set-cookie");
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    if (method === "GET" && (path.join("/") === "prompts" || path.join("/") === "settings")) {
        const maxAge = path[0] === "settings" ? 300 : 0;
        const value = `public, max-age=${maxAge}, s-maxage=300, stale-while-revalidate=600`;
        headers.set("Cache-Control", value);
        headers.set("CDN-Cache-Control", value);
        headers.set("Surrogate-Control", "max-age=300, stale-while-revalidate=600");
        headers.delete("Pragma");
        headers.delete("Expires");
        headers.set("Vary", "Accept-Encoding");
        return headers;
    }
    headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Surrogate-Control", "no-store");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:8080";
    const target = `${apiBaseUrl.replace(/\/$/, "")}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
    const hasBody = request.method !== "GET" && request.method !== "HEAD";

    try {
        const response = await fetch(target, {
            method: request.method,
            headers: proxyHeaders(request),
            body: hasBody ? request.body : undefined,
            cache: "no-store",
            credentials: "include",
            duplex: hasBody ? "half" : undefined,
            redirect: "manual",
        } as RequestInit & { duplex?: "half" });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders(response, path, request.method),
        });
    } catch (error) {
        console.error("Failed to proxy", request.nextUrl.pathname, error instanceof Error ? error.name : "Error");
        return Response.json({ code: 1, data: null, msg: "接口连接失败，请确认后端服务已启动" }, { status: 502, headers: apiSecurityHeaders });
    }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
