"use client";

import { useEffect, useRef } from "react";
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

// Model perks granted by each plan. Only these two models are discounted, and the
// rates are display data until the backend can price per plan.
const planPerks: Record<string, { model: string; credits: number; original: number }[]> = {
    go: [{ model: "gpt-image-2.5-flare", credits: 2, original: 4 }],
    plus: [
        { model: "gpt-image-2.5-flare", credits: 2, original: 4 },
        { model: "gpt-image-2.5-sunburst", credits: 3, original: 4 },
    ],
    pro: [
        { model: "gpt-image-2.5-flare", credits: 1, original: 4 },
        { model: "gpt-image-2.5-sunburst", credits: 2, original: 4 },
    ],
    max: [
        { model: "gpt-image-2.5-flare", credits: 1, original: 4 },
        { model: "gpt-image-2.5-sunburst", credits: 2, original: 4 },
    ],
};

// Inlined from public/icons/openai.svg so the mark inherits the card's ink colour.
const gptLogoPath =
    "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z";

function GptLogo() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d={gptLogoPath} fillRule="evenodd" /></svg>;
}

export function PricingCards({ onBuy, loadingPlanId = "", carousel = false }: { onBuy?: (plan: Plan) => void; loadingPlanId?: string; carousel?: boolean }) {
    const { locale, tr } = useI18n();
    const localizedPath = useLocalizedPath();
    const { data = [], isPending, isError, refetch } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans, staleTime: 60_000 });
    const plans = data.filter((plan) => plan.enabled).map((plan) => resolvePlanLocale(plan, locale));
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const cardsRef = useRef<HTMLDivElement>(null);

    // 手机端套餐是横向滑动列表，渲染后把推荐套餐居中，两侧各露出一点相邻套餐。
    useEffect(() => {
        const track = cardsRef.current;
        const recommended = track?.querySelector<HTMLElement>('[data-recommended="true"]');
        if (!track || !recommended || track.scrollWidth <= track.clientWidth) return;
        track.scrollLeft = recommended.offsetLeft - (track.clientWidth - recommended.offsetWidth) / 2;
    }, [plans.length]);

    return <>
        <div ref={cardsRef} className={styles.cards} data-carousel={carousel} aria-busy={isPending}>
            {planDefaults.map((fallback) => {
                const plan = plans.find((item) => item.code === fallback.code);
                const title = plan?.name || fallback.title;
                const currency = (plan?.currency || "USD").toUpperCase();
                const recommended = plan ? plan.recommended : fallback.code === "plus";
                const features = plan?.features?.length ? plan.features : plan ? [
                    tr("{0} 算力点").replace("{0}", number.format(plan.credits)),
                    plan.workflowCreateCredits === 1 ? tr("1 次工作流创建") : tr("{0} 次工作流创建").replace("{0}", number.format(plan.workflowCreateCredits)),
                    "图像、视频、3D 与创作工作流",
                ] : ["图像、视频与 3D 创作", "连接灵感的创作工作流", "灵感图库与素材管理"];
                const cta = <>{tr("升级至 {0}").replace("{0}", title)}<ArrowRight size={15} /></>;
                const perks = planPerks[fallback.code] || [];

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
                    {perks.length ? <div className={styles.perks}>
                        {perks.map((perk) => <div key={perk.model} className={styles.perk}>
                            <GptLogo />
                            <span>{tr("享受 {0} {1} 算力点/张").replace("{0}", perk.model).replace("{1}", number.format(perk.credits))}</span>
                        </div>)}
                    </div> : null}
                    <span className={styles.cardFoot}>图像 · 视频 · 3D · 工作流</span>
                </section>;
            })}
        </div>
        {isPending ? <p className={styles.status} role="status">正在加载套餐…</p> : null}
        {isError ? <p className={styles.status} role="status">读取套餐失败<button type="button" onClick={() => void refetch()}>重新加载</button></p> : null}
    </>;
}
