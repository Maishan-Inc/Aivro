"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Button, Tag } from "antd";
import { BadgeCheck, Check, Sparkles, Zap } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { useUserStore } from "@/stores/use-user-store";

export default function PricingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { message } = App.useApp();
    const { locale } = useI18n();
    const token = useUserStore((state) => state.token);
    const isReady = useUserStore((state) => state.isReady);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingPlanId, setLoadingPlanId] = useState("");
    const en = locale === "en-US";

    useEffect(() => {
        fetchPlans()
            .then(setPlans)
            .catch(() => message.error("读取套餐失败"));
    }, [message]);

    const buy = async (plan: Plan) => {
        if (!isReady) return;
        if (!token) {
            const activeLocale = localeFromPath(pathname) || locale;
            router.push(withLocalePath(`/login?redirect=${encodeURIComponent(withLocalePath("/pricing", activeLocale))}`, activeLocale));
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

    const localizedPlans = plans.map((plan) => resolvePlanLocale(plan, locale));

    return (
        <main className="relative h-full overflow-y-auto bg-[#050505] px-5 py-16 text-white">
            {/* Animated aurora + dot-grid backdrop */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1.5px)] [background-size:20px_20px] opacity-70" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.28),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(217,70,239,0.18),transparent_40%),linear-gradient(180deg,rgba(5,5,5,0),#050505_78%)]" />
            <div className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,0.25),rgba(217,70,239,0.18),rgba(56,189,248,0.22),rgba(99,102,241,0.25))] blur-3xl aivro-pricing-aurora" />

            <div className="relative mx-auto max-w-[88rem]">
                <header className="mb-14 text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
                        <Zap className="size-3.5 text-indigo-300" />
                        {en ? "Simple, one-time pricing" : "简单透明 · 一次性付费"}
                    </span>
                    <h1 className="mx-auto mt-6 max-w-3xl bg-gradient-to-b from-white to-white/55 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
                        {en ? "Choose the plan that fits your workflow" : "选择适合你的创作套餐"}
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/55 md:text-base">
                        {en ? "Get credits and cloud workflow quota for image, video, canvas, and AI creation." : "获取算力点和云端工作流创建次数，支持图片、视频、画布和 AI 创作。"}
                    </p>
                </header>

                <div className="grid justify-center gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    {localizedPlans.map((plan) => (
                        <section
                            key={plan.id}
                            className={`group relative flex min-h-[540px] w-full min-w-0 flex-col overflow-hidden rounded-3xl border p-8 backdrop-blur-xl transition duration-300 hover:-translate-y-1 sm:min-w-[18rem] xl:min-w-0 ${
                                plan.recommended
                                    ? "border-indigo-300/50 bg-[linear-gradient(180deg,rgba(99,102,241,0.22),rgba(20,20,28,0.96))] shadow-[0_24px_80px_-20px_rgba(99,102,241,0.55)]"
                                    : "border-white/10 bg-white/[0.04] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] hover:border-white/25 hover:bg-white/[0.06]"
                            }`}
                        >
                            {plan.recommended ? (
                                <div className="pointer-events-none absolute -right-12 top-7 rotate-45 bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-12 py-1 text-center text-[11px] font-semibold tracking-wide text-white shadow-lg">
                                    {en ? "POPULAR" : "热门"}
                                </div>
                            ) : null}

                            <div className="mb-8">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-semibold tracking-normal text-white">{plan.name}</h2>
                                    {plan.recommended ? (
                                        <Tag className="m-0 rounded-full border-indigo-200/25 bg-white/10 px-2.5 text-[11px] text-indigo-100">{en ? "Recommended" : "推荐"}</Tag>
                                    ) : null}
                                </div>
                                <p className="mt-3 min-h-[40px] text-sm leading-6 text-white/60">{plan.description || (en ? "Flexible quota for AI creation." : "适合 AI 创作的灵活额度。")}</p>
                            </div>

                            <div className="mb-7">
                                <div className="flex items-end gap-2">
                                    <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">{formatPrice(plan)}</span>
                                    <span className="pb-1.5 text-xs font-medium uppercase text-white/55">{plan.currency}</span>
                                </div>
                                <p className="mt-2 text-xs text-white/45">{en ? "One-time package purchase" : "一次性套餐购买"}</p>
                            </div>

                            <Button
                                className={`mb-8 h-12 rounded-full border-0 text-sm font-semibold transition ${
                                    plan.recommended
                                        ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-900/40 hover:!opacity-90"
                                        : "bg-white text-neutral-950 hover:!bg-white/90 hover:!text-neutral-950"
                                }`}
                                block
                                loading={loadingPlanId === plan.id}
                                onClick={() => void buy(plan)}
                            >
                                {en ? "Buy plan" : "购买套餐"}
                            </Button>

                            <div className="grid gap-4 text-sm text-white/80">
                                <PlanFeature highlight icon={<Sparkles className="size-4" />} text={`${plan.credits} ${en ? "credits" : "算力点"}`} />
                                <PlanFeature highlight icon={<BadgeCheck className="size-4" />} text={`${plan.workflowCreateCredits} ${en ? "workflow creations" : "次工作流创建次数"}`} />
                                <PlanFeature icon={<Check className="size-4" />} text={en ? "Access to enabled AI models" : "可使用已开放的 AI 模型"} />
                                <PlanFeature icon={<Check className="size-4" />} text={en ? "Cloud workflow quota included" : "包含云端工作流额度"} />
                            </div>

                            <p className="mt-auto pt-9 text-xs leading-5 text-white/40">{en ? "Quota is added after payment is confirmed by Stripe webhook." : "额度会在 Stripe webhook 确认支付后到账。"}</p>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

function PlanFeature({ icon, text, highlight }: { icon: ReactNode; text: string; highlight?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${highlight ? "bg-indigo-500/20 text-indigo-200" : "bg-white/8 text-white/70"}`}>{icon}</span>
            <span className={highlight ? "font-medium text-white" : ""}>{text}</span>
        </div>
    );
}

function formatPrice(plan: Plan) {
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(plan.priceCents / 100);
}
