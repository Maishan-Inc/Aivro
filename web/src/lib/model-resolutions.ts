import { useConfigStore } from "@/stores/use-config-store";

export const imageResolutionOptions = ["1k", "2k", "4k", "8k"].map((value) => ({ value, label: value.toUpperCase() }));
export const videoResolutionOptions = ["480p", "720p", "768p", "1080p", "1440p", "4k"].map((value) => ({ value, label: value === "1440p" ? "2K (1440p)" : value === "4k" ? "4K" : value }));
export const defaultImageResolutions = ["1k", "2k", "4k"];
const imagePixels: Record<string, number> = { "1k": 1024, "2k": 2048, "4k": 4096, "8k": 8192 };

export function maxImagePixels(resolutions = defaultImageResolutions) {
    return Math.max(0, ...resolutions.map((value) => imagePixels[value] || 0));
}

export function imageSizeLimit(model: string) {
    return maxImagePixels(useConfigStore.getState().publicSettings?.modelChannel.modelCosts.find((item) => item.model === model)?.resolutions);
}

export function clampImageSize(size: string, limit: number) {
    const match = size.match(/^(\d+)x(\d+)$/);
    if (!match) return size;
    const scale = Math.min(1, limit / Math.max(Number(match[1]), Number(match[2]), 1));
    return `${Math.max(1, Math.floor(Number(match[1]) * scale))}x${Math.max(1, Math.floor(Number(match[2]) * scale))}`;
}

export function validateImageSize(size: string, limit: number) {
    if (!size || size === "auto" || ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"].includes(size)) return;
    const match = size.match(/^(\d+)x(\d+)$/);
    if (!match) throw new Error("请使用有效的像素尺寸");
    if (Number(match[1]) < 1 || Number(match[2]) < 1 || Number(match[1]) > limit || Number(match[2]) > limit) throw new Error("宽高不能超过模型配置的分辨率上限");
}
