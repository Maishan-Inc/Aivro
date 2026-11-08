"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Flame, Focus, Scan, Sparkle, Sparkles, Zap } from "lucide-react";
import { modelTags, zeroDayTagDescription } from "@/constant/model-tags";
import { useI18n } from "@/hooks/use-i18n";

const icons = { "badge-percent": BadgePercent, scan: Scan, sparkles: Sparkles, sparkle: Sparkle, flame: Flame, zap: Zap, focus: Focus };

export function ModelTags({ tags, limit = 3, zeroDayExpiresAt }: { tags?: string[]; limit?: number; zeroDayExpiresAt?: string }) {
    const { tr } = useI18n();
    const [at, setAt] = useState(Date.now);
    const expires = Date.parse(zeroDayExpiresAt || "");
    const hasZeroDay = Boolean(tags?.includes("0day"));
    useEffect(() => {
        if (!hasZeroDay || !Number.isFinite(expires)) return;
        const timer = window.setTimeout(() => setAt(Date.now()), Math.max(0, Math.min(2147483647, expires - Date.now() + 25)));
        return () => window.clearTimeout(timer);
    }, [hasZeroDay, expires]);
    const visible = tags?.filter((value) => value !== "0day" || !zeroDayExpiresAt || expires > at);
    return <span className="inline-flex shrink-0 items-center gap-1" data-i18n-skip>{visible?.slice(0, limit).map((value) => {
        const tag = modelTags.find((item) => item.value === value);
        if (!tag) return null;
        const Icon = icons[tag.icon];
        return <span key={value} title={value === "0day" ? tr(zeroDayTagDescription) : undefined} className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium leading-4 text-foreground"><Icon className="size-3" aria-hidden="true" />{tr(tag.label)}</span>;
    })}{visible && visible.length > limit ? <span className="text-xs text-muted-foreground" title={visible.map((value) => tr(modelTags.find((item) => item.value === value)?.label || value)).join(" · ")}>+{visible.length - limit}</span> : null}</span>;
}
