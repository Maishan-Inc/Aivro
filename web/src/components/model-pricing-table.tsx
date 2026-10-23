"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Empty, Input, Segmented, Select, Skeleton } from "antd";
import { Search } from "lucide-react";

import { ModelLogo } from "@/components/model-logo";
import { apiCostOf, billingUnit, capabilityLabels, capabilityOf, planCostOf, planPricingCodes } from "@/lib/model-pricing";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useConfigStore } from "@/stores/use-config-store";
import type { AdminModelCost } from "@/services/api/admin";
import styles from "./model-pricing-table.module.css";

type ViewKey = "standard" | "member" | "api";
type PricingRow = AdminModelCost & { capability?: string };

// 前台定价表与管理后台预览共用；后台预览直接传入当前编辑中的行，
// 需要模型类型时由调用方按后台的模型范围补上 capability。
export function ModelPricingTable({ preview }: { preview?: PricingRow[] }) {
    const { tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const [view, setView] = useState<ViewKey>("standard");
    const [keyword, setKeyword] = useState("");
    const [vendor, setVendor] = useState("all");
    const [capability, setCapability] = useState("all");
    const [expanded, setExpanded] = useState("");

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
        return item.model.toLowerCase().includes(word) || item.vendor.toLowerCase().includes(word);
    });

    if (!preview && !publicSettings) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
        <div className={styles.wrapper}>
            <div className={styles.controls}>
                <Segmented
                    value={view}
                    onChange={(value) => setView(value as ViewKey)}
                    options={[
                        { label: tr("标准价"), value: "standard" },
                        { label: tr("会员价"), value: "member" },
                        { label: tr("API 价"), value: "api" },
                    ]}
                />
                <div className={styles.filters}>
                    <Input allowClear prefix={<Search className="size-3.5" />} placeholder={tr("搜索模型或厂商")} value={keyword} onChange={(event) => setKeyword(event.target.value)} className={styles.search} />
                    <Select value={vendor} onChange={setVendor} className={styles.select} options={[{ label: tr("全部厂商"), value: "all" }, ...vendors.map((item) => ({ label: item, value: item }))]} />
                    <Select value={capability} onChange={setCapability} className={styles.select} options={[{ label: tr("全部类型"), value: "all" }, ...capabilities.map((item) => ({ label: tr(capabilityLabels[item] || item), value: item }))]} />
                </div>
            </div>

            {view === "member" ? <div className={styles.hint}><span>{tr("会员价按套餐档位生效，未单独定价的套餐沿用标准价。")}</span><Link href={localizedPath("/pricing")}>{tr("查看套餐")}</Link></div> : null}
            {view === "api" ? <div className={styles.hint}><span>{tr("API 价默认按标准价的倍数计算，接入方式后续单独提供。")}</span></div> : null}

            {filtered.length === 0 ? (
                <div className={styles.empty}><Empty description={tr("没有匹配的模型")} /></div>
            ) : (
                <div className={styles.table} aria-label={tr("模型定价表")}>
                    <div className={styles.head} data-view={view} aria-hidden="true">
                        <span>{tr("模型")}</span>
                        <span>{tr("厂商")}</span>
                        <span>{tr("类型")}</span>
                        {view === "member" ? planPricingCodes.map((code) => <span key={code} className={styles.planHead}>{code.toUpperCase()}</span>) : null}
                        {view === "api" ? <span className={styles.priceHead}>{tr("API 价")}</span> : null}
                        {view === "standard" ? <span className={styles.priceHead}>{tr("标准价")}</span> : null}
                    </div>
                    {filtered.map((item) => {
                        const key = item.modelId || item.model;
                        const unit = billingUnit(item.billingType);
                        return (
                            <div key={key} className={styles.group}>
                                <button type="button" className={styles.row} data-view={view} onClick={() => setExpanded(expanded === key ? "" : key)} aria-expanded={expanded === key}>
                                    <span className={styles.model}>
                                        <ModelLogo icon={item.icon} name={item.vendor || item.model} />
                                        <span className={styles.modelName}>{item.model}</span>
                                    </span>
                                    <span className={styles.vendor}>{item.vendor || "—"}</span>
                                    <span><span className={styles.badge}>{tr(capabilityLabels[item.capability] || item.capability)}</span></span>
                                    {view === "member" ? planPricingCodes.map((code) => (
                                        <span key={code} className={styles.planPrice} data-plan={code.toUpperCase()} data-muted={planCostOf(item, code) === item.credits}>{formatCost(planCostOf(item, code))}</span>
                                    )) : null}
                                    {view === "api" ? (
                                        <span className={styles.price}>{formatCost(apiCostOf(item))}<small>{tr(billingUnit(item.apiBilling))}</small></span>
                                    ) : null}
                                    {view === "standard" ? <span className={styles.price}>{formatCost(item.credits)}<small>{tr(unit)}</small></span> : null}
                                </button>
                                {expanded === key ? (
                                    <div className={styles.detail}>
                                        <div><span>{tr("标准价")}</span><strong>{formatCost(item.credits)} {tr(unit)}</strong></div>
                                        <div><span>{tr("API 价")}</span><strong>{formatCost(apiCostOf(item))} {tr(billingUnit(item.apiBilling))}</strong></div>
                                        {planPricingCodes.map((code) => <div key={code}><span>{code.toUpperCase()}</span><strong>{formatCost(planCostOf(item, code))}</strong></div>)}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
            {!preview && filtered.length > 0 ? <p className={styles.note}>{tr("价格由站点管理员统一配置，实际扣费以工作台显示为准。")}</p> : null}
        </div>
    );
}

function formatCost(value: number) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);
}
