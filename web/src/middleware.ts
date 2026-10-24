import { NextResponse, type NextRequest } from "next/server";
import { apiSecurityHeaders, pageContentSecurityPolicy } from "@/lib/security-headers";

import { defaultLocale, isUnlocalizedPath, localeFromPath, preferredLocale, stripLocalePath } from "@/i18n/routing";

const noStoreValue = "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate";

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (isCacheableBuildAsset(pathname)) return NextResponse.next();
    const requestHeaders = new Headers(request.headers);
    const nonce = btoa(crypto.randomUUID());
    const csp = pathname.startsWith("/api/") ? apiSecurityHeaders["Content-Security-Policy"] : pageContentSecurityPolicy(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const secureResponse = (response: NextResponse, cacheHome = false) => {
        for (const [key, value] of Object.entries(apiSecurityHeaders)) response.headers.set(key, value);
        response.headers.set("Content-Security-Policy", csp);
        if (request.nextUrl.protocol === "https:") response.headers.set("Strict-Transport-Security", "max-age=31536000");
        if (pathname.startsWith("/api/")) return response;
        return cacheHome ? withPublicHomeCache(response) : withNoStore(response);
    };
    if (isUnlocalizedPath(pathname)) return secureResponse(NextResponse.next({ request: { headers: requestHeaders } }));

    const locale = localeFromPath(pathname);
    if (!locale) {
        const nextLocale = pathname === "/" ? preferredLocale(request.headers.get("accept-language")) : defaultLocale;
        const target = request.nextUrl.clone();
        target.pathname = `/${nextLocale}${pathname === "/" ? "" : pathname}`;
        target.search = search;
        return secureResponse(NextResponse.redirect(target));
    }

    const targetPath = stripLocalePath(pathname);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = targetPath;
    rewriteUrl.search = search;
    requestHeaders.set("x-aivro-locale", locale);
    requestHeaders.set("x-aivro-pathname", pathname);
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    response.headers.set("x-aivro-locale", locale);
    return secureResponse(response, stripLocalePath(pathname) === "/");
}

function withPublicHomeCache(response: NextResponse) {
    const value = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
    response.headers.set("Cache-Control", value);
    response.headers.set("CDN-Cache-Control", value);
    response.headers.set("Surrogate-Control", "max-age=3600, stale-while-revalidate=86400");
    response.headers.delete("Pragma");
    response.headers.delete("Expires");
    response.headers.set("Vary", "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding");
    return response;
}

function withNoStore(response: NextResponse) {
    response.headers.set("Cache-Control", noStoreValue);
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Vary", "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding, Cookie, Accept-Language");
    return response;
}

function isCacheableBuildAsset(pathname: string) {
    return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") || pathname.startsWith("/showcase/") || pathname === "/logo.svg" || pathname === "/logo-mail-dark.png" || pathname === "/logo-mail-light.png" || pathname === "/favicon.ico";
}

export const config = {
    matcher: ["/((?!_next/static|icons|showcase|logo.svg|logo-mail-dark.png|logo-mail-light.png|favicon.ico).*)"],
};
