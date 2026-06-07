import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("pricing");

export default function PricingLayout({ children }: { children: ReactNode }) {
    return children;
}
