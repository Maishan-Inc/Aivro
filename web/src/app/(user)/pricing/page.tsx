"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Button } from "antd";
import { ArrowRight, BadgeCheck, Layers3, Sparkles, Users, X } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { FlowBackground } from "@/components/flow-background";
import styles from "./pricing.module.css";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

type PlanCode = "go" | "plus" | "pro" | "max";
type Feature = { icon: ComponentType<{ className?: string }>; text: string; strong?: boolean };
type PricingCard = {
    code: PlanCode;
    title: string;
    price: string;
    currency: string;
    subtitle: string;
    cta: string;
    badge?: string;
    highlighted?: boolean;
    features: Feature[];
    plan?: Plan;
};

export default function PricingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { message, modal } = App.useApp();
    const { locale } = useI18n();
    const token = useUserStore((s) => s.token);
    const isReady = useUserStore((s) => s.isReady);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingPlanId, setLoadingPlanId] = useState("");
    

    useEffect(() => {
        fetchPlans().then(setPlans).catch(() => message.error("读取套餐失败"));
    }, [message]);

    const planByCode = useMemo(() => {
        return plans.map((plan) => resolvePlanLocale(plan, locale)).reduce<Partial<Record<PlanCode, Plan>>>((acc, plan) => ({ ...acc, [plan.code]: plan }), {});
    }, [locale, plans]);

    const buy = async (plan: Plan | undefined) => {
        if (!plan || !isReady) return;
        if (!token) {
            const activeLocale = localeFromPath(pathname) || locale;
            modal.confirm({
                title: "需要登录",
                content: "购买套餐需要先登录，登录后将跳转回套餐页。",
                okText: "去登录",
                cancelText: "取消",
                onOk: () => router.push(withLocalePath(`/login?redirect=${encodeURIComponent(withLocalePath("/pricing", activeLocale))}`, activeLocale)),
            });
            return;
        }
        setLoadingPlanId(plan.id);
        try {
            const result = await createStripeCheckout(token, plan.id, locale);
            window.location.href = result.checkoutUrl;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建支付失败");
        } finally {
            setLoadingPlanId("");
        }
    };

    const cards: PricingCard[] = (["go", "plus", "pro", "max"] as PlanCode[]).map((code) => {
        const plan = planByCode[code];
        const title = plan?.name || planName(code);
        const highlighted = plan ? plan.recommended : code === "plus";
        return {
            code,
            title,
            price: displayPrice(plan, fallbackPrice(code)),
            currency: displayCurrency(plan),
            subtitle: plan?.description || fallbackSubtitle(code),
            cta: `升级至 ${title}`,
            badge: highlighted ? "推荐" : undefined,
            highlighted,
            features: planFeaturesFromPlan(plan),
            plan,
        };
    });

    return (
        <main className={styles.pricing}>
            <div className={styles.background} aria-hidden="true"><FlowBackground /></div>
            <div className={styles.content}>
                <header className={styles.nav}>
                    <Link href={withLocalePath("/", locale)} className={styles.brand}><span />Aivro</Link>
                    <Link href={withLocalePath("/", locale)} className={styles.close} aria-label="关闭套餐页">返回创作<X size={17} /></Link>
                </header>
                <section className={styles.heading}>
                    <span>为每一种创作节奏</span>
                    <h1>让创作，多一点可能。</h1>
                    <p>从第一次尝试，到持续探索。选择适合你的创作空间，让图像、视频与 3D 灵感继续生长。</p>
                    <small>一个创作空间，更多表达可能。</small>
                </section>
                <div className={styles.cards}>
                    {cards.map((card) => <PricingCardView key={card.code} card={card} loading={!!card.plan && loadingPlanId === card.plan.id} onBuy={() => void buy(card.plan)} />)}
                </div>
                <section className={styles.enterprise}>
                    <div><Users size={24} strokeWidth={1.2} /><div><h2>一起创作，走得更远。</h2><p>贵组织需要更多功能？为团队探索更合适的创作方案。</p></div></div>
                    <a href="mailto:enterprise@aivro.org?subject=Aivro%20Enterprise">查看 Aivro Enterprise<ArrowRight size={17} /></a>
                </section>
                <div className={styles.note}><span>让工具顺着想法走，让创作自然发生。</span><Link href={withLocalePath("/#faq", locale)}>了解更多常见问题<ArrowRight size={14} /></Link></div>
            </div>
        </main>
    );
}

