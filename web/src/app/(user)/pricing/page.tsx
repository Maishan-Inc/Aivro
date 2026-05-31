"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Card, Tag } from "antd";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { createKycSession, createStripeCheckout, fetchKycStatus, fetchPlans, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { useUserStore } from "@/stores/use-user-store";

export default function PricingPage() {
    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f6f1e8] dark:bg-stone-950" />}>
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const router = useRouter();
    const search = useSearchParams();
    const { message } = App.useApp();
    const { locale } = useI18n();
    const token = useUserStore((state) => state.token);
    const isReady = useUserStore((state) => state.isReady);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [kyc, setKyc] = useState<{ enabled: boolean; status: string; rewards: { credits: number; workflowCreateCredits: number } } | null>(null);
    const [loadingPlanId, setLoadingPlanId] = useState("");
    const focusKyc = search.get("kyc") === "1";

    useEffect(() => {
        fetchPlans().then(setPlans).catch(() => message.error("读取套餐失败"));
    }, [message]);

    useEffect(() => {
        if (!token) return;
        fetchKycStatus(token).then(setKyc).catch(() => undefined);
    }, [token]);

    const buy = async (plan: Plan) => {
        if (!isReady) return;
        if (!token) {
            router.push("/login?redirect=/pricing");
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

    const startKyc = async () => {
        if (!token) {
            router.push("/login?redirect=/pricing?kyc=1");
            return;
        }
        try {
            const result = await createKycSession(token);
            window.location.href = result.url;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建 KYC 认证失败");
        }
    };

    return (
        <main className="min-h-screen bg-background px-6 py-10 text-stone-950 dark:text-stone-100">
            <div className="mx-auto max-w-6xl">
                <section className={`mb-8 rounded-xl border bg-white p-5 shadow-sm dark:bg-stone-900 ${focusKyc ? "ring-2 ring-emerald-500" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="size-7 text-emerald-600" />
                            <div>
                                <h1 className="text-xl font-semibold">{locale === "en-US" ? "KYC Verification" : "KYC 身份认证"}</h1>
                                <p className="mt-1 text-sm text-stone-500">{locale === "en-US" ? `After approval, you receive ${kyc?.rewards.credits ?? 0} credits and ${kyc?.rewards.workflowCreateCredits ?? 0} workflow creation quota.` : `认证通过后可获得 ${kyc?.rewards.credits ?? 0} 算力点和 ${kyc?.rewards.workflowCreateCredits ?? 0} 次工作流创建次数。`}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Tag color={kyc?.status === "approved" ? "success" : kyc?.status === "pending" ? "processing" : "default"}>{kycStatusText(kyc?.status, locale)}</Tag>
                            <Button type="primary" disabled={!kyc?.enabled || kyc?.status === "approved"} onClick={startKyc}>
                                {locale === "en-US" ? "Start verification" : "开始认证"}
                            </Button>
                        </div>
                    </div>
                </section>

                <header className="mb-8">
                    <p className="text-sm text-stone-500">{locale === "en-US" ? "Plans" : "套餐购买"}</p>
                    <h2 className="mt-2 text-3xl font-semibold">{locale === "en-US" ? "Get credits and cloud workflow quota" : "获取算力点和云端工作流创建次数"}</h2>
                </header>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {plans.map((plan) => (
                        <Card key={plan.id} className="h-full" styles={{ body: { minHeight: 320, display: "flex", flexDirection: "column" } }}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="text-2xl font-semibold">{plan.name}</h3>
                                {plan.recommended ? <Tag color="gold">{locale === "en-US" ? "Recommended" : "推荐"}</Tag> : null}
                            </div>
                            <p className="text-sm text-stone-500">{plan.description}</p>
                            <div className="my-6">
                                <span className="text-3xl font-semibold">{(plan.priceCents / 100).toFixed(2)}</span>
                                <span className="ml-1 text-sm text-stone-500">{plan.currency}</span>
                            </div>
                            <div className="mb-6 grid gap-2 text-sm">
                                <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-emerald-600" />{plan.credits} {locale === "en-US" ? "credits" : "算力点"}</span>
                                <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-emerald-600" />{plan.workflowCreateCredits} {locale === "en-US" ? "workflow creations" : "次工作流创建次数"}</span>
                            </div>
                            <Button type={plan.recommended ? "primary" : "default"} block className="mt-auto" loading={loadingPlanId === plan.id} onClick={() => void buy(plan)}>
                                {locale === "en-US" ? "Buy plan" : "购买套餐"}
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    );
}

function kycStatusText(status: string | undefined, locale: string) {
    const en = locale === "en-US";
    if (status === "approved") return en ? "Approved" : "已通过";
    if (status === "pending") return en ? "Pending" : "认证中";
    if (status === "rejected") return en ? "Rejected" : "未通过";
    return en ? "Not verified" : "未认证";
}
