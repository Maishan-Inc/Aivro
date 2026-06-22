import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
    params: Promise<{ path: string[] }>;
};

function proxyHeaders(request: NextRequest) {
    const headers = new Headers(request.headers);
    for (const key of ["host", "content-length", "connection", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"]) {
        headers.delete(key);
    }
    const clientIP = (request as NextRequest & { ip?: string }).ip?.trim();
    if (clientIP) {
        headers.set("x-forwarded-for", clientIP);
        headers.set("x-real-ip", clientIP);
    }
    headers.set("x-forwarded-host", request.nextUrl.host);
    headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
    return headers;
}

function responseHeaders(response: Response, path: string[], method: string) {
    const headers = new Headers(response.headers);
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
    if (setCookies.length) {
        headers.delete("set-cookie");
        for (const cookie of setCookies) headers.append("set-cookie", cookie);
    }
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    if (method === "GET" && path.join("/") === "prompts") {
        headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        headers.set("CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        headers.set("Surrogate-Control", "max-age=300, stale-while-revalidate=600");
        headers.delete("Pragma");
        headers.delete("Expires");
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
        console.error("Failed to proxy", request.nextUrl.pathname, error);
        return Response.json({ code: 1, data: null, msg: "接口连接失败，请确认后端服务已启动" }, { status: 502 });
    }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
