"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cpu, Layers3, Sparkles } from "lucide-react";

import { FlowBackground } from "@/components/flow-background";
import { ModelPricingTable } from "@/components/model-pricing-table";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useConfigStore } from "@/stores/use-config-store";
import styles from "./models.module.css";

export default function ModelsPage() {
    const { tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!publicSettings) void loadPublicSettings();
    }, [loadPublicSettings, publicSettings]);

    const rows = publicSettings?.modelChannel.modelCosts || [];
    const vendors = new Set(rows.map((item) => item.vendor).filter(Boolean));

    return (
        <main className={styles.page}>
            <div className={styles.background} aria-hidden="true"><FlowBackground /></div>
            <div className={styles.content}>
                <header className={styles.heading}>
                    <span className={styles.eyebrow}>{tr("模型定价")}</span>
                    <h1>{tr("每一份算力，都花在看得见的地方。")}</h1>
                    <p>{tr("查看每个模型在控制台的标准价、各套餐的会员价和 API 单价。价格由站点管理员统一维护，实际扣费以工作台显示为准。")}</p>
                    <div className={styles.stats}>
                        <div><Cpu className="size-4 opacity-50" /><strong>{mounted ? rows.length : "—"}</strong><span>{tr("计费模型")}</span></div>
                        <div><Layers3 className="size-4 opacity-50" /><strong>{mounted ? vendors.size : "—"}</strong><span>{tr("合作厂商")}</span></div>
                        <div><Sparkles className="size-4 opacity-50" /><strong>{tr("4 档")}</strong><span>{tr("套餐档位")}</span></div>
                    </div>
                </header>
                <section className={styles.body}>
                    <ModelPricingTable />
                </section>
                <div className={styles.foot}>
                    <span>{tr("价格调整会在保存后立即生效，已完成的请求不重新计算。")}</span>
                    <div className={styles.footLinks}>
                        <Link href={localizedPath("/canvas")}>{tr("进入工作空间")}<ArrowUpRight className="size-3.5" /></Link>
                        <Link href={localizedPath("/pricing")}>{tr("查看套餐")}<ArrowRight className="size-3.5" /></Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
