"use client";

import { Input } from "antd";
import type { TextAreaProps } from "antd/es/input/TextArea";
import { useI18n } from "@/hooks/use-i18n";
import styles from "./image-prompt-composer.module.css";

export function PromptInput({ expanded, onExpand, value, placeholder = "", autoSize = { minRows: 1 }, autoFocus = true, ...props }: TextAreaProps & { expanded: boolean; onExpand: () => void }) {
    const { tr } = useI18n();
    if (!expanded) return <button type="button" className={styles.promptPreview} onClick={onExpand} aria-label={tr("查看提示词")} aria-expanded={false} data-i18n-skip>
        <span className={String(value || "").trim() ? undefined : "text-muted-foreground"}>{String(value || "").replace(/\s+/g, " ").trim() || tr(placeholder)}</span>
    </button>;
    return <Input.TextArea {...props} value={value} placeholder={tr(placeholder)} aria-label={tr(props["aria-label"] || "提示词")} aria-expanded autoSize={autoSize} autoFocus={autoFocus} data-i18n-skip />;
}
