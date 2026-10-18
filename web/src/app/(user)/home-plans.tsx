"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import styles from "./home.module.css";

export function HomePlans() {
    const localizedPath = useLocalizedPath();

    return <section id="plans" className={styles.plansSection} aria-labelledby="plans-title" data-reveal>
        <div className={styles.discoveryHeading}>
            <div><span className={styles.eyebrow}>为每一种创作节奏</span><h2 id="plans-title">套餐推荐</h2></div>
            <Link href={localizedPath("/pricing")} className={styles.textLink}>查看全部套餐 <ArrowUpRight size={17} /></Link>
        </div>
        <PricingCards carousel />
    </section>;
}
