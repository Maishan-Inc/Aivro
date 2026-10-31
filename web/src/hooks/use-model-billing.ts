"use client";

import { requestCreditCost, type GenerationKind, type Model3DPricing, type VideoPricing } from "@/constant/credits";
import { resolveVideoConfig } from "@/lib/video-models";
import { useConfigStore } from "@/stores/use-config-store";

export type ModelBillingOptions = { model: string; kind: GenerationKind; count?: string | number; model3D?: Model3DPricing; video?: VideoPricing };

export function useModelBilling({ model, kind, count, model3D, video }: ModelBillingOptions) {
    const channel = useConfigStore((state) => state.publicSettings?.modelChannel);
    const loading = useConfigStore((state) => state.isPublicSettingsLoading);
    const globalConfig = useConfigStore((state) => state.config);
    const videoConfig = kind === "video" ? resolveVideoConfig({ ...globalConfig, ...video, videoModels: channel?.videoModels || [] }, model) : undefined;
    const baseCost = channel?.availableModels.includes(model) ? channel.modelCosts.find((item) => item.model === model) : undefined;
    const cost = videoConfig?.videoBillingType === "second" && baseCost?.videoSecondPrice ? { ...baseCost, credits: baseCost.videoSecondPrice.credits } : baseCost;
    // 与站内请求一致：词元结算目前仅用于文本/助手，媒体任务按数量和参数扣费。
    const billingType = kind === "text" && cost?.billingType === "token" ? "token" : videoConfig?.videoBillingType || "fixed";
    const quantity = kind === "image" || kind === "text" ? Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1))) : kind === "model3d" ? Math.max(1, Math.min(4, Math.floor(model3D?.quantity || 1))) : 1;
    const credits = baseCost ? requestCreditCost({ modelCosts: [baseCost], model, count: quantity, model3D: kind === "model3d" ? model3D : undefined, video: videoConfig }) : null;
    const unavailable = !model ? "选择模型" : !channel ? (loading ? "计费信息加载中" : "计费信息暂不可用") : !channel.availableModels.includes(model) ? "该模型未开放" : "该模型尚未配置计费";
    return { cost, billingType, quantity, credits, unavailable, videoSeconds: videoConfig?.videoSeconds };
}
