"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Button } from "antd";
import { ArrowRight, BadgeCheck, Brain, CircleDot, Code2, Crown, Image, MessageCircle, Network, Rocket, ShieldCheck, Sparkles, TrendingUp, Users, X, Zap } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { useUserStore } from "@/stores/use-user-store";

type PlanCode = "go" | "plus" | "pro" | "max";
type Feature = { icon: ComponentType<{ className?: string }>; text: string; strong?: boolean };
type PricingCard = {
    code: PlanCode;
    title: string;
    headline: string;
    price: string;
    currency: string;
    subtitle: string;
    cta: string;
    badge?: string;
    highlighted?: boolean;
    intro?: string;
    footnote: string;
    features: Feature[];
    plan?: Plan;
};

const planFeatures: Record<PlanCode, Feature[]> = {
    go: [
        { icon: Sparkles, text: "核心模型", strong: true },
        { icon: MessageCircle, text: "更多消息和上传限额" },
        { icon: Image, text: "更多图片生成限额" },
        { icon: Brain, text: "更多记忆内容" },
        { icon: Zap, text: "扩展额度的语音模式" },
    ],
    plus: [
        { icon: Sparkles, text: "高级模型", strong: true },
        { icon: Image, text: "高级图像创建和编辑" },
        { icon: Brain, text: "扩展容量的跨聊天记忆" },
        { icon: Code2, text: "Codex 编程智能体" },
        { icon: Network, text: "更高级别的深度研究" },
        { icon: BadgeCheck, text: "项目和自定义 GPT" },
    ],
    pro: [
        { icon: TrendingUp, text: "相比 Plus 更高使用额度", strong: true },
        { icon: Sparkles, text: "Pro 前沿模型" },
        { icon: CircleDot, text: "对 Codex 的最大访问权限" },
        { icon: Network, text: "最高级别的深度研究" },
        { icon: MessageCircle, text: "高额度核心聊天" },
        { icon: Image, text: "更快速的图片生成" },
        { icon: Brain, text: "全面的记忆和背景信息" },
    ],
    max: [
        { icon: Crown, text: "最高等级个人额度", strong: true },
        { icon: Rocket, text: "优先访问最新模型能力" },
        { icon: ShieldCheck, text: "更高并发和更高稳定性" },
        { icon: Network, text: "团队前的高级工作流体验" },
        { icon: Image, text: "高频图片、视频、3D 创作" },
        { icon: Sparkles, text: "更多自动化与实验功能" },
    ],
};

