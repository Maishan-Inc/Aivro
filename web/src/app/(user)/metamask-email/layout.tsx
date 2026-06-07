import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("metamaskEmail");

export default function MetaMaskEmailLayout({ children }: { children: ReactNode }) {
    return children;
}