function PricingCardView({ card, loading, onBuy }: { card: PricingCard; loading: boolean; onBuy: () => void }) {
    return <section className={styles.card} data-recommended={card.highlighted}>
        <div className={styles.cardTop}><h2>{card.title}</h2>{card.badge ? <span className={styles.badge}>{card.badge}</span> : null}</div>
        <p className={styles.subtitle}>{card.subtitle}</p>
        <div className={styles.price}><span>{currencySymbol(card.currency)}</span><strong>{card.price}</strong><small>{pricePeriodLabel(card.currency)}</small></div>
        <Button block loading={loading} disabled={!card.plan} onClick={onBuy} className={styles.cta}>{card.cta}<ArrowRight size={15} /></Button>
        <div className={styles.featuresLabel}>你的创作空间包含</div>
        <ul>{card.features.map((feature) => <PlanFeature key={feature.text} feature={feature} />)}</ul>
        <span className={styles.cardFoot}>图像 · 视频 · 3D · 工作流</span>
    </section>;
}

function PlanFeature({ feature }: { feature: Feature }) {
    const Icon = feature.icon;
    return <li className={styles.feature}><Icon className="size-4 shrink-0" /><span className={feature.strong ? "font-semibold" : undefined}>{feature.text}</span></li>;
}

function displayPrice(plan: Plan | undefined, fallback: string) {
    if (!plan) return fallback;
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat(useLocaleStore.getState().locale, { maximumFractionDigits: 0 }).format(plan.priceCents / 100);
}

function displayCurrency(plan: Plan | undefined) {
    return (plan?.currency || "USD").toUpperCase();
}

function currencySymbol(currency: string) {
    if (currency === "CNY") return "¥";
    if (currency === "KRW") return "₩";
    if (currency === "EUR") return "€";
    return "$";
}

function pricePeriodLabel(currency: string) {
    if (currency === "KRW") return "/月";
    return "/ 月";
}

function planName(code: PlanCode) {
    return code === "max" ? "Max" : code[0].toUpperCase() + code.slice(1);
}

function fallbackPrice(code: PlanCode) {
    return ({ go: "1,400", plus: "3,000", pro: "16,800", max: "28,000" } as Record<PlanCode, string>)[code];
}

function fallbackSubtitle(code: PlanCode) {
    const zh: Record<PlanCode, string> = {
        go: "从第一个灵感开始，轻松探索你的创作方式",
        plus: "为日常创作留出更多空间，让好想法持续发生",
        pro: "让灵感进入完整工作流，支持更密集的创作",
        max: "为高强度创作者，打开更广阔的表达空间",
    };
    return zh[code];
}

function planFeaturesFromPlan(plan: Plan | undefined): Feature[] {
    const icons = [Sparkles, Layers3, BadgeCheck];
    if (!plan) {
        return [
            { icon: Sparkles, text: "图像、视频与 3D 创作", strong: true },
            { icon: Layers3, text: "连接灵感的创作工作流" },
            { icon: BadgeCheck, text: "灵感图库与素材管理" },
        ];
    }
    if (plan.features?.length) {
        return plan.features.map((text, index) => ({ icon: icons[index % icons.length], text, strong: index === 0 }));
    }
    return [
        { icon: Sparkles, text: `${formatQuota(plan.credits)} 算力点`, strong: true },
        { icon: Layers3, text: `${formatQuota(plan.workflowCreateCredits)} 次工作流创建` },
        { icon: BadgeCheck, text: "图像、视频、3D 与创作工作流" },
    ];
}

function formatQuota(value: number) {
    return new Intl.NumberFormat(useLocaleStore.getState().locale, { maximumFractionDigits: 0 }).format(value || 0);
}
