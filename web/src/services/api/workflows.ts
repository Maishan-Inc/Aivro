import { apiDelete, apiGet, apiPost, apiPut, compactApiParams } from "@/services/api/request";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "@/app/(user)/canvas/types";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "@/app/(user)/canvas/utils/canvas-agent-ops";

export type CloudWorkflow = {
    id: string;
    userId: string;
    slug: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    sourceShareId: string;
    sourceWorkflowId: string;
    sourceSyncMode: "none" | "detached" | "linked";
    sourceVersion: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
};

export type WorkflowListResponse = {
    items: CloudWorkflow[];
    total: number;
};

export type SaveWorkflowInput = Pick<CloudWorkflow, "title" | "nodes" | "connections" | "chatSessions" | "activeChatId" | "backgroundMode" | "showImageInfo" | "viewport">;
export type CreateWorkflowInput = Partial<SaveWorkflowInput> & { slug: string };

export type WorkflowSharePreview = {
    id: string;
    token: string;
    title: string;
    slug: string;
    version: number;
    requiresPassword: boolean;
    snapshot?: CloudWorkflow;
    owner: { id: string; username: string; displayName: string; avatarUrl: string };
    sourceWorkflowId: string;
    starCount: number;
    starred: boolean;
};

export type WorkflowShareSummary = {
    id: string;
    token: string;
    title: string;
    version: number;
    passwordEnabled: boolean;
    sourceWorkflowId: string;
    updatedAt: string;
};

export type WorkflowCommunityPost = {
    id: string;
    userId: string;
    sourceWorkflowId: string;
    token: string;
    title: string;
    sourceWorkflowTitle: string;
    locale: "zh-CN" | "en-US";
    tags: string[];
    snapshot?: CloudWorkflow;
    snapshotWorkflowAt: string;
    status: "active" | "banned";
    banReason: string;
    bannedAt: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
};

export type WorkflowCommunityListResponse = {
    items: WorkflowCommunityPost[];
    total: number;
};

export type WorkflowCommunityPreview = {
    id: string;
    token: string;
    title: string;
    locale: "zh-CN" | "en-US";
    tags: string[];
    snapshot: CloudWorkflow;
    owner: { id: string; username: string; displayName: string; avatarUrl: string };
    sourceWorkflowId: string;
    updatedAt: string;
};

export async function fetchWorkflows(token: string, query: { keyword?: string; page?: number; pageSize?: number } = {}) {
    return apiGet<WorkflowListResponse>("/api/v1/workflows", compactApiParams(query), token);
}

export async function fetchWorkflow(token: string, id: string) {
    return apiGet<CloudWorkflow>(`/api/v1/workflows/${encodeURIComponent(id)}`, undefined, token);
}

export async function createWorkflow(token: string, input: CreateWorkflowInput) {
    return apiPost<CloudWorkflow>("/api/v1/workflows", input, token);
}

export async function updateWorkflow(token: string, id: string, input: SaveWorkflowInput) {
    return apiPut<CloudWorkflow>(`/api/v1/workflows/${encodeURIComponent(id)}`, input, token);
}

export type CanvasAssistantSendInput = {
    sessionId: string;
    text: string;
    messages: CanvasAssistantSession["messages"];
    references?: NonNullable<CanvasAssistantSession["messages"][number]["references"]>;
};

export type CanvasAgentPlanInput = CanvasAssistantSendInput & {
    snapshot: CanvasAgentSnapshot;
    preview?: { ops: CanvasAgentOp[]; snapshot: CanvasAgentSnapshot };
};

export type CanvasAgentUsage = { inputTokens: number; outputTokens: number; totalTokens: number; credits: number; estimated?: boolean };

export async function fetchCanvasAssistantSessions(token: string, workflowId: string) {
    return apiGet<{ items: CanvasAssistantSession[]; total: number }>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/assistant-sessions`, undefined, token);
}

export async function sendCanvasAssistantMessage(token: string, workflowId: string, input: CanvasAssistantSendInput) {
    return apiPost<{ session: CanvasAssistantSession; message: CanvasAssistantSession["messages"][number] }>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/assistant-sessions/message`, input, token);
}

export async function planCanvasAgent(token: string, workflowId: string, input: CanvasAgentPlanInput) {
    return apiPost<{ session: CanvasAssistantSession; message: CanvasAssistantSession["messages"][number]; ops: CanvasAgentOp[]; usage: CanvasAgentUsage }>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/canvas-agent/plan`, input, token);
}

export async function deleteCanvasAssistantSession(token: string, workflowId: string, sessionId: string) {
    return apiDelete<boolean>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/assistant-sessions/${encodeURIComponent(sessionId)}`, token);
}

