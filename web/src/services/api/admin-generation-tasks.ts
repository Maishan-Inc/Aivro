import { apiGet, compactApiParams } from "@/services/api/request";
import type { AdminLogQuery, AdminLogUser } from "@/services/api/admin";
import type { GenerationHistoryMedia } from "@/services/api/generation-history";

export type AdminGenerationTask = {
    id: string; userId: string; username: string; user?: AdminLogUser;
    model: string; path: string; section: string; prompt: string;
    parameters: Record<string, unknown>; status: string; stage: string; progress: number;
    queuePosition: number; providerTaskId: string; credits: number; requestCount: number;
    retentionDays: number; error: string; errorDetail: string; responseStatus: number;
    createdAt: string; startedAt: string; finishedAt: string; media: GenerationHistoryMedia[];
};
export function fetchAdminGenerationTasks(token: string, query: AdminLogQuery) {
    return apiGet<{ items: AdminGenerationTask[]; total: number }>("/api/admin/generation-tasks", compactApiParams(query), token);
}
export function fetchAdminGenerationTask(token: string, id: string) {
    return apiGet<AdminGenerationTask>(`/api/admin/generation-tasks/${encodeURIComponent(id)}`, undefined, token);
}
