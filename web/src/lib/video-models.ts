import type { VideoCapabilities } from "@/services/api/admin";
import { resolveVideoModel, useConfigStore, type AiConfig } from "@/stores/use-config-store";

const genericCapabilities: VideoCapabilities = { minImages: 0, maxImages: 7, durations: Array.from({ length: 20 }, (_, i) => i + 1), resolutions: ["720p", "480p", "1080p"], aspectRatios: ["16:9", "9:16", "1:1"] };

export function getVideoCapabilities(model: string) {
    return useConfigStore.getState().publicSettings?.modelChannel.videoCapabilities?.[model] || genericCapabilities;
}

export function videoResolution(value: string) {
    if (value === "4k") return value;
    if (value === "low") return "480p";
    if (["", "auto", "high", "medium"].includes(value)) return "720p";
    return `${value.replace(/p$/i, "")}p`;
}

export function videoAspectRatio(value: string) {
    return ({ "1280x720": "16:9", "1920x1080": "16:9", "720x1280": "9:16", "1080x1920": "9:16", "1024x1024": "1:1" } as Record<string, string>)[value] || value;
}

export function videoDurationsFor(model: string, resolution: string) {
    const adapter = useConfigStore.getState().publicSettings?.modelChannel.videoAdapters?.[model];
    if (adapter === "gptge-hailuo" && videoResolution(resolution) === "1080p") return [6];
    if (adapter === "fal-veo" && videoResolution(resolution) !== "720p") return [8];
    return getVideoCapabilities(model).durations;
}

// 显示、费用预估和提交共用同一份有效参数；切换模型时选用其支持的规格。
export function resolveVideoConfig(config: AiConfig, preferredModel = config.model): AiConfig {
    const model = resolveVideoModel(config, preferredModel);
    const caps = getVideoCapabilities(model);
    const resolution = videoResolution(config.vquality);
    const vquality = caps.resolutions.includes(resolution) ? resolution : caps.resolutions[0];
    const durations = videoDurationsFor(model, vquality);
    const seconds = Number(config.videoSeconds);
    const size = videoAspectRatio(config.size);
    const price = useConfigStore.getState().publicSettings?.modelChannel.modelCosts.find((item) => item.model === model);
    return { ...config, model, videoModel: model, vquality, size: caps.aspectRatios.includes(size) ? size : caps.aspectRatios[0], videoSeconds: String(durations.includes(seconds) ? seconds : durations[0]), videoBillingType: config.videoBillingType === "second" && price?.videoSecondPrice ? "second" : "fixed" };
}
