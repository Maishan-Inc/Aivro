import type { ReactNode } from "react";

import { generateLocalizedMetadata } from "@/lib/page-metadata";

export const generateMetadata = () => generateLocalizedMetadata("forgotPassword");

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
    return children;
}
