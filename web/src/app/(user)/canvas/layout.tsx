import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("canvas");

export default function CanvasLayout({ children }: { children: ReactNode }) {
    return children;
}
