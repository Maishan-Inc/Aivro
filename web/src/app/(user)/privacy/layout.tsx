import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("privacy");

export default function PrivacyLayout({ children }: { children: ReactNode }) {
    return children;
}
