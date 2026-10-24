"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

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

    useEffect(() => {
        if (!publicSettings) void loadPublicSettings();
    }, [loadPublicSettings, publicSettings]);

    return (
        <main className={styles.page}>
            <div className={styles.background} aria-hidden="true"><FlowBackground /></div>
            <div className={styles.content}>
                <header className={styles.heading}>
                    <span className={styles.eyebrow}>{tr("模型定价")}</span>
                    <h1>{tr("每一份算力，都花在看得见的地方。")}</h1>
                    <p>{tr("查看每个模型在控制台的标准价、各套餐的会员价和 API 单价。价格由站点管理员统一维护，实际扣费以工作台显示为准。")}</p>
                </header>
                <section className={styles.body}>
                    <ModelPricingTable />
                </section>
                <div className={styles.foot}>
                    <span>{tr("价格调整会在保存后立即生效，已完成的请求不重新计算。")}</span>
                    <div className={styles.footLinks}>
                        <Link href={localizedPath("/developers")}>{tr("开发文档")}<ArrowUpRight className="size-3.5" /></Link>
                        <Link href={localizedPath("/canvas")}>{tr("进入工作空间")}<ArrowUpRight className="size-3.5" /></Link>
                        <Link href={localizedPath("/pricing")}>{tr("查看套餐")}<ArrowRight className="size-3.5" /></Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
