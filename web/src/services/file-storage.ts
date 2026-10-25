"use client";

import axios from "axios";

import { authHeader } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";

export type UploadedFile = { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number; cloudFileId?: string; expiresAt?: string };

type ApiResponse<T> = { code: number; data: T; msg: string };

export async function uploadMediaFile(input: string | Blob | UploadedFile, _prefix = "file"): Promise<UploadedFile> {
    if (typeof input === "object" && !(input instanceof Blob)) return input.mimeType.startsWith("video/") && (!input.width || !input.height) ? { ...input, ...await readVideoMeta(input.url) } : input;
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
    return new Promise<{ width?: number; height?: number }>((resolve) => {
        const video = document.createElement("video");
        const done = () => {
            const meta = video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : {};
            window.clearTimeout(timeout);
            video.onloadedmetadata = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
            resolve(meta);
        };
        const timeout = window.setTimeout(done, 15000);
        video.onloadedmetadata = done;
        video.onerror = done;
        video.preload = "metadata";
        video.src = url;
    });
}
