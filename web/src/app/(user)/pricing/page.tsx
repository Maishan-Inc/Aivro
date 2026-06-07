"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Button, Tag } from "antd";
import { BadgeCheck, Sparkles } from "lucide-react";

import { createStripeCheckout, fetchPlans, type Plan } from "@/services/api/billing";
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

    useEffect(() => {
        fetchPlans().then(setPlans).catch(() => message.error("读取套餐失败"));
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
            const result = await createStripeCheckout(token, plan.id);
            window.location.href = result.checkoutUrl;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建支付失败");
        } finally {
            setLoadingPlanId("");
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#050505] px-5 py-12 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.5px)] [background-size:18px_18px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.08),#050505_72%)]" />
            <div className="relative mx-auto max-w-[90rem]">
                <header className="mb-10 text-center">
                    <p className="text-sm font-medium text-white/55">{locale === "en-US" ? "Plans" : "套餐购买"}</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{locale === "en-US" ? "Choose the plan that fits your workflow" : "选择适合你的创作套餐"}</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">{locale === "en-US" ? "Get credits and cloud workflow quota for image, video, canvas, and AI creation." : "获取算力点和云端工作流创建次数，支持图片、视频、画布和 AI 创作。"}</p>
                </header>

                <div className="grid justify-center gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    {plans.map((plan) => (
                        <section key={plan.id} className={`group flex min-h-[520px] w-full min-w-0 flex-col rounded-2xl border p-8 shadow-2xl transition duration-300 sm:min-w-[18rem] xl:min-w-0 ${plan.recommended ? "border-indigo-300/45 bg-[linear-gradient(180deg,rgba(89,86,178,0.9),rgba(32,32,43,0.96))] shadow-indigo-950/40" : "border-white/12 bg-[#202020]/95 shadow-black/40 hover:border-white/24"}`}>
                            <div className="mb-10 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-3xl font-semibold tracking-normal text-white">{plan.name}</h2>
                                    <p className="mt-4 min-h-12 text-base leading-6 text-white/66">{plan.description || (locale === "en-US" ? "Flexible quota for AI creation." : "适合 AI 创作的灵活额度。")}</p>
                                </div>
                                {plan.recommended ? <Tag className="m-0 border-indigo-200/20 bg-white/12 text-white">{locale === "en-US" ? "Recommended" : "推荐"}</Tag> : null}
                            </div>

                            <div className="mb-8">
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-semibold tracking-normal">{formatPrice(plan)}</span>
                                    <span className="pb-1 text-xs font-medium text-white/60">{plan.currency}</span>
                                </div>
                                <p className="mt-2 text-xs text-white/45">{locale === "en-US" ? "One-time package purchase" : "一次性套餐购买"}</p>
                            </div>

                            <Button className={`mb-8 h-12 rounded-full border-0 font-medium ${plan.recommended ? "bg-indigo-500 text-white hover:!bg-indigo-400 hover:!text-white" : "bg-white text-neutral-950 hover:!bg-white/90 hover:!text-neutral-950"}`} block loading={loadingPlanId === plan.id} onClick={() => void buy(plan)}>
                                {locale === "en-US" ? "Buy plan" : "购买套餐"}
                            </Button>

                            <div className="grid gap-5 text-base text-white/82">
                                <PlanFeature icon={<Sparkles className="size-4" />} text={`${plan.credits} ${locale === "en-US" ? "credits" : "算力点"}`} />
                                <PlanFeature icon={<BadgeCheck className="size-4" />} text={`${plan.workflowCreateCredits} ${locale === "en-US" ? "workflow creations" : "次工作流创建次数"}`} />
                                <PlanFeature icon={<BadgeCheck className="size-4" />} text={locale === "en-US" ? "Access to enabled AI models" : "可使用已开放的 AI 模型"} />
                                <PlanFeature icon={<BadgeCheck className="size-4" />} text={locale === "en-US" ? "Cloud workflow quota included" : "包含云端工作流额度"} />
                            </div>

                            <p className="mt-auto pt-10 text-xs leading-5 text-white/45">{locale === "en-US" ? "Quota is added after payment is confirmed by Stripe webhook." : "额度会在 Stripe webhook 确认支付后到账。"}</p>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

function PlanFeature({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-white/76">{icon}</span>
            <span>{text}</span>
        </div>
    );
}

function formatPrice(plan: Plan) {
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(plan.priceCents / 100);
}
