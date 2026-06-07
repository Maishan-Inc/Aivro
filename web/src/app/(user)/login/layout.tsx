import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("login");

export default function LoginLayout({ children }: { children: ReactNode }) {
    return children;
}
