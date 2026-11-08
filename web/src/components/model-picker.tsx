"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Input, Select, type RefSelectProps } from "antd";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";
import { ModelLogo } from "./model-logo";
import { ModelBilling } from "./model-billing";
import { ModelTags } from "./model-tags";
import { useI18n } from "@/hooks/use-i18n";
import type { ModelBillingOptions } from "@/hooks/use-model-billing";
import { billingUnit, guessModelVendor } from "@/lib/model-pricing";
import { resolveVideoConfig } from "@/lib/video-models";
import type { GenerationKind } from "@/constant/credits";
import styles from "./model-picker.module.css";

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
    billingLabel?: string;
    placeholder?: string;
    onMissingConfig?: () => void;
};

export function ModelPicker({ config, kind, count, model3D, value, onChange, models, className, fullWidth = false, showBilling = true, billingLabel, placeholder = "选择模型", onMissingConfig }: ModelPickerProps) {
    const { tr, locale } = useI18n();
    const channel = useConfigStore((state) => state.publicSettings?.modelChannel);
    const pickerId = useId();
    const selectRef = useRef<RefSelectProps>(null);
    const [open, setOpen] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [vendor, setVendor] = useState("");
    const word = useDeferredValue(keyword.trim().toLowerCase());
    const options = useMemo(() => {
        const prices = new Map(channel?.modelCosts.map((item) => [item.model, item]));
        return Array.from(new Set((models || config.models).filter(Boolean))).map((model) => {
            const cost = prices.get(model);
            const guessed = guessModelVendor(model);
            const second = kind === "video" && resolveVideoConfig(config, model).videoBillingType === "second" && cost?.videoSecondPrice;
            return { value: model, label: model, vendor: cost?.vendor || guessed.vendor, icon: cost?.icon || guessed.icon, tags: cost?.tags, credits: second ? second.credits : cost?.credits, billingType: second ? "second" : kind === "text" && cost?.billingType === "token" ? "token" : "fixed" };
        });
    }, [channel, config, kind, models]);
    const vendors = useMemo(() => Array.from(new Set(options.map((item) => item.vendor).filter(Boolean))).sort(), [options]);
    const filtered = useMemo(() => options.filter((item) => (!vendor || item.vendor === vendor) && (!word || `${item.value} ${tr(item.vendor)}`.toLowerCase().includes(word))), [options, tr, vendor, word]);
    const current = value || "";
    const selected = options.find((item) => item.value === current);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return <Select
        ref={selectRef}
        open={open}
        value={current || undefined}
        showSearch={false}
        aria-label={tr(placeholder)}
        data-i18n-skip
        title={current || tr(placeholder)}
        className={cn("canvas-composer-model-picker", styles.picker, className)}
        style={{ width: fullWidth ? "100%" : showBilling ? 296 : 250, maxWidth: fullWidth || showBilling ? "100%" : undefined, height: 32.84 }}
        suffixIcon={<ChevronDown className="canvas-select-chevron size-3.5 pointer-events-none" />}
        prefix={<ModelLogo icon={selected?.icon || guessModelVendor(current).icon} name={current} size={16} />}
        placeholder={tr(placeholder)}
        labelRender={() => <span className="flex min-w-0 flex-1 items-center gap-2" data-i18n-skip>
            <span className={cn("canvas-model-picker-text min-w-0 truncate text-left", showBilling ? "flex-1" : "w-[190px]")}>{current}</span>
            {showBilling ? billingLabel ? <span className="shrink-0 whitespace-nowrap text-xs opacity-70">{tr(billingLabel)}</span> : <ModelBilling summaryOnly model={current} kind={kind} count={count} model3D={model3D} video={config} className="shrink-0 opacity-70" /> : null}
        </span>}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onOpenChange={(nextOpen) => {
            if (nextOpen && !options.length) { onMissingConfig?.(); return; }
            if (nextOpen) {
                setKeyword(""); setVendor("");
                window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
            }
            setOpen(nextOpen);
        }}
        onChange={(model) => { onChange(model); setOpen(false); }}
        options={filtered}
        virtual
        listHeight={336}
        listItemHeight={56}
        popupMatchSelectWidth={380}
        placement="bottomLeft"
        classNames={{ popup: { root: styles.popup } }}
        styles={{ popup: { listItem: { height: 56, minHeight: 56, padding: "6px 8px" } } }}
        notFoundContent={<span className="text-xs text-muted-foreground">{tr("没有匹配的模型")}</span>}
        popupRender={(menu) => <div data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2 border-b border-border/60 px-1 pb-2 pt-1">
                <Input size="small" allowClear prefix={<Search className="size-3" />} placeholder={tr("搜索模型")} aria-label={tr("搜索模型")} value={keyword} onChange={(event) => setKeyword(event.target.value)} className="min-w-0 flex-1" onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") { setOpen(false); selectRef.current?.focus(); }
                    if (event.key === "ArrowDown") { event.preventDefault(); selectRef.current?.focus(); }
                }} />
                <Select size="small" value={vendor} onChange={setVendor} aria-label={tr("筛选模型厂商")} className="w-32 shrink-0" popupMatchSelectWidth={180} styles={{ popup: { root: { zIndex: 1210 } } }} options={[{ value: "", label: tr("全部厂商") }, ...vendors.map((item) => ({ value: item, label: tr(item) }))]} />
            </div>
            {menu}
        </div>}
        optionRender={({ data: item }) => <span className="flex h-full min-w-0 items-center gap-2" data-i18n-skip>
            <ModelLogo icon={item.icon} name={item.vendor || item.value} size={18} />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-[12px] leading-5" title={item.value}>{item.value}</span><ModelTags tags={item.tags} /></span>
                <span className="block truncate text-[11px] leading-4 opacity-60">{billingLabel ? tr(billingLabel) : item.credits !== undefined ? `${tr("基础单价")} ${item.credits.toLocaleString(locale)} ${tr(billingUnit(item.billingType))}` : tr("该模型尚未配置计费")}</span>
            </span>
        </span>}
    />;
}

export function ModelIcon({ model }: { model: string }) {
    const icon = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts?.find((item) => item.model === model)?.icon);
    return <ModelLogo icon={icon || guessModelVendor(model).icon} name={model} size={16} />;
}
