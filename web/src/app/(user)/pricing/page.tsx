"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Button } from "antd";
import { ArrowRight, BadgeCheck, Layers3, Sparkles, Users, X } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
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
    const en = locale === "en-US";

    useEffect(() => {
        fetchPlans().then(setPlans).catch(() => message.error(en ? "Failed to load plans" : "读取套餐失败"));
    }, [en, message]);

    const planByCode = useMemo(() => {
        return plans.map((plan) => resolvePlanLocale(plan, locale)).reduce<Partial<Record<PlanCode, Plan>>>((acc, plan) => ({ ...acc, [plan.code]: plan }), {});
    }, [locale, plans]);

    const buy = async (plan: Plan | undefined) => {
        if (!plan || !isReady) return;
        if (!token) {
            const activeLocale = localeFromPath(pathname) || locale;
            modal.confirm({
                title: en ? "Sign in required" : "需要登录",
                content: en ? "Please sign in to purchase this plan." : "购买套餐需要先登录，登录后将跳转回套餐页。",
                okText: en ? "Sign in" : "去登录",
                cancelText: en ? "Cancel" : "取消",
                onOk: () => router.push(withLocalePath(`/login?redirect=${encodeURIComponent(withLocalePath("/pricing", activeLocale))}`, activeLocale)),
            });
            return;
        }
        setLoadingPlanId(plan.id);
        try {
            const result = await createStripeCheckout(token, plan.id, locale);
            window.location.href = result.checkoutUrl;
        } catch (error) {
            message.error(error instanceof Error ? error.message : en ? "Failed to create checkout" : "创建支付失败");
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
            subtitle: plan?.description || fallbackSubtitle(code, en),
            cta: en ? `Upgrade to ${title}` : `升级至 ${title}`,
            badge: highlighted ? (en ? "Recommended" : "推荐") : undefined,
            highlighted,
            features: planFeaturesFromPlan(plan, en),
            plan,
        };
    });

    return (
        <main className="aivro-wire-surface h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            <Link href={withLocalePath("/", locale)} aria-label={en ? "Close pricing" : "关闭套餐页"} className="fixed right-5 top-5 z-10 inline-flex size-9 items-center justify-center rounded-full border border-stone-200 bg-background/70 text-stone-500 backdrop-blur transition hover:border-stone-300 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-950/70 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-white">
                <X className="size-4" />
            </Link>
            <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col px-5 pb-6 pt-6 sm:px-8">
                <section className="flex flex-1 flex-col justify-center pb-10 pt-28 md:pt-32">
                    <h1 className="mb-14 text-center text-[3rem] font-semibold leading-none tracking-[0] text-stone-950 dark:text-white md:text-[4rem]">{en ? "Upgrade plan" : "升级套餐"}</h1>
                    <div className="grid gap-7 md:grid-cols-2 2xl:grid-cols-4">
                        {cards.map((card) => (
                            <PricingCardView key={card.code} card={card} loading={!!card.plan && loadingPlanId === card.plan.id} en={en} onBuy={() => void buy(card.plan)} />
                        ))}
                    </div>
                </section>
                <div className="mx-auto mt-auto flex shrink-0 flex-col items-center pb-2 text-center text-sm font-medium leading-6 text-stone-500 dark:text-stone-400">
                    <Users className="mb-3 size-5 text-stone-500 dark:text-stone-300" />
                    <p>{en ? "Need more for your organization?" : "贵组织需要更多功能？"}</p>
                    <a href="mailto:enterprise@aivro.org?subject=Aivro%20Enterprise" className="group inline-flex items-center gap-1 text-stone-900 underline decoration-stone-400 underline-offset-4 transition hover:text-black dark:text-stone-100 dark:decoration-stone-600 dark:hover:text-white">
                        {en ? "View Aivro Enterprise" : "查看Aivro Enterprise"}
                        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                    </a>
                </div>
            </div>
        </main>
    );
}

