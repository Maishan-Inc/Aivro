import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("models");

export default function ModelsLayout({ children }: { children: ReactNode }) {
    return children;
}
