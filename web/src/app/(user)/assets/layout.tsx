import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("assets");

export default function AssetsLayout({ children }: { children: ReactNode }) {
    return children;
}
