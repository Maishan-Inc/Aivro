import { apiDelete, apiGet, apiPost, compactApiParams } from "@/services/api/request";

export type GenerationHistoryType = "image" | "video" | "model3d" | "free-image" | "prompt-reverse";

export type GenerationHistoryMedia = {
    cloudFileId: string;
    storageKey: string;
    url: string;
    fileType: "image" | "video" | "model3d";
    contentType: string;
    size: number;
    width: number;
    height: number;
    expiresAt: string;
};

export type GenerationHistoryReference = {
    name: string;
    type: string;
    url: string;
    storageKey: string;
};

export type GenerationHistory = {
    publishedAssetId?: string;
    rewardCredits?: number;
    result?: Record<string, unknown>;
    campaignId?: string;
    id: string;
    userId: string;
    type: GenerationHistoryType;
    title: string;
    prompt: string;
    model: string;
    config: Record<string, string>;
    references: GenerationHistoryReference[];
    media: GenerationHistoryMedia[];
    status: "成功" | "失败";
    error: string;
    durationMs: number;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
};

export type GenerationHistoryList = {
    items: GenerationHistory[];
    total: number;
    retentionDays: number;
};

export type SaveGenerationHistoryInput = Pick<GenerationHistory, "type" | "title" | "prompt" | "model" | "config" | "references" | "media" | "status" | "error" | "durationMs">;

export async function fetchGenerationHistories(token: string, query: { type: GenerationHistoryType; page?: number; pageSize?: number }) {
    return apiGet<GenerationHistoryList>("/api/v1/generation-histories", compactApiParams(query), token);
}

export async function saveGenerationHistory(token: string, input: SaveGenerationHistoryInput) {
    return apiPost<GenerationHistory>("/api/v1/generation-histories", input, token);
}

export async function deleteGenerationHistory(token: string, id: string) {
    return apiDelete<boolean>(`/api/v1/generation-histories/${encodeURIComponent(id)}`, token);
}
