import type { Model3DCapabilities } from "@/services/api/admin";
import type { Model3DGenerationInput } from "@/services/api/model-3d";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";
import type { CanvasNodeData } from "../types";
import { imageToDataUrl, isCloudStorageKey, resolveImageUrl, uploadImage } from "@/services/image-storage";
import type { NodeGenerationContext } from "../components/canvas-node-generation";

const genericCapabilities: Model3DCapabilities = { modes: ["text", "image", "multi_image"], maxImages: 0, maxQuantity: 4, texture: true, pbr: true, alwaysTexture: false, qualities: ["standard", "high", "ultra"], minFaces: 500000, maxFaces: 1000000, defaultFaces: 500000, promptMaxLength: 0, imageMaxBytes: 0 };

export function resolveCanvasModel3D(config: AiConfig, node?: CanvasNodeData) {
    const model = config.model3DModels.includes(node?.metadata?.model || "") ? node!.metadata!.model! : config.model3DModel;
    const capabilities = useConfigStore.getState().publicSettings?.modelChannel.model3DCapabilities?.[model] || genericCapabilities;
    const saved = node?.metadata?.model3D;
    const textureEnabled = capabilities.texture ? saved?.textureEnabled ?? true : capabilities.alwaysTexture;
    const options = {
        quantity: 1,
        meshQuality: saved?.meshQuality && capabilities.qualities.includes(saved.meshQuality) ? saved.meshQuality : capabilities.qualities[0],
        textureEnabled,
        pbrEnabled: capabilities.pbr && textureEnabled && (saved?.pbrEnabled ?? true),
        targetFaceCount: capabilities.maxFaces ? Math.max(capabilities.minFaces, Math.min(capabilities.maxFaces, saved?.targetFaceCount ?? capabilities.defaultFaces)) : capabilities.defaultFaces,
    };
    return { model, capabilities, options };
}

export function model3DInputMode(imageCount: number, capabilities: Model3DCapabilities): Model3DGenerationInput["mode"] {
    const mode = imageCount > 1 ? "multi_image" : imageCount ? "image" : "text";
    if (!capabilities.modes.includes(mode)) throw new Error(imageCount ? "当前模型不支持此参考图数量" : "请先上传参考图片");
    if (capabilities.maxImages && imageCount > capabilities.maxImages) throw new Error("当前模型不支持此参考图数量");
    return mode;
}

export async function buildCanvasModel3DRequest(config: AiConfig, node: CanvasNodeData, context: NodeGenerationContext): Promise<Model3DGenerationInput> {
    const { model, capabilities, options } = resolveCanvasModel3D(config, node);
    const mode = model3DInputMode(context.referenceImages.length, capabilities);
    const images = await Promise.all(context.referenceImages.map(async (image) => {
        const file = isCloudStorageKey(image.storageKey)
            ? { url: await resolveImageUrl(image.storageKey), storageKey: image.storageKey! }
            : await uploadImage(await imageToDataUrl(image));
        return { name: image.name, type: image.type, url: file.url, storageKey: file.storageKey };
    }));
    return { model, mode, prompt: context.prompt.trim(), images, ...options };
}
