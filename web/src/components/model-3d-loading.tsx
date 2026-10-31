"use client";

import { useI18n } from "@/hooks/use-i18n";
import styles from "./model-3d-loading.module.css";

export function Model3DLoading({ label = "正在生成 3D 模型" }: { label?: string }) {
    const { tr } = useI18n();
    return <div role="status" className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-6 p-5 text-center text-current">
        <div aria-hidden="true" className={styles.square} />
        <span className="text-xs opacity-60">{tr(label)}</span>
    </div>;
}
