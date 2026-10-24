import { apiGet, apiPost } from "@/services/api/request";
import type { GenerationTaskSubmitResult } from "@/services/api/image";

export type Model3DMode = "image" | "multi_image" | "text";

export type Model3DGenerationInput = {
    model: string;
    mode: Model3DMode;
    prompt: string;
    images: { name: string; type: string; url: string; storageKey: string }[];
    textureEnabled: boolean;
    pbrEnabled: boolean;
    meshQuality: "standard" | "high" | "ultra";
    targetFaceCount: number;
    quantity: number;
};

export type Model3DGeneratedAsset = {
    id: string;
    url: string;
    storageKey: string;
    cloudFileId: string;
    bytes: number;
    mimeType: string;
    thumbnailUrl?: string;
    vertices: number;
    faces: number;
    expiresAt: string;
};

export type Model3DGenerationResult = {
    id: string;
    providerTaskId: string;
    status: string;
    model: string;
    mode: string;
    prompt: string;
    energyCost: number;
    results: Model3DGeneratedAsset[];
    config: Record<string, string>;
    references: { name: string; type: string; url: string; storageKey: string }[];
    durationMs: number;
    error: string;
    createdAt: string;
    completedAt: string;
};

export async function requestModel3DGeneration(token: string, input: Model3DGenerationInput) {
    const submitted = await apiPost<Model3DGenerationResult | GenerationTaskSubmitResult>("/api/v1/model-3d/generations", input, token);
    if (!("queued" in submitted)) return submitted;
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await getModel3DGeneration(token, submitted.taskId);
        if (current.status === "completed") return current;
        if (current.status === "failed" || current.status === "canceled") throw new Error(current.error || "生成失败");
    }
}

export async function getModel3DGeneration(token: string, id: string) {
    return apiGet<Model3DGenerationResult>(`/api/v1/model-3d/generations/${encodeURIComponent(id)}`, undefined, token);
}
