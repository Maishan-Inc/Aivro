"use client";

import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Button } from "antd";
import { AudioLines, BadgeCheck, Beaker, Brain, CircleDot, Code2, Image, MessageCircle, Network, Sparkles, TrendingUp } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { useUserStore } from "@/stores/use-user-store";

type PricingCard = {
    key: "free" | "go" | "plus" | "pro";
    title: string;
    eyebrow?: string;
    price: string;
    subtitle: string;
    cta: string;
    current?: boolean;
    highlighted?: boolean;
    badge?: string;
    intro?: string;
    footer?: ReactNode;
    features: { icon: ComponentType<{ className?: string }>; text: string; strong?: boolean }[];
    plan?: Plan;
};

const FREE_FEATURES: PricingCard["features"] = [
    { icon: Sparkles, text: "核心模型", strong: true },
    { icon: MessageCircle, text: "有限额度的消息发送和文件上传" },
    { icon: Image, text: "有限的图片创建功能" },
    { icon: Brain, text: "有限的记忆" },
];

const GO_FEATURES: PricingCard["features"] = [
    { icon: Sparkles, text: "核心模型", strong: true },
    { icon: MessageCircle, text: "更多消息和上传限额" },
    { icon: Image, text: "更多图片生成限额" },
    { icon: Brain, text: "更多记忆内容" },
    { icon: AudioLines, text: "扩展额度的语音模式" },
];

const PLUS_FEATURES: PricingCard["features"] = [
    { icon: Sparkles, text: "高级模型", strong: true },
    { icon: Image, text: "使用 Thinking 进行高级图像创建" },
    { icon: Brain, text: "扩展容量的跨聊天记忆" },
    { icon: Code2, text: "Codex 编程智能体" },
    { icon: Network, text: "更高级别的深度研究" },
    { icon: BadgeCheck, text: "项目和自定义 GPT" },
];

const PRO_FEATURES: PricingCard["features"] = [
    { icon: TrendingUp, text: "相比 Plus 多 5 倍或 20 倍使用额度", strong: true },
    { icon: Sparkles, text: "Pro 前沿模型" },
    { icon: CircleDot, text: "对 Codex 的最大访问权限" },
    { icon: Network, text: "最高级别的深度研究" },
    { icon: MessageCircle, text: "无限制核心聊天" },
    { icon: Image, text: "无限制且较快速的图片生成" },
    { icon: Brain, text: "全面的记忆和背景信息" },
    { icon: Beaker, text: "抢先体验实验性功能" },
];

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
        fetchPlans().then(setPlans).catch(() => message.error("读取套餐失败"));
    }, [message]);

    const buy = async (plan: Plan) => {
        if (!isReady) return;
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
            message.error(error instanceof Error ? error.message : "创建支付失败");
        } finally {
            setLoadingPlanId("");
        }
    };

    const planByCode = useMemo(() => {
        return plans.map((plan) => resolvePlanLocale(plan, locale)).reduce<Partial<Record<Plan["code"], Plan>>>((acc, plan) => ({ ...acc, [plan.code]: plan }), {});
    }, [locale, plans]);

    const cards: PricingCard[] = [
        {
            key: "free",
            title: en ? "Free" : "免费版",
            price: "0",
            subtitle: en ? "Explore AI features" : "了解 AI 的功能",
            cta: en ? "Your current plan" : "你当前的套餐",
            current: true,
            features: FREE_FEATURES,
            footer: en ? "Already have a plan? View help" : "已有套餐？ 查看账单帮助",
        },
        {
            key: "go",
            title: "Go",
            price: displayPrice(planByCode.go, "13,000"),
            subtitle: en ? "Unlock more features, keep creating" : "解锁更多功能，畅聊不停",
            cta: en ? "Upgrade to Go" : "升级至 Go",
            features: GO_FEATURES,
            plan: planByCode.go,
            footer: en ? "This plan may include ads. Learn more" : "此套餐可能包含广告。了解更多",
        },
        {
            key: "plus",
            title: "Plus",
            price: displayPrice(planByCode.plus, "29,000"),
            subtitle: en ? "Unlock the full experience" : "解锁全面体验",
            cta: en ? "Upgrade to Plus" : "升级至 Plus",
            highlighted: true,
            badge: en ? "Popular" : "热门",
            features: PLUS_FEATURES,
            plan: planByCode.plus,
        },
        {
            key: "pro",
            title: "Pro",
            eyebrow: en ? "Creator" : "发件人",
            price: displayPrice(planByCode.pro, "159,000"),
            subtitle: en ? "Boost productivity effectively" : "有效提升效率",
            cta: en ? "Upgrade to Pro" : "升级至 Pro",
            intro: en ? "Everything in Plus, plus:" : "Plus 中的所有内容，以及：",
            features: PRO_FEATURES,
            plan: planByCode.pro,
            footer: (
                <>
                    {en ? "Unlimited use, subject to abuse safeguards." : "无限使用，但受防滥用机制限制。"}
                    <br />
                    <span className="underline decoration-white/30 underline-offset-2">{en ? "Learn about plan limits and safeguards" : "了解个人层级的限制和优惠活动"}</span>
                    <br />
                    <span className="underline decoration-white/30 underline-offset-2">{en ? "View billing help" : "我要账单帮助"}</span>
                </>
            ),
        },
    ];

    return (
        <main className="relative h-full overflow-y-auto bg-black text-[#f4f4f5]">
            <div className="mx-auto flex min-h-full w-full max-w-[86rem] flex-col px-6 pb-10 pt-14 sm:px-8 lg:pt-16">
                <h1 className="mb-7 text-center text-[1.75rem] font-semibold leading-none tracking-[0] text-white">{en ? "Upgrade plan" : "升级套餐"}</h1>
                <div className="grid gap-5 lg:grid-cols-4">
                    {cards.map((card) => (
                        <PricingCardView key={card.key} card={card} loading={!!card.plan && loadingPlanId === card.plan.id} onBuy={card.plan ? () => void buy(card.plan as Plan) : undefined} />
                    ))}
                </div>
            </div>
        </main>
    );
}

