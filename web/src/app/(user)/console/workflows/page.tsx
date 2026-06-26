import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isLocale } from "@/i18n/routing";

export default async function ConsoleWorkflowsPage() {
    const headerStore = await headers();
    const locale = headerStore.get("x-aivro-locale");

    redirect(isLocale(locale || undefined) ? `/${locale}/canvas` : "/canvas");
}
