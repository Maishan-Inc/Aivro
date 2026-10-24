import { stripLocalePath } from "@/i18n/routing";

const pagePattern = /^\/(assets|asset-library|image|video|model-3d|prompts|models|developers|pricing(\/success)?|terms|privacy|login|forgot-password|metamask-email|profile\/setup|canvas(\/[A-Za-z0-9_-]+|\/community\/[A-Za-z0-9_-]+)?|share\/workflows\/[A-Za-z0-9_-]+|console(\/(workflows|wallet|shares|profile|community|api-keys))?|admin(\/(database|workflow-community|settings|credit-logs|users|ads|request-logs|prompts|audit-logs|assets|plans))?)$/;
const sharePattern = /^\/[a-z0-9]{3,24}\/[a-z0-9]{1,40}$/;

export function safeRedirect(value: string) {
    try {
        const decoded = decodeURIComponent(value);
        if (!value.startsWith("/") || decoded.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(decoded)) return "/";
        const url = new URL(value, "https://aivro.invalid");
        const pathname = decodeURIComponent(url.pathname);
        if (url.origin !== "https://aivro.invalid" || pathname.includes("%")) return "/";
        const page = stripLocalePath(pathname);
        if (/^\/(api|_next|icons)(\/|$)/.test(page)) return "/";
        if (page !== "/" && !pagePattern.test(page) && !sharePattern.test(page)) return "/";
        return url.pathname + url.search + url.hash;
    } catch { return "/"; }
}
