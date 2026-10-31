"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty, Input, Select, Skeleton } from "antd";
import { Box, Building2, Image, Layers, Search, Type, Video } from "lucide-react";

import { ModelLogo } from "@/components/model-logo";
import { apiCostOf, billingUnit, capabilityLabels, capabilityOf, planCostOf, planPricingCodes } from "@/lib/model-pricing";
import { useI18n } from "@/hooks/use-i18n";
import { useCopyText } from "@/hooks/use-copy-text";
import { useConfigStore } from "@/stores/use-config-store";
import type { AdminModelCost } from "@/services/api/admin";
import styles from "./model-pricing-table.module.css";

type PricingRow = AdminModelCost & { capability?: string };
const capabilityIcons = { image: Image, video: Video, text: Type, model3d: Box };

// 前台定价表与管理后台预览共用；后台预览直接传入当前编辑中的行，
// 需要模型类型时由调用方按后台的模型范围补上 capability。
// 标准价、会员价和 API 价在同一张表里直接展示，不再切换视图。
export function ModelPricingTable({ preview }: { preview?: PricingRow[] }) {
    const { tr } = useI18n();
    const copyText = useCopyText();
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const [keyword, setKeyword] = useState("");
    const [vendor, setVendor] = useState("all");
    const [capability, setCapability] = useState("all");

    useEffect(() => {
        if (!preview && !publicSettings) void loadPublicSettings();
    }, [loadPublicSettings, preview, publicSettings]);

    const rows = useMemo(() => {
        const source: PricingRow[] = preview || publicSettings?.modelChannel.modelCosts || [];
        return source.map((item) => ({ ...item, capability: item.capability || capabilityOf(item.model, publicSettings?.modelChannel) }));
    }, [preview, publicSettings]);

    const vendors = useMemo(() => Array.from(new Set(rows.map((item) => item.vendor).filter(Boolean))).sort(), [rows]);
    const capabilities = useMemo(() => Array.from(new Set(rows.map((item) => item.capability))), [rows]);
    const word = keyword.trim().toLowerCase();
    const filtered = rows.filter((item) => {
        if (vendor !== "all" && item.vendor !== vendor) return false;
        if (capability !== "all" && item.capability !== capability) return false;
        if (!word) return true;
        return item.model.toLowerCase().includes(word);
    });

    if (!preview && !publicSettings) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
        <div className={styles.wrapper}>
            <div className={styles.controls}>
                <Input allowClear prefix={<Search className="size-3.5" />} placeholder={tr("搜索模型")} aria-label={tr("搜索模型")} value={keyword} onChange={(event) => setKeyword(event.target.value)} className={styles.search} />
                <Select value={vendor} onChange={setVendor} aria-label={tr("全部厂商")} className={styles.select} options={[{ label: <span className={styles.option}><Building2 size={16} />{tr("全部厂商")}</span>, value: "all" }, ...vendors.map((item) => ({ label: <span className={styles.option}><ModelLogo icon={rows.find((row) => row.vendor === item && row.icon)?.icon} name={item} size={16} />{item}</span>, value: item }))]} />
                <Select value={capability} onChange={setCapability} aria-label={tr("全部类型")} className={styles.select} options={[{ label: <span className={styles.option}><Layers size={16} />{tr("全部类型")}</span>, value: "all" }, ...capabilities.map((item) => {
                    const Icon = capabilityIcons[item as keyof typeof capabilityIcons] || Layers;
                    return { label: <span className={styles.option}><Icon size={16} />{tr(capabilityLabels[item] || item)}</span>, value: item };
                })]} />
            </div>

            {filtered.length === 0 ? (
                <div className={styles.empty}><Empty description={tr("没有匹配的模型")} /></div>
            ) : (
                <div className={styles.table} aria-label={tr("模型定价表")}>
                    <div className={styles.head} aria-hidden="true">
                        <span>{tr("模型")}</span>
                        <span>{tr("厂商")}</span>
                        <span>{tr("类型")}</span>
                        <span className={styles.priceHead}>{tr("标准价")}</span>
                        <span className={styles.memberGroup}>
                            <span className={styles.memberCodes}>{planPricingCodes.map((code) => <span key={code}>{code.toUpperCase()}</span>)}</span>
                        </span>
                        <span className={styles.priceHead}>{tr("API 价")}</span>
                    </div>
                    {filtered.map((item) => {
                        const key = item.modelId || item.model;
                        const unit = billingUnit(item.billingType);
                        return (
                            <div key={key} className={styles.group}>
                                <button type="button" className={styles.row} onClick={() => copyText(item.model, "模型 ID 已复制")} aria-label={`${tr("复制模型 ID")} ${item.model}`} title={tr("复制模型 ID")}>
                                    <span className={styles.model}>
                                        <ModelLogo icon={item.icon} name={item.vendor || item.model} />
                                        <span className={styles.modelName}>{item.model}</span>
                                    </span>
                                    <span className={styles.vendor}>{item.vendor || "—"}</span>
                                    <span><span className={styles.badge}>{tr(capabilityLabels[item.capability] || item.capability)}</span></span>
                                    <span className={styles.price} data-label={tr("标准价")}>{formatCost(item.credits)}<small>{tr(unit)}</small></span>
                                    {planPricingCodes.map((code) => <span key={code} className={styles.planPrice} data-label={code.toUpperCase()} data-muted={planCostOf(item, code) === item.credits}>{formatCost(planCostOf(item, code))}</span>)}
                                    <span className={styles.price} data-label={tr("API 价")}>{formatCost(apiCostOf(item))}<small>{tr(billingUnit(item.apiBilling))}</small></span>
                                </button>
                                {item.capability === "video" && item.videoSecondPrice ? <div className={styles.row}>
                                    <span className={styles.model}>{tr("按秒计费")}</span><span /><span />
                                    <span className={styles.price} data-label={tr("标准价")}>{formatCost(item.videoSecondPrice.credits)}<small>{tr("点/秒")}</small></span>
                                    {planPricingCodes.map((code) => <span key={code} className={styles.planPrice} data-label={code.toUpperCase()}>{formatCost(planCostOf(item.videoSecondPrice!, code))}</span>)}
                                    <span className={styles.price} data-label={tr("API 价")}>{formatCost(apiCostOf({ ...item.videoSecondPrice, apiMultiplier: item.apiMultiplier }))}<small>{tr("点/秒")}</small></span>
                                </div> : null}
                            </div>
                        );
                    })}
                </div>
            )}
            {!preview && filtered.length > 0 ? <p className={styles.note}>{tr("未单独定价的套餐沿用标准价。")} {tr("价格由站点管理员统一配置，实际扣费以工作台显示为准。")}</p> : null}
        </div>
    );
}

function formatCost(value: number) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);
}
