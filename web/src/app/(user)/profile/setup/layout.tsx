import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("profileSetup");

export default function ProfileSetupLayout({ children }: { children: ReactNode }) {
    return children;
}
