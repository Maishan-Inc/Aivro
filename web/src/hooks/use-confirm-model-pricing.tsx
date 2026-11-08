"use client";

import { useCallback } from "react";
import { App } from "antd";
import { hasFreeModelPrice } from "@/lib/model-pricing";
import { useI18n } from "@/hooks/use-i18n";
import type { AdminSettings } from "@/services/api/admin";

export function useConfirmModelPricing() {
    const { modal, message } = App.useApp();
    const { tr } = useI18n();
    return useCallback(async (settings: AdminSettings, previouslyOpen: string[] = []) => {
        const channel = settings.public.modelChannel;
        if (channel.availableModels.some((name) => !channel.modelCosts.find((item) => item.model === name)?.priceConfigured)) {
            message.error(tr("开放模型前请先在模型定价中设置标准价"));
            return false;
        }
        const free = channel.modelCosts.filter((item) => item.priceConfigured && hasFreeModelPrice(item) && (!item.freeConfirmed || (channel.availableModels.includes(item.model) && !previouslyOpen.includes(item.model))));
        if (!free.length) return true;
        const confirmed = await new Promise<boolean>((resolve) => {
            const deadline = Date.now() + 5000;
            const dialog = modal.confirm({
                title: tr("确认零计费模型"),
                content: <div><p>{tr("以下模型存在零计费价格，用户调用将不会扣除对应点数。请确认这是你的定价意图。")}</p><p className="mt-3 break-all" data-i18n-skip>{free.map((item) => item.model).join("、")}</p></div>,
                centered: true,
                okText: tr("等待 {0} 秒").replace("{0}", "5"),
                cancelText: tr("取消"),
                okButtonProps: { disabled: true },
                onOk: () => { if (Date.now() < deadline) return Promise.reject(); resolve(true); },
                onCancel: () => resolve(false),
                afterClose: () => { clearInterval(timer); resolve(false); },
            });
            const timer = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                dialog.update({ okText: remaining ? tr("等待 {0} 秒").replace("{0}", String(remaining)) : tr("同意零计费并保存"), okButtonProps: { disabled: remaining > 0 } });
                if (!remaining) clearInterval(timer);
            }, 200);
        });
        if (confirmed) free.forEach((item) => { item.freeConfirmed = true; });
        return confirmed;
    }, [message, modal, tr]);
}
