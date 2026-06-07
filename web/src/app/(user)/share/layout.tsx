import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("workflowShare");

export default function ShareLayout({ children }: { children: ReactNode }) {
    return children;
}
