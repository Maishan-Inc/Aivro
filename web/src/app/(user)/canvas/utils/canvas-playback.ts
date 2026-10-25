import type { SaveWorkflowInput } from "@/services/api/workflows";
import type { UploadedImage } from "@/services/image-storage";
import type { UploadedFile } from "@/services/file-storage";
import { NODE_DEFAULT_SIZE } from "../constants";
import { CanvasNodeType, type CanvasNodeData } from "../types";
import { fitNodeSize } from "./canvas-node-size";
import { CANVAS_IMAGE_DRAG_TYPE } from "./canvas-custom-node";

export type CanvasPlayback = {
    workflow: SaveWorkflowInput;
    images: UploadedImage[];
    video?: UploadedFile;
    signal: AbortSignal;
    onReady: (canvas: HTMLDivElement) => void;
};

type PlaybackScene = {
    title: string;
    prompt: string;
    brief: string;
    constraint: string;
    reference: string;
    referenceTitle: string;
    outputs: readonly string[];
    format: string;
    video?: string;
};

export function waitForPlayback(duration: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => { window.clearTimeout(timer); reject(signal.reason); };
        const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, duration);
        signal.addEventListener("abort", abort, { once: true });
    });
}

export async function preloadCanvasPlayback(scene: PlaybackScene, tr: (text: string) => string, signal: AbortSignal): Promise<Omit<CanvasPlayback, "onReady">> {
    const loadImage = async (name: string): Promise<UploadedImage> => {
        const response = await fetch(`/showcase/workflows/${name}.webp?v=${process.env.NEXT_PUBLIC_APP_VERSION || "dev"}`, { signal });
        if (!response.ok) throw new Error("加载失败");
        const blob = await response.blob();
        signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        signal.addEventListener("abort", () => URL.revokeObjectURL(url), { once: true });
        const image = new Image();
        image.src = url;
        await image.decode();
        signal.throwIfAborted();
        return { url, storageKey: "", width: image.naturalWidth, height: image.naturalHeight, bytes: blob.size, mimeType: blob.type };
    };
    const loadVideo = () => new Promise<UploadedFile | undefined>((resolve, reject) => {
        if (!scene.video) { resolve(undefined); return; }
        const video = document.createElement("video");
        const cleanup = () => {
            window.clearTimeout(timeout);
            signal.removeEventListener("abort", abort);
            video.onloadeddata = null;
            video.onerror = null;
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
        const fail = (error: unknown) => { cleanup(); reject(error); };
        const abort = () => fail(signal.reason);
        const timeout = window.setTimeout(() => fail(new Error("加载失败")), 15000);
        video.preload = "auto";
        video.muted = true;
        video.onloadeddata = () => {
            const result = { url: scene.video!, storageKey: "", width: video.videoWidth, height: video.videoHeight, bytes: 0, mimeType: "video/mp4" };
            cleanup();
            resolve(result);
        };
        video.onerror = () => fail(new Error("加载失败"));
        signal.addEventListener("abort", abort, { once: true });
        video.src = scene.video;
    });
    const [images, video] = await Promise.all([Promise.all([scene.reference, ...(scene.video ? [] : scene.outputs)].map(loadImage)), loadVideo()]);
    signal.throwIfAborted();
    const [reference, ...outputs] = images;
    const node = (id: string, type: CanvasNodeType, title: string, x: number, y: number, metadata: CanvasNodeData["metadata"]): CanvasNodeData => ({
        ...NODE_DEFAULT_SIZE[type], id, type, title: tr(title), position: { x, y }, metadata,
    });
    const referenceSize = fitNodeSize(reference.width, reference.height, NODE_DEFAULT_SIZE.image.width, NODE_DEFAULT_SIZE.image.height);
    return {
        signal, images: outputs, video,
        workflow: {
            title: tr(scene.title), backgroundMode: "lines", showImageInfo: false, viewport: { x: 80, y: 110, k: 0.88 },
            nodes: [
                { ...node("reference", CanvasNodeType.Image, scene.referenceTitle, 40, 360, { content: reference.url, naturalWidth: reference.width, naturalHeight: reference.height, bytes: reference.bytes, mimeType: reference.mimeType, status: "success", batchRootId: "brief" }), ...referenceSize },
                node("brief", CanvasNodeType.Custom, "自定义", 20, 240, { content: `${tr(scene.brief)}\n${tr(scene.constraint)}`, status: "success", isBatchRoot: true, batchChildIds: ["reference"] }),
                node("config", video ? CanvasNodeType.Video : CanvasNodeType.Image, video ? "视频节点" : "图片节点", 650, 100, { prompt: tr(scene.prompt), generationMode: video ? "video" : "image", model: video ? "grok-imagine-video" : "gpt-image-2", size: scene.format, quality: "high", count: video ? 1 : outputs.length, seconds: "10", vquality: "720", status: "idle" }),
            ],
            connections: [{ id: "brief-config", fromNodeId: "brief", toNodeId: "config" }],
        },
    };
}

// Dispatch the same node clicks and button actions used by the editor. Results,
// connections, batch layout and prompt panels are created by the real canvas.
export async function playCanvasPlayback(canvas: HTMLDivElement, cursor: HTMLDivElement, signal: AbortSignal, onStep: (step: number) => void) {
    const stage = cursor.parentElement!;
    let hovered: HTMLElement | null = null;
    const find = (selector: string) => {
        const element = canvas.querySelector<HTMLElement>(selector);
        if (!element) throw new Error("加载失败");
        return element;
    };
    const moveCursor = async (x: number, y: number) => {
        signal.throwIfAborted();
        const stageRect = stage.getBoundingClientRect();
        const scale = stageRect.width / stage.offsetWidth;
        const transform = `translate(${(x - stageRect.left) / scale}px, ${(y - stageRect.top) / scale}px)`;
        const animation = cursor.animate([{ transform: cursor.style.transform || "translate(160px, 360px)" }, { transform }], { duration: 850, easing: "ease-in-out", fill: "forwards" });
        const cancel = () => animation.cancel();
        signal.addEventListener("abort", cancel, { once: true });
        try { await animation.finished; } finally { signal.removeEventListener("abort", cancel); }
        signal.throwIfAborted();
        cursor.style.transform = transform;
        animation.cancel();
    };
    const click = async (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        await moveCursor(x, y);
        hovered?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
        element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        hovered = element;
        cursor.dataset.clicking = "true";
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
        element.click();
        await waitForPlayback(100, signal);
        cursor.dataset.clicking = "false";
        await waitForPlayback(350, signal);
    };
    const dragImage = async (imageId: string, source: HTMLElement, target: HTMLElement, point?: { x: number; y: number }) => {
        const sourceRect = source.getBoundingClientRect();
        await moveCursor(sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2);
        const rect = target.getBoundingClientRect();
        const x = point?.x ?? rect.left + rect.width / 2;
        const y = point?.y ?? rect.top + rect.height / 2;
        cursor.dataset.clicking = "true";
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(CANVAS_IMAGE_DRAG_TYPE, imageId);
        await moveCursor(x, y);
        target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer }));
        cursor.dataset.clicking = "false";
        await waitForPlayback(1500, signal);
    };
    onStep(0);
    await click(find('[data-custom-image-id="reference"]'));
    await waitForPlayback(2200, signal);
    onStep(1);
    await click(find('[data-node-id="brief"] > div'));
    await waitForPlayback(2600, signal);
    onStep(2);
    await click(find('[data-node-id="config"] > div'));
    const referenceChip = canvas.querySelector<HTMLElement>('[data-node-id="config"] [data-canvas-prompt-panel] [data-canvas-reference="reference"]');
    if (referenceChip) {
        await click(referenceChip);
        await waitForPlayback(1200, signal);
    }
    const billing = find('[data-node-id="config"] [data-model-billing]').getBoundingClientRect();
    await moveCursor(billing.left + billing.width / 2, billing.top + billing.height / 2);
    await waitForPlayback(1800, signal);
    const generate = find('[data-node-id="config"] [data-canvas-action="generate"]') as HTMLButtonElement;
    await click(generate);
    while (canvas.querySelector('[data-node-id="config"] [data-canvas-running="true"]')) await waitForPlayback(100, signal);
    onStep(3);
    const batch = canvas.querySelector<HTMLElement>('[data-node-type="image"][data-batch-root="true"]');
    if (batch) {
        const toggle = batch.querySelector<HTMLElement>('[data-canvas-action="toggle-batch"]')!;
        await click(toggle);
        await waitForPlayback(1800, signal);
        await click(toggle);
        for (const child of canvas.querySelectorAll<HTMLElement>('[data-batch-root-id] > div:first-child')) {
            await click(child);
            await waitForPlayback(1800, signal);
        }
        onStep(4);
        const child = find('[data-node-type="image"][data-batch-root-id]');
        const imageId = child.dataset.nodeId!;
        await dragImage(imageId, child, find('[data-node-id="brief"]'));
        const canvasRect = canvas.getBoundingClientRect();
        await dragImage(imageId, find(`[data-custom-image-id="${imageId}"]`), canvas, { x: canvasRect.left + canvasRect.width * 0.77, y: canvasRect.top + canvasRect.height * 0.72 });
        await click(find('[data-node-id="brief"] > div'));
    } else {
        await click(find('[data-node-type="video"] > div'));
        const video = canvas.querySelector("video");
        if (video) {
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            await video.play().catch(() => undefined);
        }
        onStep(4);
    }
    await waitForPlayback(6500, signal);
}
