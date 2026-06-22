"use client";

import axios from "axios";

import { authHeader } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";

export type UploadedFile = { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number; cloudFileId?: string; expiresAt?: string };

type ApiResponse<T> = { code: number; data: T; msg: string };

export async function uploadMediaFile(input: string | Blob | UploadedFile, _prefix = "file"): Promise<UploadedFile> {
    if (typeof input === "object" && !(input instanceof Blob)) return input;
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const file = new File([blob], blob.type.startsWith("video/") ? "video.mp4" : "file.bin", { type: blob.type || "application/octet-stream" });
    const uploaded = await uploadFile(file);
    const meta = uploaded.mimeType.startsWith("video/") ? await readVideoMeta(uploaded.url) : {};
    return { ...uploaded, ...meta };
}

export async function resolveMediaUrl(storageKey?: string, fallback = "") {
    if (!storageKey || !storageKey.startsWith("cloud:")) return fallback;
    return fallback || `/api/files/${encodeURIComponent(storageKey.slice("cloud:".length))}/content`;
}

export async function getMediaBlob(storageKey: string, fallbackUrl = "") {
    const url = await resolveMediaUrl(storageKey, fallbackUrl);
    return url ? (await fetch(url, authHeaders())).blob() : null;
}

export async function setMediaBlob(_storageKey: string, blob: Blob) {
    const file = await uploadMediaFile(blob);
    return file.url;
}

export async function deleteStoredMedia(_keys: Iterable<string>) {}

export async function cleanupUnusedMedia(_usedData: unknown) {}

export function collectMediaStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("cloud:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectMediaStorageKeys(child, keys)) : collectMediaStorageKeys(item, keys)));
    return keys;
}

async function uploadFile(file: File) {
    const token = useUserStore.getState().token;
    if (!token) throw new Error("请先登录后再上传文件");
    const formData = new FormData();
    formData.set("file", file);
    const response = await axios.post<ApiResponse<UploadedFile>>("/api/v1/files", formData, { headers: authHeader(token), withCredentials: true });
    if (response.data.code !== 0) throw new Error(response.data.msg || "上传失败");
    return response.data.data;
}

function authHeaders() {
    const token = useUserStore.getState().token;
    return token ? { headers: authHeader(token), credentials: "include" as RequestCredentials } : { credentials: "include" as RequestCredentials };
}

function readVideoMeta(url: string) {
    return new Promise<{ width: number; height: number }>((resolve) => {
        const video = document.createElement("video");
        const done = () => resolve({ width: video.videoWidth || 1280, height: video.videoHeight || 720 });
        video.onloadedmetadata = done;
        video.onerror = done;
        video.src = url;
    });
}
