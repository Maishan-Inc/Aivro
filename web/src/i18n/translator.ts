import type { Locale } from "@/i18n/messages";

type Dictionary = Record<string, string>;
export type LocaleDictionaries = Partial<Record<Locale, Dictionary>>;

const hasChinese = /[\u3400-\u9fff]/;
const cjkRun = /[\u3400-\u9fff]/;

// Keys that contain placeholders match whole strings so captured values can be
// reordered, e.g. "已导入 {0} 个素材" -> "Imported {0} assets".
type PatternEntry = { regex: RegExp; template: string };

type CompiledLocale = {
    exact: Map<string, string>;
    patterns: PatternEntry[];
    // First character -> keys starting with it, longest first, for tiling.
    byFirstChar: Map<string, [string, string][]>;
};

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(dictionary: Dictionary): CompiledLocale {
    const entries = Object.entries(dictionary).filter(([key]) => key);
    entries.sort((a, b) => b[0].length - a[0].length);

    const exact = new Map<string, string>();
    const patterns: PatternEntry[] = [];
    const byFirstChar = new Map<string, [string, string][]>();

    for (const [key, value] of entries) {
        if (key.includes("{")) {
            const source = key
                .split(/\{\d+\}/)
                .map((part) => escapeRegExp(part))
                .join("(.+?)");
            patterns.push({ regex: new RegExp(`^${source}$`, "s"), template: value });
            continue;
        }
        exact.set(key, value);
        // Single-character labels (高/低/中/张) only resolve as whole values so they
        // never corrupt longer sentences.
        if (key.length === 1) continue;
        const first = key[0];
        const bucket = byFirstChar.get(first);
        if (bucket) bucket.push([key, value]);
        else byFirstChar.set(first, [[key, value]]);
    }

    return { exact, patterns, byFirstChar };
}

export function createTranslator(dictionaries: LocaleDictionaries) {
    const compiled = new Map<Locale, CompiledLocale>();
    for (const [locale, dictionary] of Object.entries(dictionaries) as [Locale, Dictionary | undefined][]) {
        if (dictionary && Object.keys(dictionary).length) compiled.set(locale, compile(dictionary));
    }

    return function translate(value: string, locale: Locale): string {
        // Simplified Chinese is the source language, so it needs no lookup.
        if (locale === "zh-CN" || !value) return value;
        const table = compiled.get(locale);
        if (!table) return value;

        const leading = value.match(/^\s*/)?.[0] || "";
        const trailing = value.match(/\s*$/)?.[0] || "";
        const body = value.trim();
        if (!body) return value;

        const exact = table.exact.get(body);
        if (exact) return `${leading}${exact}${trailing}`;
        if (!hasChinese.test(body)) return value;

        for (const pattern of table.patterns) {
            const match = body.match(pattern.regex);
            if (!match) continue;
            const translated = pattern.template.replace(/\{(\d+)\}/g, (_, index: string) => match[Number(index) + 1] ?? "");
            return `${leading}${translated}${trailing}`;
        }

        // Runtime-composed text ("注册" + " Aivro，即代表...") is translated by tiling the
        // string with known keys. Anything that cannot be fully covered is left as
        // written: splicing unrelated words would produce nonsense such as
        // "第 3 imagesImage generationFailed".
        const tiled = tile(body, table, locale);
        return tiled === undefined ? value : `${leading}${tiled}${trailing}`;
    };
}

function tile(body: string, table: CompiledLocale, locale: Locale) {
    let output = "";
    let index = 0;
    while (index < body.length) {
        const bucket = table.byFirstChar.get(body[index]);
        let matched = false;
        if (bucket) {
            for (const [key, translated] of bucket) {
                if (body.startsWith(key, index)) {
                    output += translated;
                    index += key.length;
                    matched = true;
                    break;
                }
            }
        }
        if (matched) continue;

        // Consume the run of non-Chinese characters verbatim, applying counters so
        // "3 天" becomes "3 days".
        let end = index;
        while (end < body.length && !cjkRun.test(body[end])) end += 1;
        if (end === index) return undefined; // An unknown Chinese run: leave the string alone.
        output += applyNumericRules(body.slice(index, end), locale);
        index = end;
    }
    return output;
}

// Runtime-composed counts and durations. Traditional Chinese keeps its own
// characters, so it only needs the locale-specific unit words.
type NumericLocale = Exclude<Locale, "zh-CN">;

const numericRules: Record<NumericLocale, [RegExp, string][]> = {
    "zh-TW": [
        [/(\d+)\s*张/g, "$1 張"],
        [/(\d+)\s*个/g, "$1 個"],
        [/(\d+)\s*条/g, "$1 條"],
        [/(\d+)\s*次/g, "$1 次"],
        [/(\d+)\s*天/g, "$1 天"],
        [/(\d+)\s*秒/g, "$1 秒"],
    ],
    "en-US": [
        [/(\d+)\s*分\s*(\d+)\s*秒/, "$1m $2s"],
        [/(\d+)\s*张/, "$1 images"],
        [/(\d+)\s*个/, "$1 items"],
        [/(\d+)\s*条/, "$1 items"],
        [/(\d+)\s*次/, "$1 times"],
        [/(\d+)\s*天/, "$1 days"],
        [/(\d+)\s*秒/, "$1s"],
    ],
    "ja-JP": [
        [/(\d+)\s*张/, "$1 枚"],
        [/(\d+)\s*个/, "$1 件"],
        [/(\d+)\s*条/, "$1 件"],
        [/(\d+)\s*次/, "$1 回"],
        [/(\d+)\s*天/, "$1 日"],
        [/(\d+)\s*秒/, "$1 秒"],
    ],
    "ko-KR": [
        [/(\d+)\s*张/, "$1장"],
        [/(\d+)\s*个/, "$1개"],
        [/(\d+)\s*条/, "$1개"],
        [/(\d+)\s*次/, "$1회"],
        [/(\d+)\s*天/, "$1일"],
        [/(\d+)\s*秒/, "$1초"],
    ],
    "fr-FR": [
        [/(\d+)\s*张/, "$1 images"],
        [/(\d+)\s*个/, "$1 éléments"],
        [/(\d+)\s*条/, "$1 éléments"],
        [/(\d+)\s*次/, "$1 fois"],
        [/(\d+)\s*天/, "$1 jours"],
        [/(\d+)\s*秒/, "$1 s"],
    ],
};

function applyNumericRules(value: string, locale: Locale) {
    if (!hasChinese.test(value) || locale === "zh-CN") return value;
    let output = value;
    for (const [regex, replacement] of numericRules[locale]) output = output.replace(regex, replacement);
    return output;
}

// Exposed for tests and tooling: counts how many Chinese characters a value still has.
export function chineseRemainder(value: string) {
    return value.match(/[\u3400-\u9fff]+/g) || [];
}
