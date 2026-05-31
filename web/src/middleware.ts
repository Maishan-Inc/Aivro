import { NextResponse, type NextRequest } from "next/server";

const noStoreValue = "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate";

export function middleware(request: NextRequest) {
    const response = NextResponse.next();
    if (isCacheableBuildAsset(request.nextUrl.pathname)) return response;
    response.headers.set("Cache-Control", noStoreValue);
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Vary", "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding, Cookie");
    return response;
}

function isCacheableBuildAsset(pathname: string) {
    return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") || pathname === "/logo.svg" || pathname === "/favicon.ico";
}

export const config = {
    matcher: ["/((?!_next/static|icons/|logo.svg|favicon.ico).*)"],
};
