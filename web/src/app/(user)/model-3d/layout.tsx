import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("model3d");

export default function Model3DLayout({ children }: { children: ReactNode }) {
    return children;
}
