"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Button, Tag } from "antd";
import { BadgeCheck, Check, Sparkles, Zap } from "lucide-react";

import { createStripeCheckout, fetchPlans, resolvePlanLocale, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { useUserStore } from "@/stores/use-user-store";

// Floating background rectangles — positions mirror the reference design
const BG_RECTS: { w: number; h: number; top: string; left?: string; right?: string; delay: number }[] = [
    { w: 88,  h: 88,  top: "3%",  left: "1.5%", delay: 0 },
    { w: 124, h: 124, top: "14%", left: "6%",   delay: 1.4 },
    { w: 68,  h: 68,  top: "31%", left: "1%",   delay: 2.6 },
    { w: 104, h: 104, top: "50%", left: "4%",   delay: 0.7 },
    { w: 76,  h: 76,  top: "68%", left: "1.5%", delay: 1.9 },
    { w: 58,  h: 58,  top: "83%", left: "8%",   delay: 3.1 },
    { w: 116, h: 116, top: "6%",  right: "3%",  delay: 0.5 },
    { w: 80,  h: 80,  top: "20%", right: "1%",  delay: 1.6 },
    { w: 148, h: 148, top: "43%", right: "4%",  delay: 2.1 },
    { w: 90,  h: 90,  top: "64%", right: "2%",  delay: 0.3 },
    { w: 110, h: 110, top: "80%", right: "7%",  delay: 2.9 },
    { w: 196, h: 196, top: "70%", left: "14%",  delay: 1.1 },
    { w: 138, h: 138, top: "75%", right: "18%", delay: 1.7 },
];

export default function PricingPage() {
    const router   = useRouter();
    const pathname = usePathname();
    const { message, modal } = App.useApp();
    const { locale } = useI18n();
    const token   = useUserStore((s) => s.token);
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
                title:   en ? "Sign in required" : "需要登录",
                content: en ? "Please sign in to purchase this plan." : "购买套餐需要先登录，登录后将跳转回套餐页。",
                okText:     en ? "Sign in" : "去登录",
                cancelText: en ? "Cancel"  : "取消",
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

    const localizedPlans = plans.map((plan) => resolvePlanLocale(plan, locale));

    return (
        <main className="relative h-full overflow-y-auto bg-[#050505] text-white">
            <style>{`
                @keyframes pricing-rect-float {
                    0%,100% { transform: translateY(0);     opacity: .05; }
                    50%      { transform: translateY(-14px); opacity: .09; }
                }
                @keyframes pricing-header-in {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes pricing-card-in {
                    from { opacity: 0; transform: translateY(32px) scale(.97); }
                    to   { opacity: 1; transform: translateY(0)     scale(1);  }
                }
                .pricing-header-in {
                    animation: pricing-header-in .7s cubic-bezier(.22,1,.36,1) both;
                }
                .pricing-card-in {
                    animation: pricing-card-in .65s cubic-bezier(.22,1,.36,1) both;
                }
            `}</style>

            {/* ── Background layers ─────────────────────────────────────── */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1px,transparent_1.5px)] [background-size:22px_22px] opacity-60" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.26),transparent_36%),radial-gradient(circle_at_80%_15%,rgba(217,70,239,0.15),transparent_40%),linear-gradient(180deg,transparent,#050505_76%)]" />
            <div className="pointer-events-none absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,0.22),rgba(217,70,239,0.15),rgba(56,189,248,0.18),rgba(99,102,241,0.22))] blur-3xl aivro-pricing-aurora" />

            {/* ── Floating rectangles ───────────────────────────────────── */}
            {BG_RECTS.map((r, i) => (
                <div
                    key={i}
                    className="pointer-events-none absolute rounded-sm border border-white/10"
                    style={{
                        width:  r.w,
                        height: r.h,
                        top:    r.top,
                        left:   r.left,
                        right:  r.right,
                        animation: `pricing-rect-float ${5.5 + (i % 4) * 0.8}s ease-in-out ${r.delay}s infinite`,
                    }}
                />
            ))}

            {/* ── Page content ──────────────────────────────────────────── */}
            <div className="relative mx-auto max-w-[90rem] px-6 py-20 sm:px-10">

                {/* Header */}
                <header className="pricing-header-in mb-16 text-center" style={{ animationDelay: "0.1s" }}>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/65 backdrop-blur-sm">
                        <Zap className="size-3.5 text-indigo-300" />
                        {en ? "Simple, one-time pricing" : "简单透明 · 一次性付费"}
                    </span>
                    <h1 className="mx-auto mt-6 max-w-3xl bg-gradient-to-b from-white to-white/50 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                        {en ? "Choose your plan" : "选择适合你的套餐"}
                    </h1>
                    <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/50 md:text-base">
                        {en
                            ? "One-time purchase. Credits for image, video, canvas & AI workflows."
                            : "一次性购买，算力点支持图片、视频、画布和 AI 工作流创作。"}
                    </p>
                </header>

                {/* Cards grid */}
                <div className="grid justify-center gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {localizedPlans.map((plan, i) => (
                        <section
                            key={plan.id}
                            className={`pricing-card-in group relative flex flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 ${
                                plan.recommended
                                    ? "border-indigo-400/40 bg-[linear-gradient(160deg,rgba(99,102,241,0.2)_0%,rgba(14,14,22,0.97)_55%)] shadow-[0_0_60px_-10px_rgba(99,102,241,0.5),0_24px_80px_-20px_rgba(0,0,0,0.9)]"
                                    : "border-white/8 bg-white/[0.03] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] hover:border-white/18 hover:bg-white/[0.055]"
                            }`}
                            style={{ animationDelay: `${0.25 + i * 0.12}s` }}
                        >
                            {/* Top accent line */}
                            {plan.recommended && (
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
                            )}

                            {/* Popular badge */}
                            {plan.recommended && (
                                <div className="pointer-events-none absolute -right-10 top-6 rotate-45 bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-10 py-1 text-[10px] font-bold tracking-widest text-white shadow-lg">
                                    {en ? "POPULAR" : "热门"}
                                </div>
                            )}

                            <div className="flex flex-1 flex-col p-7">
                                {/* Plan name */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                                        {plan.recommended && (
                                            <Tag className="m-0 rounded-full border-indigo-300/20 bg-indigo-500/15 px-2 text-[10px] text-indigo-200">
                                                {en ? "Recommended" : "推荐"}
                                            </Tag>
                                        )}
                                    </div>
                                    <p className="mt-2.5 min-h-[36px] text-sm leading-relaxed text-white/50">
                                        {plan.description || (en ? "Flexible quota for AI creation." : "适合 AI 创作的灵活额度。")}
                                    </p>
                                </div>

                                {/* Price */}
                                <div className="mb-8 border-b border-white/8 pb-8">
                                    <div className="flex items-end gap-1.5">
                                        <span className="bg-gradient-to-b from-white to-white/65 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
                                            {formatPrice(plan)}
                                        </span>
                                        <span className="mb-1.5 text-sm font-medium uppercase tracking-wider text-white/40">
                                            {plan.currency}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-white/35">{en ? "One-time purchase" : "一次性购买"}</p>
                                </div>

                                {/* CTA button */}
                                <Button
                                    className={`mb-8 h-11 rounded-xl border-0 text-sm font-semibold tracking-wide transition-all duration-200 ${
                                        plan.recommended
                                            ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:!opacity-90 hover:shadow-[0_8px_32px_-4px_rgba(99,102,241,0.7)]"
                                            : "bg-white/[0.08] text-white/90 hover:!bg-white/[0.14] hover:!text-white"
                                    }`}
                                    block
                                    loading={loadingPlanId === plan.id}
                                    onClick={() => void buy(plan)}
                                >
                                    {en ? "Get started" : "立即购买"}
                                </Button>

                                {/* Features */}
                                <ul className="flex flex-col gap-3">
                                    <PlanFeature highlight icon={<Sparkles className="size-3.5" />} text={`${plan.credits} ${en ? "credits" : "算力点"}`} />
                                    <PlanFeature highlight icon={<BadgeCheck className="size-3.5" />} text={`${plan.workflowCreateCredits} ${en ? "workflow creations" : "次工作流创建"}`} />
                                    <PlanFeature icon={<Check className="size-3.5" />} text={en ? "Access to all enabled AI models" : "可使用已开放的 AI 模型"} />
                                    <PlanFeature icon={<Check className="size-3.5" />} text={en ? "Cloud workflow quota" : "包含云端工作流额度"} />
                                </ul>

                                <p className="mt-auto pt-8 text-[11px] leading-5 text-white/25">
                                    {en ? "Credits added after Stripe payment confirmed." : "Stripe 支付确认后额度到账。"}
                                </p>
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

function PlanFeature({ icon, text, highlight }: { icon: ReactNode; text: string; highlight?: boolean }) {
    return (
        <li className="flex items-start gap-3">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ${highlight ? "bg-indigo-500/20 text-indigo-300" : "bg-white/[0.07] text-white/50"}`}>
                {icon}
            </span>
            <span className={`min-w-0 break-words text-sm leading-relaxed ${highlight ? "font-medium text-white/90" : "text-white/55"}`}>{text}</span>
        </li>
    );
}

function formatPrice(plan: Plan) {
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(plan.priceCents / 100);
}
