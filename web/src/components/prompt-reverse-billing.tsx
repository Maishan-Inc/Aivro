"use client";

import { useI18n } from "@/hooks/use-i18n";
import type { PromptReverseItem } from "@/services/api/explore";

export function PromptReverseBilling({ items, credits, settled }: { items: PromptReverseItem[]; credits: number; settled: boolean }) {
    const { tr } = useI18n();
    return <div className="space-y-2 text-sm">
        <ol className="space-y-2">{items.map((item, index) => <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
            <span className="min-w-0 break-all" data-i18n-skip>{index + 1}. {item.name}</span>
            <span className="min-w-0 break-words text-muted-foreground" data-i18n-skip>{item.status === "succeeded" ? `${item.tokens} token · ${tr("{0} 点").replace("{0}", String(item.credits))}` : tr(item.status === "failed" ? item.error || "反推失败" : "等待处理")}</span>
        </li>)}</ol>
        <p className="flex justify-between gap-4 font-medium"><span>{tr(settled ? "统一扣费" : "待统一扣费")}</span><span data-i18n-skip>{tr("{0} 点").replace("{0}", String(settled ? credits : items.reduce((sum, item) => sum + item.credits, 0)))}</span></p>
    </div>;
}
