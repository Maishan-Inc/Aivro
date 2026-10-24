"use client";

import { App } from "antd";
import copy from "copy-to-clipboard";
import { useI18n } from "@/hooks/use-i18n";

export function useCopyText() {
    const { message } = App.useApp();
    const { tr } = useI18n();

    return (value: string, successText = "已复制") => {
        copy(value);
        message.success(tr(successText));
    };
}
