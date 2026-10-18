"use client";

import Link from "next/link";
import { Button } from "antd";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Layers3, Sparkles } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import styles from "./pricing-cards.module.css";

const planDefaults = [
    { code: "go", title: "Go", price: "1,400", subtitle: "从第一个灵感开始，轻松探索你的创作方式" },
    { code: "plus", title: "Plus", price: "3,000", subtitle: "为日常创作留出更多空间，让好想法持续发生" },
    { code: "pro", title: "Pro", price: "16,800", subtitle: "让灵感进入完整工作流，支持更密集的创作" },
    { code: "max", title: "Max", price: "28,000", subtitle: "为高强度创作者，打开更广阔的表达空间" },
] as const;
const featureIcons = [Sparkles, Layers3, BadgeCheck];

export function PricingCards({ onBuy, loadingPlanId = "" }: { onBuy?: (plan: Plan) => void; loadingPlanId?: string }) {
    const { locale, tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const { data = [], isPending, isError, refetch } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans, staleTime: 60_000 });
    const plans = data.filter((plan) => plan.enabled).map((plan) => resolvePlanLocale(plan, locale));
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

    return <>
        <div className={styles.cards} aria-busy={isPending}>
            {planDefaults.map((fallback) => {
                const plan = plans.find((item) => item.code === fallback.code);
                const title = plan?.name || fallback.title;
                const currency = (plan?.currency || "USD").toUpperCase();
                const recommended = plan ? plan.recommended : fallback.code === "plus";
                const features = plan?.features?.length ? plan.features : plan ? [
                    tr("{0} 算力点").replace("{0}", number.format(plan.credits)),
                    tr("{0} 次工作流创建").replace("{0}", number.format(plan.workflowCreateCredits)),
                    "图像、视频、3D 与创作工作流",
                ] : ["图像、视频与 3D 创作", "连接灵感的创作工作流", "灵感图库与素材管理"];
                const cta = <>升级至 {title}<ArrowRight size={15} /></>;

                return <section key={fallback.code} className={styles.card} data-recommended={recommended}>
                    <div className={styles.cardTop}><h2>{title}</h2>{recommended ? <span className={styles.badge}>推荐</span> : null}</div>
                    <p className={styles.subtitle}>{plan?.description || fallback.subtitle}</p>
                    <div className={styles.price}><span>{({ CNY: "¥", KRW: "₩", EUR: "€" } as Record<string, string>)[currency] || "$"}</span><strong>{plan ? number.format(Math.max(0, plan.priceCents) / 100) : fallback.price}</strong><small>{currency === "KRW" ? "/月" : "/ 月"}</small></div>
                    {onBuy ? <Button block loading={!!plan && loadingPlanId === plan.id} disabled={!plan} onClick={() => { if (plan) onBuy(plan); }} className={styles.cta}>{cta}</Button> : <Link href={localizedPath("/pricing")} className={styles.cta}>{cta}</Link>}
                    <div className={styles.featuresLabel}>你的创作空间包含</div>
                    <ul>{features.map((feature, index) => {
                        const Icon = featureIcons[index % featureIcons.length];
                        return <li key={index} className={styles.feature}><Icon size={16} /><span data-strong={index === 0}>{feature}</span></li>;
                    })}</ul>
                    <span className={styles.cardFoot}>图像 · 视频 · 3D · 工作流</span>
                </section>;
            })}
        </div>
        {isPending ? <p className={styles.status} role="status">正在加载套餐…</p> : null}
        {isError ? <p className={styles.status} role="status">读取套餐失败<button type="button" onClick={() => void refetch()}>重新加载</button></p> : null}
    </>;
}
