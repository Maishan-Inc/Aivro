import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("pricingSuccess");

export default function PricingSuccessLayout({ children }: { children: ReactNode }) {
    return children;
}
