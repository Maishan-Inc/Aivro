"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App } from "antd";
import { ArrowRight, Users, X } from "lucide-react";

import { createStripeCheckout, type Plan } from "@/services/api/billing";
import { useI18n } from "@/hooks/use-i18n";
import { localeFromPath, withLocalePath } from "@/i18n/routing";
import { FlowBackground } from "@/components/flow-background";
import { PricingCards } from "@/components/pricing-cards";
import styles from "./pricing.module.css";
import { useUserStore } from "@/stores/use-user-store";

export default function PricingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { message, modal } = App.useApp();
    const { locale } = useI18n();
    const token = useUserStore((s) => s.token);
    const isReady = useUserStore((s) => s.isReady);
    const [loadingPlanId, setLoadingPlanId] = useState("");

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
                <PricingCards loadingPlanId={loadingPlanId} onBuy={(plan) => void buy(plan)} />
                <section className={styles.enterprise}>
                    <div><Users size={24} strokeWidth={1.2} /><div><h2>一起创作，走得更远。</h2><p>贵组织需要更多功能？为团队探索更合适的创作方案。</p></div></div>
                    <a href="mailto:enterprise@aivro.org?subject=Aivro%20Enterprise">查看 Aivro Enterprise<ArrowRight size={17} /></a>
                </section>
                <div className={styles.note}><span>让工具顺着想法走，让创作自然发生。</span><Link href={withLocalePath("/#faq", locale)}>了解更多常见问题<ArrowRight size={14} /></Link></div>
            </div>
        </main>
    );
}
