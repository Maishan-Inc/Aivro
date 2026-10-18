"use client";

import { create } from "zustand";
import localforage from "localforage";

import { nanoid } from "nanoid";
import { retainAssetFiles, releaseAssetFiles } from "@/services/api/assets";
import { useUserStore } from "@/stores/use-user-store";

export type AssetKind = "text" | "image" | "video" | "model3d";
export type TextAsset = AssetBase<"text"> & { data: { content: string } };
export type ImageAsset = AssetBase<"image"> & { data: { dataUrl: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type VideoAsset = AssetBase<"video"> & { data: { url: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type Model3DAsset = AssetBase<"model3d"> & { data: { url: string; storageKey?: string; bytes: number; mimeType: string; thumbnailUrl?: string; vertices?: number; faces?: number } };
export type Asset = TextAsset | ImageAsset | VideoAsset | Model3DAsset;

type AssetBase<T extends AssetKind> = {
    id: string;
    kind: T;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
};

type AssetStore = {
    assets: Asset[];
    ownerId: string;
    isReady: boolean;
    loadAssets: (ownerId: string) => Promise<void>;
    addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt">) => Promise<string>;
    updateAsset: (id: string, patch: Partial<Omit<Asset, "id" | "createdAt">>) => Promise<void>;
    removeAsset: (id: string) => Promise<void>;
    cleanupImages: (extra?: unknown) => void;
};

const assetStorage = localforage.createInstance({ name: "aivro", storeName: "user_assets" });
let assetWrites: Promise<unknown> = Promise.resolve();
let loadVersion = 0;
let assetChanges: Promise<unknown> = Promise.resolve();

function changeAssets<T>(action: () => Promise<T>): Promise<T> {
    const version = loadVersion;
    const result = assetChanges.catch(() => undefined).then(() => {
        if (version !== loadVersion) throw new Error("账号已切换，请重试");
        return action();
    });
    assetChanges = result;
    return result;
}

function storageKey(ownerId: string) { return `aivro:assets:${ownerId || "guest"}`; }

function fileIDs(value: unknown, ids = new Set<string>()): string[] {
    if (typeof value === "string") {
        if (value.startsWith("cloud:")) ids.add(value.slice(6));
        const match = value.match(/(?:^|\/)api\/files\/([^/?]+)\/content(?:[?#]|$)/);
        if (match) {
            try { ids.add(decodeURIComponent(match[1])); } catch { throw new Error("素材文件地址无效"); }
        }
    } else if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
            if (key === "cloudFileId" && typeof item === "string") ids.add(item.replace(/^cloud:/, ""));
            fileIDs(item, ids);
        }
    }
    return [...ids];
}

function saveAssets(ownerId: string, assets: Asset[]) {
    assetWrites = assetWrites.catch(() => undefined).then(() => assetStorage.setItem(storageKey(ownerId), assets));
    return assetWrites;
}

export const useAssetStore = create<AssetStore>()((set, get) => ({
    assets: [], ownerId: "", isReady: false,
    loadAssets: async (ownerId) => {
        const version = ++loadVersion;
        set({ assets: [], ownerId, isReady: false });
        try {
            await assetChanges.catch(() => undefined);
            const assets = await assetStorage.getItem<Asset[]>(storageKey(ownerId));
            if (version === loadVersion && get().ownerId === ownerId) set({ assets: assets || [], isReady: true });
        } catch {
            if (version === loadVersion && get().ownerId === ownerId) set({ assets: [], isReady: false });
        }
    },
    addAsset: (asset) => changeAssets(async () => {
        const { ownerId, isReady } = get();
        if (!isReady || ownerId !== (useUserStore.getState().user?.id || "")) throw new Error("素材尚未加载完成，请稍后重试");
        const id = nanoid();
        const now = new Date().toISOString();
        const token = useUserStore.getState().token;
        const ids = fileIDs(asset);
        if (ids.length) {
            if (!token) throw new Error("请先登录后再保存文件素材");
            await retainAssetFiles(token, id, ids);
        }
        if (get().ownerId !== ownerId) throw new Error("账号已切换，请重新保存素材");
        const assets = [{ ...asset, id, createdAt: now, updatedAt: now } as Asset, ...get().assets];
        await saveAssets(ownerId, assets);
        if (get().ownerId === ownerId) set({ assets });
        return id;
    }),
    updateAsset: (id, patch) => changeAssets(async () => {
        const { ownerId, isReady } = get();
        if (!isReady || ownerId !== (useUserStore.getState().user?.id || "")) throw new Error("素材尚未加载完成");
        const asset = get().assets.find((item) => item.id === id);
        if (!asset) throw new Error("素材不存在");
        const updated = { ...asset, ...patch, updatedAt: new Date().toISOString() } as Asset;
        const token = useUserStore.getState().token;
        if (token) await retainAssetFiles(token, id, fileIDs(updated));
        if (get().ownerId !== ownerId) throw new Error("账号已切换");
        const assets = get().assets.map((item) => item.id === id ? updated : item);
        await saveAssets(ownerId, assets);
        if (get().ownerId === ownerId) set({ assets });
    }),
    removeAsset: (id) => changeAssets(async () => {
        const { ownerId, isReady } = get();
        if (!isReady || ownerId !== (useUserStore.getState().user?.id || "")) throw new Error("素材尚未加载完成");
        const token = useUserStore.getState().token;
        if (token) await releaseAssetFiles(token, id);
        if (get().ownerId !== ownerId) return;
        const assets = get().assets.filter((item) => item.id !== id);
        await saveAssets(ownerId, assets);
        if (get().ownerId === ownerId) set({ assets });
    }),
    cleanupImages: () => {},
}));

if (typeof window !== "undefined") {
    useUserStore.subscribe((state, previous) => {
        if (state.isReady && (!previous.isReady || state.user?.id !== previous.user?.id)) void useAssetStore.getState().loadAssets(state.user?.id || "");
    });
    const session = useUserStore.getState();
    if (session.isReady) void useAssetStore.getState().loadAssets(session.user?.id || "");
}
