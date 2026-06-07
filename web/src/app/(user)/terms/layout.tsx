import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("terms");

export default function TermsLayout({ children }: { children: ReactNode }) {
    return children;
}
