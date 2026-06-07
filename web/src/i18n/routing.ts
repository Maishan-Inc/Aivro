import type { Locale } from "@/i18n/messages";

export const locales = ["zh-CN", "en-US"] as const satisfies readonly Locale[];
export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: string | undefined): value is Locale {
    return value === "zh-CN" || value === "en-US";
}

export function localeFromPath(pathname: string): Locale | undefined {
    const segment = pathname.split("/").filter(Boolean)[0];
    return isLocale(segment) ? segment : undefined;
}

export function stripLocalePath(pathname: string) {
    const parts = pathname.split("/").filter(Boolean);
    if (isLocale(parts[0])) parts.shift();
    return parts.length ? `/${parts.join("/")}` : "/";
}

export function withLocalePath(path: string, locale: Locale) {
    if (!path || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("mailto:") || path.startsWith("tel:")) return path;
    const [pathAndSearch, hash = ""] = path.split("#");
    const [rawPathname, search = ""] = pathAndSearch.split("?");
    const pathname = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;
    if (isUnlocalizedPath(pathname)) return path;
    const stripped = stripLocalePath(pathname);
    return `/${locale}${stripped === "/" ? "" : stripped}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

export function isUnlocalizedPath(pathname: string) {
    return pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/admin") || pathname.startsWith("/icons") || pathname === "/logo.svg" || pathname === "/favicon.ico" || pathname.includes(".");
}

export function preferredLocale(acceptLanguage: string | null): Locale {
    const first = (acceptLanguage || "").split(",").find(Boolean)?.trim().toLowerCase() || "";
    return first.startsWith("zh") ? "zh-CN" : "en-US";
}
