export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreValue = "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate";

function adsTxtURL() {
    const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:8080";
    return `${apiBaseUrl.replace(/\/$/, "")}/ads.txt`;
}

function textHeaders(response?: Response) {
    const headers = new Headers(response?.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("Cache-Control", noStoreValue);
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Surrogate-Control", "no-store");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return headers;
}

export async function GET() {
    try {
        const response = await fetch(adsTxtURL(), { cache: "no-store" });
        return new Response(await response.text(), {
            status: response.status,
            statusText: response.statusText,
            headers: textHeaders(response),
        });
    } catch (error) {
        console.error("Failed to proxy ads.txt", error);
        return new Response("", { status: 502, headers: textHeaders() });
    }
}
