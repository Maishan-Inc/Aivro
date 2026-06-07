import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("assetLibrary");

export default function AssetLibraryLayout({ children }: { children: ReactNode }) {
    return children;
}
