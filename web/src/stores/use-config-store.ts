"use client";

import { useMemo } from "react";
import { create } from "zustand";

import { apiGet } from "@/services/api/request";
import { saveUserPreference } from "@/services/api/preferences";
import type { AdminPublicSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

export type AiConfig = {
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    model3DModel: string;
    videoSeconds: string;
    vquality: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    model3DModels: string[];
    quality: string;
    size: string;
    count: string;
};

export const defaultConfig: AiConfig = {
    model: "gpt-image-2",
    imageModel: "gpt-image-2",
    videoModel: "grok-imagine-video",
    textModel: "gpt-5.5",
    model3DModel: "hunyuan3d",
    videoSeconds: "6",
    vquality: "720",
    systemPrompt: "",
    models: [],
    imageModels: [],
    videoModels: [],
    textModels: [],
    model3DModels: [],
    quality: "auto",
    size: "1:1",
    count: "1",
};

type ConfigStore = {
    config: AiConfig;
    publicSettings: AdminPublicSettings | null;
    isPublicSettingsLoading: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K], sync?: boolean) => void;
    setConfig: (config: Partial<AiConfig>, sync?: boolean) => void;
    loadPublicSettings: () => Promise<void>;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
};

function resolveEffectiveConfig(config: AiConfig, modelChannel: AdminPublicSettings["modelChannel"] | null) {
    const models = modelChannel?.availableModels || [];
    const imageModels = scopedModels(modelChannel?.imageModels, models);
    const videoModels = scopedModels(modelChannel?.videoModels, models);
    const textModels = scopedModels(modelChannel?.textModels, models);
    const model3DModels = scopedModels(modelChannel?.model3DModels, models);
    const fallbackModel = defaultAllowedModel(models, modelChannel?.defaultModel);
    const fallbackImageModel = defaultAllowedModel(imageModels, modelChannel?.defaultImageModel) || defaultAllowedModel(imageModels) || fallbackModel;
    const fallbackVideoModel = defaultAllowedModel(videoModels, modelChannel?.defaultVideoModel) || defaultAllowedModel(videoModels) || fallbackModel;
    const fallbackTextModel = defaultAllowedModel(textModels, modelChannel?.defaultTextModel) || defaultAllowedModel(textModels) || fallbackModel;
    const fallbackModel3D = defaultAllowedModel(model3DModels, modelChannel?.defaultModel3D) || defaultAllowedModel(model3DModels) || fallbackModel;
    return {
        ...config,
        models,
        imageModels,
        videoModels,
        textModels,
        model3DModels,
        model: models.includes(config.model) ? config.model : fallbackModel,
        imageModel: imageModels.includes(config.imageModel) ? config.imageModel : fallbackImageModel,
        videoModel: videoModels.includes(config.videoModel) ? config.videoModel : fallbackVideoModel,
        textModel: textModels.includes(config.textModel) ? config.textModel : fallbackTextModel,
        model3DModel: model3DModels.includes(config.model3DModel) ? config.model3DModel : fallbackModel3D,
        systemPrompt: modelChannel?.systemPrompt || "",
    };
}

function isAiConfigReady(config: AiConfig, model: string) {
    return Boolean(model.trim()) && config.models.includes(model);
}

function defaultAllowedModel(models: string[], model?: string) {
    return model && models.includes(model) ? model : models[0] || "";
}

function scopedModels(models: string[] | undefined, availableModels: string[]) {
    const available = new Set(availableModels);
    const result = Array.from(new Set((models || []).filter((model) => available.has(model))));
    return result.length ? result : availableModels;
}

function normalizeStoredConfig(value: Partial<AiConfig> = {}): AiConfig {
    return {
        ...defaultConfig,
        model: value.model || defaultConfig.model,
        imageModel: value.imageModel || value.model || defaultConfig.imageModel,
        videoModel: value.videoModel || defaultConfig.videoModel,
        textModel: value.textModel || value.model || defaultConfig.textModel,
        model3DModel: value.model3DModel || defaultConfig.model3DModel,
        videoSeconds: value.videoSeconds || defaultConfig.videoSeconds,
        vquality: value.vquality || defaultConfig.vquality,
        systemPrompt: "",
        models: [],
        imageModels: [],
        videoModels: [],
        textModels: [],
        model3DModels: [],
        quality: value.quality || defaultConfig.quality,
        size: value.size || defaultConfig.size,
        count: value.count || defaultConfig.count,
    };
}

function syncPreference(config: AiConfig) {
    const token = useUserStore.getState().token;
    if (token) void saveUserPreference(token, { config });
}

export const useConfigStore = create<ConfigStore>()((set, get) => ({
    config: defaultConfig,
    publicSettings: null,
    isPublicSettingsLoading: false,
    updateConfig: (key, value, sync = true) =>
        set((state) => {
            const config = { ...state.config, [key]: value };
            if (sync) syncPreference(config);
            return { config };
        }),
    setConfig: (patch, sync = true) =>
        set((state) => {
            const config = normalizeStoredConfig({ ...state.config, ...patch });
            if (sync) syncPreference(config);
            return { config };
        }),
    loadPublicSettings: async () => {
        if (get().isPublicSettingsLoading) return;
        set({ isPublicSettingsLoading: true });
        try {
            set({ publicSettings: await apiGet<AdminPublicSettings>("/api/settings") });
        } finally {
            set({ isPublicSettingsLoading: false });
        }
    },
    isAiConfigReady: (config, model) => isAiConfigReady(config, model),
}));

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    const modelChannel = useConfigStore((state) => state.publicSettings?.modelChannel || null);
    return useMemo(() => resolveEffectiveConfig(config, modelChannel), [config, modelChannel]);
}
