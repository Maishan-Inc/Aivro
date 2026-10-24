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
                    <h1>{tr("模型定价")}</h1>
                </header>
                <section className={styles.body}>
                    <ModelPricingTable />
                </section>
                <div className={styles.foot}>
                    <span>{tr("价格调整会在邮件提醒后的24小时后生效，已完成的请求不重新计算。")}</span>
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