const englishFeatures: Record<PlanCode, Feature[]> = {
    go: [
        { icon: Sparkles, text: "Core models", strong: true },
        { icon: MessageCircle, text: "Higher message and upload limits" },
        { icon: Image, text: "More image generation capacity" },
        { icon: Brain, text: "More memory" },
        { icon: Zap, text: "Expanded voice quota" },
    ],
    plus: [
        { icon: Sparkles, text: "Advanced models", strong: true },
        { icon: Image, text: "Advanced image creation and editing" },
        { icon: Brain, text: "Expanded memory across chats" },
        { icon: Code2, text: "Codex coding agent" },
        { icon: Network, text: "Higher-level deep research" },
        { icon: BadgeCheck, text: "Projects and custom GPTs" },
    ],
    pro: [
        { icon: TrendingUp, text: "Higher usage than Plus", strong: true },
        { icon: Sparkles, text: "Pro frontier models" },
        { icon: CircleDot, text: "Maximum Codex access" },
        { icon: Network, text: "Top-level deep research" },
        { icon: MessageCircle, text: "High-volume core chat" },
        { icon: Image, text: "Faster image generation" },
        { icon: Brain, text: "Full memory and context" },
    ],
    max: [
        { icon: Crown, text: "Highest personal quota", strong: true },
        { icon: Rocket, text: "Priority access to the newest models" },
        { icon: ShieldCheck, text: "Higher concurrency and stability" },
        { icon: Network, text: "Advanced workflow experience before Enterprise" },
        { icon: Image, text: "High-frequency image, video, and 3D creation" },
        { icon: Sparkles, text: "More automation and experiments" },
    ],
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
        return {
            code,
            title: `ChatGPT ${planName(code)}`,
            headline: fallbackHeadline(code, en),
            price: displayPrice(plan, fallbackPrice(code)),
            currency: displayCurrency(plan),
            subtitle: fallbackSubtitle(code, en),
            cta: en ? `Upgrade to ${planName(code)}` : `升级至 ${planName(code)}`,
            badge: code === "plus" ? (en ? "Recommended" : "推荐") : undefined,
            highlighted: code === "plus",
            intro: code === "pro" ? (en ? "Everything in Plus, plus:" : "Plus 中的所有内容，以及：") : code === "max" ? (en ? "Everything in Pro, plus:" : "Pro 中的所有内容，以及：") : undefined,
            footnote: en ? "Credits and workflow quota are issued after payment confirmation." : "额度会在支付确认后发放到账户。",
            features: en ? englishFeatures[code] : planFeatures[code],
            plan,
        };
    });

    return (
        <main className="h-full overflow-y-auto bg-[#202020] text-[#f9f9f9]">
            <Link href={withLocalePath("/", locale)} aria-label={en ? "Close pricing" : "关闭套餐页"} className="fixed right-5 top-5 z-10 inline-flex size-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-white/50 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white">
                <X className="size-4" />
            </Link>
            <div className="mx-auto flex min-h-full w-full max-w-[1296px] flex-col px-4 pb-10 pt-12 sm:px-6 lg:pt-16">
                <h1 className="mb-12 text-center text-[2rem] font-semibold leading-none tracking-[0] text-white">{en ? "Upgrade plan" : "升级套餐"}</h1>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <PricingCardView key={card.code} card={card} loading={!!card.plan && loadingPlanId === card.plan.id} en={en} onBuy={() => void buy(card.plan)} />
                    ))}
                </div>
                <div className="mx-auto mt-16 flex flex-col items-center text-center text-[13px] font-medium leading-5 text-white/56">
                    <Users className="mb-3 size-4 text-white/72" />
                    <p>{en ? "Need more for your organization?" : "贵组织需要更多功能？"}</p>
                    <a href="https://chatgpt.com/business/enterprise/" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 text-white/86 underline decoration-white/35 underline-offset-4 transition hover:text-white">
                        {en ? "View ChatGPT Enterprise" : "查看 ChatGPT Enterprise"}
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
            className={`group relative flex min-h-[41.375rem] flex-col overflow-hidden rounded-[18px] border px-6 pb-6 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-300 hover:-translate-y-1 ${
                card.highlighted ? "border-[#4e7fac] bg-[linear-gradient(180deg,#2b547d_0%,#1c2d3b_100%)] shadow-[0_0_52px_rgba(64,133,199,.22)]" : "border-white/[0.10] bg-[#202020]"
            }`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition group-hover:opacity-100" />
            {card.badge && <span className="absolute right-6 top-6 rounded-full bg-[#e8f3ff] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#1f77c9]">{card.badge}</span>}
            <div className="min-h-[15.25rem]">
                <h2 className="text-[15px] font-bold leading-none tracking-[0] text-white/88">{card.title}</h2>
                <h3 className="mt-8 text-[1.55rem] font-semibold leading-tight tracking-[0] text-white">{card.headline}</h3>
                <p className="mt-3 min-h-10 text-[13px] font-medium leading-5 text-white/58">{card.subtitle}</p>
                <div className="mt-11 flex items-end gap-1.5">
                    <span className="pb-5 text-[2.35rem] font-medium leading-none text-white">{currencySymbol(card.currency)}</span>
                    <span className="text-[3.25rem] font-medium leading-[0.85] tracking-[0] text-white">{card.price}</span>
                    <span className="pb-1 text-sm font-bold tracking-[0] text-white/58">{card.currency === "KRW" ? (en ? "/ mo" : "/月") : en ? "/ month" : "/ 月"}</span>
                </div>
            </div>
            <Button
                block
                loading={loading}
                disabled={!card.plan}
                onClick={onBuy}
                className={`mt-4 h-10 rounded-full border-0 text-[13px] font-medium shadow-none ${
                    card.highlighted ? "bg-[#48a5f4] text-white hover:!bg-[#57aff8] hover:!text-white" : "bg-[#f7f7f7] text-[#1f1f1f] hover:!bg-white hover:!text-[#111]"
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
            <p className="mt-auto pt-8 text-[11px] font-semibold leading-5 text-white/40">{card.footnote}</p>
        </section>
    );
}

function PlanFeature({ feature }: { feature: Feature }) {
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

function displayCurrency(plan: Plan | undefined) {
    return (plan?.currency || "USD").toUpperCase();
}

function currencySymbol(currency: string) {
    if (currency === "CNY") return "¥";
    if (currency === "KRW") return "₩";
    if (currency === "EUR") return "€";
    return "$";
}

function planName(code: PlanCode) {
    return code === "max" ? "Max" : code[0].toUpperCase() + code.slice(1);
}

function fallbackHeadline(code: PlanCode, en: boolean) {
    const zh: Record<PlanCode, string> = {
        go: "扩展访问权限",
        plus: "你的 AI 助手",
        pro: "顶级能力",
        max: "最高额度",
    };
    const enText: Record<PlanCode, string> = {
        go: "Expanded access",
        plus: "Your AI assistant",
        pro: "Top capabilities",
        max: "Maximum capacity",
    };
    return en ? enText[code] : zh[code];
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
