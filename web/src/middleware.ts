import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, isUnlocalizedPath, localeFromPath, preferredLocale, stripLocalePath } from "@/i18n/routing";

const noStoreValue = "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate";

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (isCacheableBuildAsset(pathname)) return NextResponse.next();
    if (isUnlocalizedPath(pathname)) return withNoStore(NextResponse.next());

    const locale = localeFromPath(pathname);
    if (!locale) {
        const nextLocale = pathname === "/" ? preferredLocale(request.headers.get("accept-language")) : defaultLocale;
        const target = request.nextUrl.clone();
        target.pathname = `/${nextLocale}${pathname === "/" ? "" : pathname}`;
        target.search = search;
        return withNoStore(NextResponse.redirect(target));
    }

    const targetPath = stripLocalePath(pathname);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = targetPath;
    rewriteUrl.search = search;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-aivro-locale", locale);
    requestHeaders.set("x-aivro-pathname", pathname);
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    response.headers.set("x-aivro-locale", locale);
    return withNoStore(response);
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
    return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") || pathname === "/logo.svg" || pathname === "/favicon.ico";
}

export const config = {
    matcher: ["/((?!_next/static|icons|logo.svg|favicon.ico).*)"],
};