export async function batchDeleteCanvasAssistantSessions(token: string, workflowId: string, ids: string[]) {
    return apiPost<boolean>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/assistant-sessions/batch-delete`, { ids }, token);
}

export async function deleteWorkflow(token: string, id: string, name: string) {
    return apiPost<boolean>(`/api/v1/workflows/${encodeURIComponent(id)}/delete`, { name }, token);
}

export async function shareWorkflow(token: string, id: string, input: { passwordEnabled: boolean; password?: string }) {
    return apiPost<{ shareUrl: string; share: WorkflowShareSummary }>(`/api/v1/workflows/${encodeURIComponent(id)}/share`, input, token);
}

export async function fetchWorkflowActiveShare(token: string, id: string) {
    return apiGet<{ shareUrl: string; share: WorkflowShareSummary | null }>(`/api/v1/workflows/${encodeURIComponent(id)}/share`, undefined, token);
}

export async function fetchCommunityWorkflows(token: string, query: { keyword?: string; locale?: string; tag?: string[]; page?: number; pageSize?: number } = {}) {
    return apiGet<WorkflowCommunityListResponse>("/api/v1/workflow-community", compactApiParams(query), token);
}

export async function fetchMyCommunityWorkflows(token: string, query: { keyword?: string; page?: number; pageSize?: number } = {}) {
    return apiGet<WorkflowCommunityListResponse>("/api/v1/workflow-community/me", compactApiParams(query), token);
}

export async function publishCommunityWorkflow(token: string, input: { workflowId: string; title: string; locale: "zh-CN" | "en-US"; tags: string[] }) {
    return apiPost<WorkflowCommunityPost>("/api/v1/workflow-community", input, token);
}

export async function syncCommunityWorkflow(token: string, id: string, workflowTitle: string) {
    return apiPost<WorkflowCommunityPost>(`/api/v1/workflow-community/${encodeURIComponent(id)}/sync`, { workflowTitle }, token);
}

export async function deleteCommunityWorkflow(token: string, id: string) {
    return apiDelete<boolean>(`/api/v1/workflow-community/${encodeURIComponent(id)}`, token);
}

export async function fetchCommunityWorkflow(token: string, communityToken: string) {
    return apiGet<WorkflowCommunityPreview>(`/api/v1/workflow-community/${encodeURIComponent(communityToken)}`, undefined, token);
}

export async function fetchWorkflowShare(token: string, shareToken: string, shareAccessToken?: string) {
    return apiGet<WorkflowSharePreview>(`/api/v1/workflow-shares/${encodeURIComponent(shareToken)}`, shareAccessToken ? { shareAccessToken } : undefined, token);
}

export async function fetchWorkflowShareByPath(token: string | undefined, username: string, workflowName: string, shareAccessToken?: string) {
    return apiGet<WorkflowSharePreview>(`/api/workflow-share-paths/${encodeURIComponent(username)}/${encodeURIComponent(workflowName)}`, shareAccessToken ? { shareAccessToken } : undefined, token);
}

export async function verifyWorkflowShare(token: string, shareToken: string, password: string) {
    return apiPost<{ preview: WorkflowSharePreview; shareAccessToken: string }>(`/api/v1/workflow-shares/${encodeURIComponent(shareToken)}/verify`, { password }, token);
}

export async function verifyWorkflowShareByPath(token: string | undefined, username: string, workflowName: string, password: string) {
    return apiPost<{ preview: WorkflowSharePreview; shareAccessToken: string }>(`/api/workflow-share-paths/${encodeURIComponent(username)}/${encodeURIComponent(workflowName)}/verify`, { password }, token);
}

export async function copyWorkflowShare(token: string, shareToken: string, input: { slug: string; mode: "detached" | "linked"; password?: string; shareAccessToken?: string }) {
    return apiPost<CloudWorkflow>(`/api/v1/workflow-shares/${encodeURIComponent(shareToken)}/copy`, input, token);
}

export async function forkWorkflowShareByPath(token: string, username: string, workflowName: string, input: { slug: string; mode: "detached" | "linked"; password?: string; shareAccessToken?: string }) {
    return apiPost<CloudWorkflow>(`/api/v1/workflow-share-paths/${encodeURIComponent(username)}/${encodeURIComponent(workflowName)}/copy`, input, token);
}

export async function toggleWorkflowShareStar(token: string, username: string, workflowName: string) {
    return apiPost<{ starred: boolean; starCount: number }>(`/api/v1/workflow-share-paths/${encodeURIComponent(username)}/${encodeURIComponent(workflowName)}/star`, {}, token);
}