function PricingCardView({ card, loading, en, onBuy }: { card: PricingCard; loading: boolean; en: boolean; onBuy: () => void }) {
    return (
        <section
            className={cn(
                "group relative flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-lg px-8 pb-8 pt-8 transition duration-300 hover:-translate-y-1",
                card.highlighted ? "border border-stone-900 bg-stone-950 text-white shadow-[0_22px_70px_rgba(28,25,23,0.22)] dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "aivro-wire-card",
            )}
        >
            {card.badge && <span className={cn("absolute right-8 top-8 rounded-full px-3 py-1 text-xs font-semibold leading-none", card.highlighted ? "bg-white text-stone-950 dark:bg-stone-950 dark:text-white" : "bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950")}>{card.badge}</span>}
            <div className="min-h-[14rem]">
                <h2 className={cn("max-w-[76%] truncate text-2xl font-semibold leading-none tracking-[0]", card.highlighted ? "text-white dark:text-stone-950" : "text-stone-950 dark:text-white")}>{card.title}</h2>
                <p className={cn("mt-5 min-h-16 text-base font-medium leading-7", card.highlighted ? "text-white/72 dark:text-stone-600" : "text-stone-500 dark:text-stone-400")}>{card.subtitle}</p>
                <div className="mt-9 flex items-baseline gap-2">
                    <span className={cn("text-[3.15rem] font-medium leading-none tracking-[0]", card.highlighted ? "text-white dark:text-stone-950" : "text-stone-950 dark:text-white")}>{currencySymbol(card.currency)}</span>
                    <span className={cn("text-[4.5rem] font-medium leading-none tracking-[0] tabular-nums", card.highlighted ? "text-white dark:text-stone-950" : "text-stone-950 dark:text-white")}>{card.price}</span>
                    <span className={cn("text-base font-semibold tracking-[0]", card.highlighted ? "text-white/62 dark:text-stone-500" : "text-stone-500 dark:text-stone-400")}>{pricePeriodLabel(card.currency, en)}</span>
                </div>
            </div>
            <Button
                block
                loading={loading}
                disabled={!card.plan}
                onClick={onBuy}
                className={`mt-5 h-12 rounded-full border-0 text-base font-medium shadow-none ${
                    card.highlighted ? "bg-white text-stone-950 hover:!bg-stone-100 hover:!text-stone-950 dark:bg-stone-950 dark:text-white dark:hover:!bg-stone-800 dark:hover:!text-white" : "bg-stone-950 text-white hover:!bg-stone-800 hover:!text-white dark:bg-stone-100 dark:text-stone-950 dark:hover:!bg-white dark:hover:!text-stone-950"
                }`}
            >
                {card.cta}
            </Button>
            <ul className="mt-auto flex flex-col gap-4 pt-8">
                {card.features.map((feature) => (
                    <PlanFeature key={feature.text} feature={feature} highlighted={card.highlighted} />
                ))}
            </ul>
        </section>
    );
}

function PlanFeature({ feature, highlighted }: { feature: Feature; highlighted?: boolean }) {
    const Icon = feature.icon;
    return (
        <li className={cn("flex items-center gap-3 text-base leading-6", highlighted ? "text-white/76 dark:text-stone-600" : "text-stone-600 dark:text-stone-300")}>
            <Icon className={cn("size-5 shrink-0", highlighted ? "text-white/82 dark:text-stone-700" : "text-stone-800 dark:text-stone-100")} />
            <span className={feature.strong ? cn("font-bold", highlighted ? "text-white dark:text-stone-950" : "text-stone-950 dark:text-white") : "font-medium"}>{feature.text}</span>
        </li>
    );
}

function displayPrice(plan: Plan | undefined, fallback: string) {
    if (!plan) return fallback;
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(plan.priceCents / 100);
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

function pricePeriodLabel(currency: string, en: boolean) {
    if (currency === "KRW") return en ? "/ mo" : "/月";
    return en ? "/ month" : "/ 月";
}

function planName(code: PlanCode) {
    return code === "max" ? "Max" : code[0].toUpperCase() + code.slice(1);
}

function fallbackPrice(code: PlanCode) {
    return ({ go: "1,400", plus: "3,000", pro: "16,800", max: "28,000" } as Record<PlanCode, string>)[code];
}

function fallbackSubtitle(code: PlanCode, en: boolean) {
    const zh: Record<PlanCode, string> = {
        go: "通过更长对话深入探索话题",
        plus: "保存个人上下文，让 AI 助手持续协助工作",
        pro: "以尖端智能自动化完成你最具体化的工作",
        max: "面向高强度创作者的最高使用空间",
    };
    const enText: Record<PlanCode, string> = {
        go: "Explore topics in longer conversations",
        plus: "Save personal context so your assistant can keep helping",
        pro: "Automate highly specific work with frontier intelligence",
        max: "The highest usage room for intensive creators",
    };
    return en ? enText[code] : zh[code];
}

function planFeaturesFromPlan(plan: Plan | undefined, en: boolean): Feature[] {
    const icons = [Sparkles, Layers3, BadgeCheck];
    if (!plan) {
        return [
            { icon: Sparkles, text: en ? "Configured credits" : "可配置算力点", strong: true },
            { icon: Layers3, text: en ? "Configurable workflow quota" : "可配置工作流创建次数" },
            { icon: BadgeCheck, text: en ? "Managed in plan management" : "内容由套餐管理维护" },
        ];
    }
    if (plan.features?.length) {
        return plan.features.map((text, index) => ({ icon: icons[index % icons.length], text, strong: index === 0 }));
    }
    return [
        { icon: Sparkles, text: en ? `${formatQuota(plan.credits)} credits` : `${formatQuota(plan.credits)} 算力点`, strong: true },
        { icon: Layers3, text: en ? `${formatQuota(plan.workflowCreateCredits)} workflow creations` : `${formatQuota(plan.workflowCreateCredits)} 次工作流创建` },
        { icon: BadgeCheck, text: en ? "Name, description, price, currency, and quota are customizable" : "名称、描述、价格、币种和额度均可在套餐管理中自定义" },
    ];
}

function formatQuota(value: number) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}
