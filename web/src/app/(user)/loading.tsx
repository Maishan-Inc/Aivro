"use client";

import { useI18n } from "@/hooks/use-i18n";

export default function Loading() {
    const { tr } = useI18n();
    return <div className="grid h-full min-h-48 place-items-center bg-background text-sm text-muted-foreground" role="status" aria-live="polite">{tr("正在打开工作空间…")}</div>;
}
