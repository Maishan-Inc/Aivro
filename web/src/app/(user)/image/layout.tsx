import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("image");

export default function ImageLayout({ children }: { children: ReactNode }) {
    return children;
}
