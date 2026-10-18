import { useLocaleStore } from "@/stores/use-locale-store";

// Chinese locales render 24-hour times; some of them ignore `hour12: false` for
// time-only formats, so `hourCycle` is pinned as well.
const eastAsian = new Set(["zh-CN", "zh-TW", "ja-JP"]);

function normalizeOptions(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
    if (!eastAsian.has(locale)) return options;
    return { ...options, hour12: false, hourCycle: "h23" };
}

// Dates follow the active UI locale, read from the global store so helpers outside
// components do not need locale passed down through props.
export function formatDateTime(value: string | number | Date, options: Intl.DateTimeFormatOptions = { hour12: false }) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const locale = useLocaleStore.getState().locale;
    return date.toLocaleString(locale, normalizeOptions(locale, options));
}

export function formatShortDateTime(value: string | number | Date) {
    return formatDateTime(value, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string | number | Date) {
    return formatDateTime(value, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatNumber(value: number) {
    return value.toLocaleString(useLocaleStore.getState().locale);
}
