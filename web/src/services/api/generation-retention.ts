import { apiGet, apiPost } from "@/services/api/request";
import type { AdminUser } from "@/services/api/admin";

export const generationGroups = ["free", "go", "plus", "pro", "max"] as const;
export const generationSections = [
    { key: "workflow", label: "工作流" },
    { key: "image", label: "生图工作台" },
    { key: "video", label: "视频创作台" },
    { key: "model3d", label: "3D 模型工作台" },
    { key: "free-image", label: "免费生成图片" },
    { key: "prompt-reverse", label: "提示词反推" },
] as const;
export type GenerationRetention = { group: string; days: Record<string, number>; updatedAt?: string };

export function fetchGenerationRetention(token: string) {
    return apiGet<GenerationRetention>("/api/v1/generation-retention", undefined, token);
}
export function fetchAdminGenerationRetention(token: string) {
    return apiGet<GenerationRetention[]>("/api/admin/generation-retention", undefined, token);
}
export function saveAdminGenerationRetention(token: string, value: GenerationRetention) {
    return apiPost<GenerationRetention>("/api/admin/generation-retention", value, token);
}
export function saveAdminUserGenerationRetention(token: string, id: string, value: GenerationRetention) {
    return apiPost<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/generation-retention`, value, token);
}
