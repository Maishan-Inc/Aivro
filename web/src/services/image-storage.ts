"use client";

import axios from "axios";

import { readImageMeta } from "@/lib/image-utils";
import { authHeader } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
    cloudFileId?: string;
    expiresAt?: string;
};

type CloudImageInput = {
    dataUrl?: string;
    url?: string;
    storageKey?: string;
    cloudFileId?: string;
    width?: number;
    height?: number;
    bytes?: number;
    mimeType?: string;
    expiresAt?: string;
};

type UploadedFileResponse = {
    url: string;
    storageKey: string;
    bytes: number;
    mimeType: string;
    width?: number;
    height?: number;
    cloudFileId: string;
    expiresAt: string;
};

type ApiResponse<T> = { code: number; data: T; msg: string };

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const file = new File([blob], "image.png", { type: blob.type || "image/png" });
    const uploaded = await uploadFile(file);
    const meta = await readImageMeta(uploaded.url);
    return { url: uploaded.url, storageKey: uploaded.storageKey, cloudFileId: uploaded.cloudFileId, expiresAt: uploaded.expiresAt, width: meta.width, height: meta.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType || meta.mimeType };
}

export async function storeGeneratedImage(input: string | Blob | CloudImageInput): Promise<UploadedImage> {
    if (typeof input === "object" && !(input instanceof Blob) && isCloudStorageKey(input.storageKey)) {
        const url = input.dataUrl || input.url || "";
        const meta = input.width && input.height ? { width: input.width, height: input.height, mimeType: input.mimeType || "image/png" } : await readImageMeta(url);
        return { url, storageKey: input.storageKey || "", cloudFileId: input.cloudFileId || input.storageKey?.replace(/^cloud:/, ""), expiresAt: input.expiresAt, width: meta.width, height: meta.height, bytes: input.bytes || 0, mimeType: input.mimeType || meta.mimeType };
    }
    return uploadImage(input as string | Blob);
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey || !storageKey.startsWith("cloud:")) return fallback;
    return fallback || `/api/files/${encodeURIComponent(storageKey.slice("cloud:".length))}/content`;
}

export function isCloudStorageKey(storageKey?: string) {
    return Boolean(storageKey?.startsWith("cloud:"));
}

export async function getImageBlob(storageKey: string, fallbackUrl = "") {
    const url = await resolveImageUrl(storageKey, fallbackUrl);
    return url ? (await fetch(url, authHeaders())).blob() : null;
}

export async function setImageBlob(_storageKey: string, blob: Blob) {
    const image = await uploadImage(blob);
    return image.url;
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await (await fetch(url, authHeaders())).blob());
}

export async function deleteStoredImages(_keys: Iterable<string>) {}

export async function cleanupUnusedImages(_usedData: unknown) {}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("cloud:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

async function uploadFile(file: File) {
    const token = useUserStore.getState().token;
    if (!token) throw new Error("请先登录后再上传文件");
    const formData = new FormData();
    formData.set("file", file);
    const response = await axios.post<ApiResponse<UploadedFileResponse>>("/api/v1/files", formData, { headers: authHeader(token), withCredentials: true });
    if (response.data.code !== 0) throw new Error(response.data.msg || "上传失败");
    return response.data.data;
}

function authHeaders() {
    const token = useUserStore.getState().token;
    return token ? { headers: authHeader(token), credentials: "include" as RequestCredentials } : { credentials: "include" as RequestCredentials };
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
