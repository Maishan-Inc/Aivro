import { saveAs } from "file-saver";

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

export async function exportAssets(assets: Asset[]) {
    const files: AssetExportItem[] = [];
    const zipFiles: { name: string; data: BlobPart }[] = [];

    await Promise.all(
        assets.map(async (asset) => {
            if (asset.kind !== "image" && asset.kind !== "video") return;
            const storageKey = asset.data.storageKey;
            if (!storageKey) return;
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
    const zip = await readZip(file);
    const assetFile = zip.get("assets.json");
    if (!assetFile) throw new Error("素材包缺少 assets.json");
    const data = JSON.parse(await assetFile.text()) as AssetExportFile;
    const uploadedFiles = new Map<string, { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number }>();
    await Promise.all(
        data.files.map(async (item) => {
            const blob = zip.get(item.path);
            if (!blob) return;
            const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
            const uploaded = item.mimeType.startsWith("image/") ? await uploadImage(typedBlob) : await uploadMediaFile(typedBlob);
            uploadedFiles.set(item.storageKey, uploaded);
        }),
    );
    return data.assets.map((asset) => {
        if (asset.kind === "image" && asset.data.storageKey) {
            const uploaded = uploadedFiles.get(asset.data.storageKey);
            if (!uploaded) return asset;
            const coverUrl = asset.coverUrl === asset.data.dataUrl || asset.coverUrl === asset.data.storageKey || asset.coverUrl.includes(encodeURIComponent(asset.data.storageKey.replace(/^cloud:/, ""))) ? uploaded.url : asset.coverUrl;
            return {
                ...asset,
                coverUrl,
                data: { ...asset.data, dataUrl: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width || asset.data.width, height: uploaded.height || asset.data.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType },
            };
        }
        if (asset.kind === "video" && asset.data.storageKey) {
            const uploaded = uploadedFiles.get(asset.data.storageKey);
            if (!uploaded) return asset;
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
