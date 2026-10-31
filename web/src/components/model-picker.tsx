"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";
import { ModelLogo } from "./model-logo";
import { ModelBilling } from "./model-billing";
import { useI18n } from "@/hooks/use-i18n";
import { useModelBilling, type ModelBillingOptions } from "@/hooks/use-model-billing";
import { billingUnit } from "@/lib/model-pricing";
import type { GenerationKind } from "@/constant/credits";

type ModelPickerProps = {
    config: AiConfig;
    kind: GenerationKind;
    count?: ModelBillingOptions["count"];
    model3D?: ModelBillingOptions["model3D"];
    value?: string;
    onChange: (model: string) => void;
    models?: string[];
    className?: string;
    fullWidth?: boolean;
    showBilling?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

export function ModelPicker({ config, kind, count, model3D, value, onChange, models, className, fullWidth = false, showBilling = true, placeholder = "选择模型", onMissingConfig }: ModelPickerProps) {
    const { tr } = useI18n();
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const options = useMemo(() => Array.from(new Set((models || config.models).filter(Boolean))), [config.models, models]);
    const current = value || "";

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return (
        <Select
            open={open}
            value={current}
            onOpenChange={(nextOpen) => {
                if (nextOpen && !options.length) {
                    onMissingConfig?.();
                    return;
                }
                if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
                setOpen(nextOpen);
            }}
            onValueChange={onChange}
        >
            <SelectTrigger
                className={cn(
                    "canvas-composer-model-picker min-h-8 min-w-0 max-w-full shrink-0 justify-start gap-2 rounded-full border border-input bg-transparent px-3 py-1.5 text-sm font-normal shadow-sm transition-colors data-[size=default]:h-auto",
                    fullWidth ? "w-full" : "w-max",
                    "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                    className,
                )}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                data-i18n-skip
                title={current || tr(placeholder)}
            >
                <ModelIcon model={current} />
                <span className="canvas-model-picker-text w-[190px] min-w-0 flex-auto truncate text-left">{current || tr(placeholder)}</span>
                {showBilling ? <ModelBilling summaryOnly model={current} kind={kind} count={count} model3D={model3D} video={config} className="max-w-[calc(100%_-_72px)] shrink-0 opacity-70" /> : null}
            </SelectTrigger>
            <SelectContent
                data-canvas-no-zoom
                className="z-[1200] w-[max(20rem,var(--radix-select-trigger-width))] max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl [&_[data-position=popper]]:!min-w-0"
                position="popper"
                align="start"
                side="bottom"
                sideOffset={6}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {options.length ? (
                    options.map((model) => (
                        <SelectItem key={model} value={model} textValue={model} className="py-2 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1">
                            <ModelLabel model={model} kind={kind} video={config} />
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value="__empty__" disabled>
                        管理员尚未配置可用模型
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
    );
}

function ModelLabel({ model, kind, video }: Pick<ModelBillingOptions, "model" | "kind" | "video">) {
    const { cost, billingType, unavailable } = useModelBilling({ model, kind, video });
    const { tr, locale } = useI18n();
    return (
        <span className="flex min-w-0 items-center gap-2" data-i18n-skip>
            <ModelIcon model={model} />
            <span className="min-w-0 space-y-0.5">
                <span className="block truncate" title={model}>{model}</span>
                <span className="block text-[11px] leading-4 opacity-60">{cost ? `${tr("基础单价")} ${cost.credits.toLocaleString(locale)} ${tr(billingUnit(billingType))}` : tr(unavailable)}</span>
            </span>
        </span>
    );
}

export function ModelIcon({ model }: { model: string }) {
    const icon = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts?.find((item) => item.model === model)?.icon);
    return <ModelLogo icon={icon || resolveModelIcon(model)} name={model} size={16} />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok") || name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek") || name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm") || name.includes("glm")) return "/icons/glm.svg";
    return "";
}
