import { apiDelete, apiGet, apiPost } from "@/services/api/request";

export type UserAPIKey = {
    id: string;
    name: string;
    preview: string;
    status: "active" | "revoked";
    lastUsedAt: string;
    createdAt: string;
    revokedAt: string;
};

export type UserAPIKeyList = { items: UserAPIKey[]; total: number };
export type CreatedUserAPIKey = { item: UserAPIKey; key: string };

export const listAPIKeys = (token: string, page: number, pageSize: number) => apiGet<UserAPIKeyList>("/api/v1/api-keys", { page, pageSize }, token);
export const createAPIKey = (token: string, name: string) => apiPost<CreatedUserAPIKey>("/api/v1/api-keys", { name }, token);
export const revokeAPIKey = (token: string, id: string) => apiDelete<boolean>(`/api/v1/api-keys/${encodeURIComponent(id)}`, token);
