import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("prompts");

export default function PromptsLayout({ children }: { children: ReactNode }) {
    return children;
}
