import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("video");

export default function VideoLayout({ children }: { children: ReactNode }) {
    return children;
}
