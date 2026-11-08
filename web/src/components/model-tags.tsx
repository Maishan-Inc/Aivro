"use client";

import { BadgePercent, Flame, Focus, Scan, Sparkle, Sparkles, Zap } from "lucide-react";
import { modelTags } from "@/constant/model-tags";
import { useI18n } from "@/hooks/use-i18n";

const icons = { "badge-percent": BadgePercent, scan: Scan, sparkles: Sparkles, sparkle: Sparkle, flame: Flame, zap: Zap, focus: Focus };

export function ModelTags({ tags, limit = 3 }: { tags?: string[]; limit?: number }) {
    const { tr } = useI18n();
    return <span className="inline-flex shrink-0 items-center gap-1" data-i18n-skip>{tags?.slice(0, limit).map((value) => {
        const tag = modelTags.find((item) => item.value === value);
        if (!tag) return null;
        const Icon = icons[tag.icon];
        return <span key={value} className="inline-flex items-center gap-0.5 whitespace-nowrap rounded border border-border/60 bg-muted/70 px-1 py-0.5 text-[10px] font-medium leading-none text-foreground/80"><Icon className="size-2.5" aria-hidden="true" />{tr(tag.label)}</span>;
    })}{tags && tags.length > limit ? <span className="text-[10px] text-muted-foreground" title={tags.map((value) => tr(modelTags.find((item) => item.value === value)?.label || value)).join(" · ")}>+{tags.length - limit}</span> : null}</span>;
}
