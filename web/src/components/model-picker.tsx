"use client";

import { memo, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Grid, Input, Select, type RefSelectProps } from "antd";
import { Building2, ChevronDown, Search } from "lucide-react";
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
    onOpenChange?: (open: boolean) => void;
    models?: string[];
    className?: string;
    fullWidth?: boolean;
    showBilling?: boolean;
    billingLabel?: string;
    placeholder?: string;
    onMissingConfig?: () => void;
    disabled?: boolean;
};

export function ModelPicker({ config, kind, count, model3D, value, onChange, onOpenChange, models, className, fullWidth = false, showBilling = true, billingLabel, placeholder = "选择模型", onMissingConfig, disabled = false }: ModelPickerProps) {
    const { tr, locale } = useI18n();
    const mobile = Grid.useBreakpoint().xs;
    const itemHeight = mobile ? 56 : 64;
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
            const credits = second ? second.credits : cost?.credits;
            const billingType = second ? "second" : kind === "text" && cost?.billingType === "token" ? "token" : "fixed";
            const vendor = cost?.vendor || guessed.vendor;
            const priceLabel = billingLabel ? tr(billingLabel) : credits !== undefined ? `${tr("基础单价")} ${credits.toLocaleString(locale)} ${tr(billingUnit(billingType))}` : tr("该模型尚未配置计费");
            return { value: model, label: model, vendor, icon: cost?.icon || guessed.icon, tags: cost?.tags, zeroDayExpiresAt: cost?.zeroDayExpiresAt, priceLabel, search: `${model} ${tr(vendor)}`.toLowerCase() };
        });
    }, [channel, config, kind, models, billingLabel, tr, locale]);
    const vendors = useMemo(() => Array.from(new Set(options.map((item) => item.vendor).filter(Boolean))).sort(), [options]);
    const filtered = useMemo(() => options.filter((item) => (!vendor || item.vendor === vendor) && (!word || item.search.includes(word))), [options, vendor, word]);
    const current = value || "";
    const selected = options.find((item) => item.value === current);

    useEffect(() => {
        onOpenChange?.(open && !disabled);
        return () => onOpenChange?.(false);
    }, [open, disabled, onOpenChange]);
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return <div className="contents" onPointerDown={(event) => event.stopPropagation()}><Select
        ref={selectRef}
        open={open && !disabled}
        disabled={disabled}
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
            {showBilling ? billingLabel ? <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{tr(billingLabel)}</span> : <ModelBilling summaryOnly model={current} kind={kind} count={count} model3D={model3D} video={config} className="shrink-0 text-muted-foreground" /> : null}
        </span>}
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
        listHeight={itemHeight * 6}
        listItemHeight={itemHeight}
        popupMatchSelectWidth={mobile ? 320 : 420}
        placement="bottomLeft"
        classNames={{ popup: { root: styles.popup } }}
        styles={{ popup: { listItem: { height: itemHeight, minHeight: itemHeight, padding: mobile ? "6px 8px" : "8px 10px", boxSizing: "border-box" } } }}
        notFoundContent={<span className="text-xs text-muted-foreground">{tr("没有匹配的模型")}</span>}
        popupRender={(menu) => <div data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2 border-b border-border/60 px-1 pb-2 pt-1">
                <Select size="small" value={vendor} onChange={setVendor} aria-label={tr("筛选模型厂商")} className="w-32 shrink-0" popupMatchSelectWidth={180} styles={{ popup: { root: { zIndex: 1210 } } }} options={[
                    { value: "", label: <span className="flex min-w-0 items-center gap-2" data-i18n-skip><Building2 className="size-4 shrink-0" /><span className="truncate">{tr("全部厂商")}</span></span> },
                    ...vendors.map((item) => ({ value: item, title: tr(item), label: <span className="flex min-w-0 items-center gap-2" data-i18n-skip><ModelLogo icon={options.find((option) => option.vendor === item && option.icon)?.icon} name={item} size={16} /><span className="truncate">{tr(item)}</span></span> })),
                ]} />
                <Input size="small" allowClear prefix={<Search className="size-3" />} placeholder={tr("搜索模型")} aria-label={tr("搜索模型")} value={keyword} onChange={(event) => setKeyword(event.target.value)} className="min-w-0 flex-1" onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") { setOpen(false); selectRef.current?.focus(); }
                    if (event.key === "ArrowDown") { event.preventDefault(); selectRef.current?.focus(); }
                }} />
            </div>
            {menu}
        </div>}
        optionRender={({ data: item }) => <ModelOption item={item} />}
    /></div>;
}

// 滚动时仅挂载可见行，价格与搜索文本在列表变化时计算。
const ModelOption = memo(function ModelOption({ item }: { item: { value: string; icon: string; tags?: string[]; zeroDayExpiresAt?: string; priceLabel: string } }) {
    return <span className="flex h-full min-w-0 items-center gap-2" data-i18n-skip>
        <ModelLogo icon={item.icon} name={item.value} size={22} />
        <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-5" title={item.value}>{item.value}</span>
            <span className="mt-1 flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs leading-5 text-muted-foreground" title={item.priceLabel}>{item.priceLabel}</span><ModelTags tags={item.tags} limit={2} zeroDayExpiresAt={item.zeroDayExpiresAt} /></span>
        </span>
    </span>;
});

export function ModelIcon({ model }: { model: string }) {
    const icon = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts?.find((item) => item.model === model)?.icon);
    return <ModelLogo icon={icon || guessModelVendor(model).icon} name={model} size={16} />;
}
