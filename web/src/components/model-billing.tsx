"use client";

import { useState } from "react";
import { Popover } from "antd";
import { Info } from "lucide-react";
import { CreditSymbol, model3DCreditMultiplier } from "@/constant/credits";
import { useModelBilling, type ModelBillingOptions } from "@/hooks/use-model-billing";
import { useI18n } from "@/hooks/use-i18n";
import { billingUnit } from "@/lib/model-pricing";
import { cn } from "@/lib/utils";

export function ModelBilling({ className, summaryOnly = false, ...options }: ModelBillingOptions & { className?: string; summaryOnly?: boolean }) {
    const { model, kind, model3D } = options;
    const { cost, billingType, quantity, credits, unavailable } = useModelBilling(options);
    const { tr, locale } = useI18n();
    const [open, setOpen] = useState(false);
    const tokenBilling = billingType === "token";
    const format = (value: number) => value.toLocaleString(locale);
    const unitPrice = cost ? `${format(cost.credits)} ${tr(billingUnit(billingType))}` : tr(unavailable);
    const summary = credits === null ? tr(unavailable) : tokenBilling ? unitPrice : tr("预计 {0} 点").replace("{0}", format(credits));
    if (summaryOnly) return <span data-model-billing data-i18n-skip className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs", className)}><CreditSymbol aria-hidden="true" className="shrink-0" /><span className="min-w-0 whitespace-normal break-words text-left tabular-nums" aria-live="polite">{summary}</span></span>;
    const explanation = tokenBilling ? "先预扣额度，完成后按输入和输出词元结算；未返回用量时按估算结算。" : kind === "image" ? "按生成张数计费，尺寸和质量不影响当前费用。" : kind === "video" ? "按次计费，时长和清晰度不影响当前费用。" : kind === "model3d" ? "费用包含数量、网格质量、纹理、PBR 材质和目标面数，最终向下取整。" : "每次请求按固定算力点计费。";

    return <span className={cn("inline-flex min-w-0 max-w-full items-center text-xs", className)} data-i18n-skip data-canvas-no-zoom onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}>
        <Popover open={open} onOpenChange={setOpen} trigger="click" placement="top" arrow={false} zIndex={1300} styles={{ root: { maxWidth: "calc(100vw - 24px)" } }} content={
            <div data-i18n-skip data-canvas-no-zoom className="w-72 max-w-[calc(100vw-48px)] space-y-3 text-xs" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
                <div><div className="mb-1 font-medium">{tr("当前模型计费")}</div><div className="break-all opacity-60">{model}</div></div>
                {cost ? <>
                    <dl className="space-y-2">
                        <div className="flex justify-between gap-3"><dt className="opacity-60">{tr("计费方式")}</dt><dd>{tr(tokenBilling ? "按词元计费" : "按次计费")}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="opacity-60">{tr("基础单价")}</dt><dd className="text-right tabular-nums">{unitPrice}</dd></div>
                        {!tokenBilling || quantity > 1 ? <div className="flex justify-between gap-3"><dt className="opacity-60">{tr("生成数量")}</dt><dd className="tabular-nums">{format(quantity)}</dd></div> : null}
                        {model3D ? <div className="flex justify-between gap-3"><dt className="opacity-60">{tr("参数倍率")}</dt><dd className="tabular-nums">× {format(model3DCreditMultiplier(model3D))}</dd></div> : null}
                        {!tokenBilling && credits !== null ? <div className="flex justify-between gap-3 font-medium"><dt>{tr("预计消耗")}</dt><dd>{format(credits)} {tr("算力点")}</dd></div> : null}
                    </dl>
                    <p className="leading-5 opacity-60">{tr(explanation)}</p>
                    <p className="leading-5 opacity-60">{tr("当前站内请求按标准价计费。")}{" "}{tr("实际扣费以生成时的价格和算力流水为准。")}</p>
                </> : <p className="opacity-60">{tr(unavailable)}</p>}
            </div>
        }>
            <button type="button" data-model-billing className="inline-flex min-h-8 min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-inherit opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" aria-label={`${tr("查看计费详情")} · ${summary}`} aria-expanded={open}>
                <CreditSymbol aria-hidden="true" className="shrink-0" /><span className="min-w-0 break-words tabular-nums" aria-live="polite">{summary}</span><Info size={12} className="shrink-0" aria-hidden="true" />
            </button>
        </Popover>
    </span>;
}
