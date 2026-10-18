import { apiDelete, apiGet, apiPost, compactApiParams } from "@/services/api/request";

export type AssetLibraryItem = {
    id: string;
    title: string;
    type: "text" | "image" | "video";
    coverUrl: string;
    tags: string[];
    category: string;
    description: string;
    content: string;
    url: string;
    createdAt: string;
    updatedAt: string;
};

export type AssetLibraryResponse = {
    items: AssetLibraryItem[];
    tags: string[];
    total: number;
};

export type AssetLibraryQuery = {
    keyword?: string;
    type?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export async function fetchAssetLibrary(query: AssetLibraryQuery = {}) {
    return apiGet<AssetLibraryResponse>("/api/assets", compactApiParams(query));
}

export function retainAssetFiles(token: string, id: string, fileIds: string[]) {
    return apiPost<boolean>(`/api/v1/asset-files/${encodeURIComponent(id)}`, { fileIds }, token);
}

export function releaseAssetFiles(token: string, id: string) {
    return apiDelete<boolean>(`/api/v1/asset-files/${encodeURIComponent(id)}`, token);
}
