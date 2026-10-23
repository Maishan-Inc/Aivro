export const apiSecurityHeaders = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function pageContentSecurityPolicy(nonce: string) {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "font-src 'self' data:",
        `connect-src 'self' blob: data: https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.google-analytics.com https://*.googletagmanager.com${process.env.NODE_ENV === "development" ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
        "frame-src 'self' https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
        "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ].join("; ");
}
