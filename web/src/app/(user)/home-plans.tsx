"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { fetchPlans, resolvePlanLocale } from "@/services/api/billing";
import styles from "./home.module.css";

export function HomePlans() {
    const { locale, tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const { data = [], isPending, isError, refetch } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans, staleTime: 60_000 });
    const plans = data.filter((plan) => plan.enabled).map((plan) => resolvePlanLocale(plan, locale)).sort((a, b) => a.sort - b.sort);
    const number = new Intl.NumberFormat(locale);

    return <section id="plans" className={styles.plansSection} aria-labelledby="plans-title" data-reveal>
        <div className={styles.discoveryHeading}>
            <div><span className={styles.eyebrow}>为每一种创作节奏</span><h2 id="plans-title">套餐推荐</h2></div>
            <Link href={localizedPath("/pricing")} className={styles.textLink}>查看全部套餐 <ArrowUpRight size={17} /></Link>
        </div>
        <div className={styles.homePlans} aria-busy={isPending}>
            {isPending ? Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.planSkeleton} aria-hidden="true" />) : plans.map((plan) => <article key={plan.id} className={styles.homePlan} data-recommended={plan.recommended}>
                <div className={styles.homePlanTitle}><h3>{plan.name}</h3>{plan.recommended ? <span>推荐</span> : null}</div>
                <p className={styles.homePlanDescription}>{plan.description}</p>
                <strong className={styles.homePlanPrice}>{new Intl.NumberFormat(locale, { style: "currency", currency: plan.currency || "USD", maximumFractionDigits: 2 }).format(plan.priceCents / 100)}</strong>
                <ul>
                    <li><Check size={15} /><span>{tr("{0} 算力点").replace("{0}", number.format(plan.credits))}</span></li>
                    <li><Check size={15} /><span>{tr("{0} 次工作流创建").replace("{0}", number.format(plan.workflowCreateCredits))}</span></li>
                    {(plan.features || []).slice(0, 2).map((feature, index) => <li key={index}><Check size={15} /><span>{feature}</span></li>)}
                </ul>
                <Link href={localizedPath("/pricing")} className={plan.recommended ? styles.primary : styles.secondary}>查看套餐 <ArrowUpRight size={16} /></Link>
            </article>)}
        </div>
        {isPending ? <p className={styles.sourceNote} role="status">正在加载套餐…</p> : null}
        {isError ? <p className={styles.sourceNote} role="status">读取套餐失败<button type="button" onClick={() => void refetch()}>重新加载</button></p> : !isPending && !plans.length ? <p className={styles.sourceNote}>暂无可用套餐</p> : null}
    </section>;
}