function PricingCardView({ card, loading, onBuy }: { card: PricingCard; loading: boolean; onBuy?: () => void }) {
    return (
        <section
            className={`relative flex min-h-[37.25rem] flex-col rounded-[10px] border px-6 pb-5 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                card.highlighted
                    ? "border-[#4d4c83] bg-[linear-gradient(180deg,#333263_0%,#232333_100%)]"
                    : "border-[#343434] bg-[#202020]"
            }`}
        >
            {card.badge && <span className="absolute right-6 top-6 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-white/65">{card.badge}</span>}
            <div className="min-h-[6.75rem]">
                <h2 className="text-[1.65rem] font-semibold leading-none tracking-[0] text-white/90">{card.title}</h2>
                {card.eyebrow && <p className="mt-3 text-xs font-semibold leading-none text-white/40">{card.eyebrow}</p>}
                <div className="mt-7 flex items-end gap-1.5">
                    <span className="pb-5 text-xl font-semibold leading-none text-white/45">₩</span>
                    <span className="text-[2.75rem] font-medium leading-[0.88] tracking-[0] text-white">{card.price}</span>
                    <span className="pb-1 text-[11px] font-bold tracking-[0] text-white/50">KRW /月（含 VAT）</span>
                </div>
                <p className="mt-5 text-[14px] font-semibold leading-none text-white/85">{card.subtitle}</p>
            </div>
            <Button
                block
                aria-disabled={card.current}
                loading={loading}
                onClick={onBuy}
                className={`mt-7 h-9 rounded-full border-0 text-[13px] font-medium shadow-none ${
                    card.highlighted
                        ? "bg-[#625df5] text-white hover:!bg-[#716df7] hover:!text-white"
                    : card.current
                          ? "cursor-default bg-transparent text-white/35 ring-1 ring-inset ring-white/[0.08] hover:!bg-transparent hover:!text-white/35"
                          : "bg-[#f5f5f5] text-[#1f1f1f] hover:!bg-white hover:!text-[#111]"
                }`}
            >
                {card.cta}
            </Button>
            {card.intro && <p className="mt-7 text-[13px] font-bold leading-none text-white/90">{card.intro}</p>}
            <ul className={`flex flex-col gap-4 ${card.intro ? "mt-6" : "mt-7"}`}>
                {card.features.map((feature) => (
                    <PlanFeature key={feature.text} feature={feature} />
                ))}
            </ul>
            {card.footer && <p className="mt-auto pt-8 text-[11px] font-semibold leading-5 text-white/42">{card.footer}</p>}
        </section>
    );
}

function PlanFeature({ feature }: { feature: PricingCard["features"][number] }) {
    const Icon = feature.icon;
    return (
        <li className="flex items-center gap-3 text-[13px] leading-5 text-white/72">
            <Icon className="size-4 shrink-0 text-white/76" />
            <span className={feature.strong ? "font-bold text-white/90" : "font-semibold"}>{feature.text}</span>
        </li>
    );
}

function displayPrice(plan: Plan | undefined, fallback: string) {
    if (!plan) return fallback;
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(plan.priceCents / 100);
}
