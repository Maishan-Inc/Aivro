import { saveAs } from "file-saver";
import { z } from "zod";

import { createZip, readZip } from "@/lib/zip";
import { getMediaBlob, uploadMediaFile } from "@/services/file-storage";
import { getImageBlob, uploadImage } from "@/services/image-storage";
import type { Asset } from "@/stores/use-asset-store";
import { useLocaleStore } from "@/stores/use-locale-store";
import { translate } from "@/i18n/runtime-translations";

type AssetExportFile = {
    app: "aivro";
    version: 1;
    exportedAt: string;
    assets: Asset[];
    files: AssetExportItem[];
};

type AssetExportItem = {
    storageKey: string;
    path: string;
    mimeType: string;
    bytes: number;
};

const text = z.string();
const baseAsset = {
    id: text.max(128), title: text.max(512), coverUrl: text.max(4 * 1024 * 1024), tags: z.array(text.max(128)).max(64),
    createdAt: text.max(64), updatedAt: text.max(64), source: text.max(8192).optional(), note: text.max(20000).optional(),
    metadata: z.record(text, z.unknown()).optional(),
};
const dimension = z.number().nonnegative().max(100000);
const mediaData = { storageKey: text.min(1).max(256), bytes: z.number().nonnegative().max(64 * 1024 * 1024), width: dimension, height: dimension };
const imageMime = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const videoMime = z.enum(["video/mp4", "video/webm", "video/quicktime"]);
const packageSchema = z.object({
    app: z.literal("aivro"), version: z.literal(1), exportedAt: text.max(64),
    assets: z.array(z.discriminatedUnion("kind", [
        z.object({ ...baseAsset, kind: z.literal("text"), data: z.object({ content: text.max(1000000) }) }),
        z.object({ ...baseAsset, kind: z.literal("image"), data: z.object({ ...mediaData, dataUrl: text.max(8192), mimeType: imageMime }) }),
        z.object({ ...baseAsset, kind: z.literal("video"), data: z.object({ ...mediaData, url: text.max(8192), mimeType: videoMime }) }),
    ])).max(500),
    files: z.array(z.object({ storageKey: mediaData.storageKey, path: text.regex(/^files\/[^/\\:\x00-\x1f]{1,200}$/), mimeType: z.union([imageMime, videoMime]), bytes: mediaData.bytes })).max(500),
});

export async function exportAssets(assets: Asset[]) {
    const files: AssetExportItem[] = [];
    const zipFiles: { name: string; data: BlobPart }[] = [];
    const storageKeys = new Set<string>();

    await Promise.all(
        assets.map(async (asset) => {
            if (asset.kind !== "image" && asset.kind !== "video") return;
            const storageKey = asset.data.storageKey;
            if (!storageKey || storageKeys.has(storageKey)) return;
            storageKeys.add(storageKey);
            const blob = asset.kind === "image" ? await getImageBlob(storageKey, asset.data.dataUrl) : await getMediaBlob(storageKey, asset.data.url);
            if (!blob) return;
            const path = `files/${safeFileName(storageKey)}.${fileExtension(blob.type, asset.kind)}`;
            files.push({ storageKey, path, mimeType: blob.type || asset.data.mimeType, bytes: blob.size });
            zipFiles.push({ name: path, data: blob });
        }),
    );

    const data: AssetExportFile = { app: "aivro", version: 1, exportedAt: new Date().toISOString(), assets, files };
    const zip = await createZip([{ name: "assets.json", data: JSON.stringify(data, null, 2) }, ...zipFiles]);
    saveAs(zip, translate("我的素材.zip", useLocaleStore.getState().locale));
}

export async function readAssetPackage(file: File) {
    let zip: Map<string, Blob>;
    try { zip = await readZip(file); }
    catch (error) { throw new Error(error instanceof Error && error.message === "素材包超过大小或数量限制" ? error.message : "素材包格式无效"); }
    const assetFile = zip.get("assets.json");
    if (!assetFile) throw new Error("素材包缺少 assets.json");
    if (assetFile.size > 4 * 1024 * 1024) throw new Error("素材包超过大小或数量限制");
    let data: z.infer<typeof packageSchema>;
    try { data = packageSchema.parse(JSON.parse(await assetFile.text())); }
    catch { throw new Error("素材包格式无效"); }
    const files = new Map(data.files.map((item) => [item.storageKey, item]));
    const paths = new Set(data.files.map((item) => item.path));
    const references = new Set<string>();
    if (files.size !== data.files.length || paths.size !== data.files.length) throw new Error("素材包格式无效");
    for (const asset of data.assets) {
        if (asset.kind === "text") continue;
        const item = files.get(asset.data.storageKey);
        if (!item || item.mimeType !== asset.data.mimeType || zip.get(item.path)?.size !== item.bytes) throw new Error("素材包格式无效");
        references.add(item.storageKey);
    }
    if (references.size !== files.size) throw new Error("素材包格式无效");
    const uploadedFiles = new Map<string, { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number }>();
    for (let offset = 0; offset < data.files.length; offset += 3) {
        await Promise.all(data.files.slice(offset, offset + 3).map(async (item) => {
            const blob = zip.get(item.path)!;
            const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
            const uploaded = item.mimeType.startsWith("image/") ? await uploadImage(typedBlob) : await uploadMediaFile(typedBlob);
            uploadedFiles.set(item.storageKey, uploaded);
        }));
    }
    return data.assets.map((asset) => {
        asset.coverUrl = safeCoverURL(asset.coverUrl);
        if (asset.kind === "image" && asset.data.storageKey) {
            const uploaded = uploadedFiles.get(asset.data.storageKey);
            if (!uploaded) throw new Error("素材包格式无效");
            const coverUrl = asset.coverUrl === asset.data.dataUrl || asset.coverUrl === asset.data.storageKey || asset.coverUrl.includes(encodeURIComponent(asset.data.storageKey.replace(/^cloud:/, ""))) ? uploaded.url : asset.coverUrl;
            return {
                ...asset,
                coverUrl,
                data: { ...asset.data, dataUrl: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width || asset.data.width, height: uploaded.height || asset.data.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType },
            };
        }
        if (asset.kind === "video" && asset.data.storageKey) {
            const uploaded = uploadedFiles.get(asset.data.storageKey);
            if (!uploaded) throw new Error("素材包格式无效");
            const coverUrl = asset.coverUrl === asset.data.url || asset.coverUrl === asset.data.storageKey || asset.coverUrl.includes(encodeURIComponent(asset.data.storageKey.replace(/^cloud:/, ""))) ? uploaded.url : asset.coverUrl;
            return {
                ...asset,
                coverUrl,
                data: { ...asset.data, url: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width || asset.data.width, height: uploaded.height || asset.data.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType },
            };
        }
        return asset;
    });
}

function safeCoverURL(value: string) {
    if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
    try {
        const url = new URL(value, window.location.origin);
        return value && (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? value : "";
    } catch { return ""; }
}

function safeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

function fileExtension(mimeType: string, kind: Asset["kind"]) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return kind === "image" ? "png" : "bin";
}
