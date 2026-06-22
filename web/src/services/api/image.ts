import axios from "axios";

import type { AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { nanoid } from "nanoid";
import { dataUrlToFile } from "@/lib/image-utils";
import { authHeader } from "@/services/api/request";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";

export type ChatCompletionMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type ImageApiResponse = {
    data?: Array<Record<string, unknown>> | GenerationTaskSubmitResult;
    error?: { message?: string };
    code?: number;
    msg?: string;
};

export type GenerationTaskSubmitResult = {
    queued: boolean;
    taskId: string;
    status: string;
    queuePosition: number;
    aheadCount: number;
    model: string;
    path: string;
};

export type GenerationTaskView = {
    id: string;
    model: string;
    path: string;
    status: "queued" | "executing" | "succeeded" | "failed" | "canceled";
    queuePosition: number;
    aheadCount: number;
    credits: number;
    error: string;
    createdAt: string;
    startedAt: string;
    finishedAt: string;
    resultAvailable: boolean;
    responseStatus: number;
};

export type GenerationQueueUpdate = Pick<GenerationTaskView, "status" | "queuePosition" | "aheadCount"> & { taskId: string };

export type ImageApiResult = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    cloudFileId?: string;
    bytes?: number;
    mimeType?: string;
    expiresAt?: string;
};

const QUALITY_BASE: Record<string, number> = {
    low: 1024,
    medium: 2048,
    high: 2880,
    standard: 1024,
    hd: 2048,
};
const QUALITY_ALIASES: Record<string, string> = {
    "1k": "low",
    "2k": "medium",
    "4k": "high",
};

function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    const normalized = QUALITY_ALIASES[value] || value;
    return QUALITY_BASE[normalized] ? normalized : undefined;
}

/** Map "quality + ratio" to an explicit pixel dimension like "3840x2160". Returns undefined when quality is auto. */
function resolveSize(quality: string, ratio: string): string | undefined {
    const basePixels = QUALITY_BASE[quality];
    if (!basePixels || ratio === "auto" || !ratio) return undefined;

    const parts = ratio.split(":");
    if (parts.length !== 2) return undefined;
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!w || !h) return undefined;

    const targetPixels = basePixels * basePixels;
    const isLandscape = w >= h;
    const longRatio = isLandscape ? w / h : h / w;

    const longSideRaw = Math.sqrt(targetPixels * longRatio);
    const longSide = Math.floor(longSideRaw / 16) * 16;
    const shortSide = Math.round(longSide / longRatio / 16) * 16;

    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;

    return `${width}x${height}`;
}

function resolveRequestSize(quality: string | undefined, size: string) {
    const value = size.trim();
    if (!value || value === "auto") return undefined;
    if (/^\d+x\d+$/.test(value)) return value;
    return (quality && resolveSize(quality, value)) || value;
}

function resolveImageDataUrl(item: Record<string, unknown>) {
    if (typeof item.b64_json === "string" && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item.url === "string" && item.url) {
        return item.url;
    }
    return null;
}

function parseImagePayload(payload: ImageApiResponse): ImageApiResult[] {
    if (typeof payload.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || "请求失败");
    }
    const data = Array.isArray(payload.data) ? payload.data : [];
    const images = data
        .map((item): ImageApiResult | null => {
            const dataUrl = resolveImageDataUrl(item);
            if (!dataUrl) return null;
            const image: ImageApiResult = {
                id: nanoid(),
                dataUrl,
            };
            if (typeof item.storage_key === "string") image.storageKey = item.storage_key;
            if (typeof item.cloud_file_id === "string") image.cloudFileId = item.cloud_file_id;
            if (typeof item.size === "number") image.bytes = item.size;
            if (typeof item.content_type === "string") image.mimeType = item.content_type;
            if (typeof item.expires_at === "string") image.expiresAt = item.expires_at;
            return image;
        })
        .filter((value): value is ImageApiResult => Boolean(value));

    if (images.length === 0) {
        throw new Error("接口没有返回图片");
    }

    return images;
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isAxiosError(error)) {
        const queued = parseQueuedEnvelope(error.response?.data);
        if (queued) return "";
        const responseData = error.response?.data as { error?: { message?: string }; msg?: string; code?: number } | undefined;
        return responseData?.msg || responseData?.error?.message || (error.response?.status ? `${fallback}：${error.response.status}` : fallback);
    }
    return error instanceof Error ? error.message : fallback;
}

function parseStreamChunk(chunk: string, onDelta: (value: string) => void) {
    let deltaText = "";
    for (const eventBlock of chunk.split("\n\n")) {
        const data = eventBlock
            .split("\n")
            .find((line) => line.startsWith("data: "))
            ?.slice(6);
        if (!data || data === "[DONE]") continue;
        const delta = (JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content || "";
        deltaText += delta;
    }
    if (deltaText) onDelta(deltaText);
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

function aiApiUrl(_config: AiConfig, path: string) {
    return `/api/v1${path}`;
}

function aiHeaders(_config: AiConfig, contentType?: string) {
    const token = useUserStore.getState().token;
    return {
        ...authHeader(token),
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function refreshRemoteUser(_config: AiConfig) {
    void useUserStore.getState().hydrateUser();
}

function withSystemMessage(config: AiConfig, messages: ChatCompletionMessage[]) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? [{ role: "system" as const, content: systemPrompt }, ...messages] : messages;
}

function parseQueuedEnvelope(payload: unknown): GenerationTaskSubmitResult | null {
    if (!payload || typeof payload !== "object") return null;
    const data = (payload as { data?: unknown }).data;
    if (!data || typeof data !== "object") return null;
    const task = data as Partial<GenerationTaskSubmitResult>;
    return task.queued && task.taskId ? (task as GenerationTaskSubmitResult) : null;
}

function isQueuedEnvelope(payload: ImageApiResponse): payload is ImageApiResponse & { data: GenerationTaskSubmitResult } {
    return Boolean(parseQueuedEnvelope(payload));
}

async function resolveQueuedImages(config: AiConfig, task: GenerationTaskSubmitResult, onQueue?: (update: GenerationQueueUpdate) => void) {
    onQueue?.({ taskId: task.taskId, status: "queued", queuePosition: task.queuePosition, aheadCount: task.aheadCount });
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await fetchGenerationTask(config, task.taskId);
        onQueue?.({ taskId: current.id, status: current.status, queuePosition: current.queuePosition, aheadCount: current.aheadCount });
        if (current.status === "succeeded") {
            const payload = await fetchGenerationTaskResult(config, task.taskId);
            refreshRemoteUser(config);
            return payload;
        }
        if (current.status === "failed" || current.status === "canceled") {
            refreshRemoteUser(config);
            throw new Error(current.error || (current.status === "canceled" ? "任务已撤销" : "生成失败"));
        }
    }
}

async function unwrapImageResponse(config: AiConfig, payload: ImageApiResponse, onQueue?: (update: GenerationQueueUpdate) => void) {
    if (isQueuedEnvelope(payload)) {
        const queuedPayload = await resolveQueuedImages(config, payload.data, onQueue);
        return parseImagePayload(queuedPayload);
    }
    const images = parseImagePayload(payload);
    refreshRemoteUser(config);
    return images;
}

export async function requestGeneration(config: AiConfig, prompt: string, onQueue?: (update: GenerationQueueUpdate) => void) {
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    try {
        const response = await axios.post<ImageApiResponse>(
            aiApiUrl(config, "/images/generations"),
            {
                model: config.model,
                prompt: withSystemPrompt(config, prompt),
                n,
                ...(quality ? { quality } : {}),
                ...(requestSize ? { size: requestSize } : {}),
                response_format: "b64_json",
            },
            {
                headers: aiHeaders(config, "application/json"),
                withCredentials: true,
            },
        );
        return await unwrapImageResponse(config, response.data, onQueue);
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败") || "请求失败");
    }
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], onQueue?: (update: GenerationQueueUpdate) => void) {
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    const formData = new FormData();
    formData.set("model", config.model);
    formData.set("prompt", withSystemPrompt(config, prompt));
    formData.set("n", String(n));
    formData.set("response_format", "b64_json");
    if (quality) {
        formData.set("quality", quality);
    }
    if (requestSize) {
        formData.set("size", requestSize);
    }
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => formData.append("image", file));

    try {
        const response = await axios.post<ImageApiResponse>(aiApiUrl(config, "/images/edits"), formData, { headers: aiHeaders(config), withCredentials: true });
        return await unwrapImageResponse(config, response.data, onQueue);
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败") || "请求失败");
    }
}

export async function fetchGenerationTask(config: AiConfig, id: string) {
    const response = await axios.get<{ code?: number; data?: GenerationTaskView; msg?: string }>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(id)}`), { headers: aiHeaders(config), withCredentials: true });
    if (typeof response.data.code === "number" && response.data.code !== 0) throw new Error(response.data.msg || "任务查询失败");
    if (!response.data.data) throw new Error("任务不存在");
    return response.data.data;
}

export async function fetchGenerationTaskResult(config: AiConfig, id: string) {
    const response = await axios.get<ImageApiResponse>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(id)}/result`), { headers: aiHeaders(config), withCredentials: true });
    return response.data;
}

export async function cancelGenerationTask(config: AiConfig, id: string) {
    const response = await axios.delete<{ code?: number; msg?: string }>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(id)}`), { headers: aiHeaders(config), withCredentials: true });
    if (typeof response.data.code === "number" && response.data.code !== 0) throw new Error(response.data.msg || "撤销失败");
    refreshRemoteUser(config);
}

async function resolveQueuedChat(config: AiConfig, task: GenerationTaskSubmitResult, onDelta: (text: string) => void) {
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await fetchGenerationTask(config, task.taskId);
        if (current.status === "succeeded") {
            const response = await axios.get<string>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(task.taskId)}/result`), { headers: aiHeaders(config), responseType: "text", withCredentials: true });
            const answer = parseChatPayload(String(response.data), onDelta);
            refreshRemoteUser(config);
            return answer;
        }
        if (current.status === "failed" || current.status === "canceled") {
            refreshRemoteUser(config);
            throw new Error(current.error || (current.status === "canceled" ? "任务已撤销" : "请求失败"));
        }
    }
}

function parseChatPayload(payload: string, onDelta: (text: string) => void) {
    let answer = "";
    if (payload.includes("data: ")) {
        for (const chunk of payload.split("\n\n")) {
            parseStreamChunk(chunk, (delta) => {
                answer += delta;
                onDelta(answer);
            });
        }
        return answer;
    }
    try {
        const data = JSON.parse(payload) as { choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }> };
        answer = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || "";
        if (answer) onDelta(answer);
    } catch {
        answer = payload.trim();
        if (answer) onDelta(answer);
    }
    return answer;
}

export async function requestImageQuestion(config: AiConfig, messages: ChatCompletionMessage[], onDelta: (text: string) => void) {
    let buffer = "";
    let answer = "";
    let processedLength = 0;

    try {
        const response = await axios.post(
            aiApiUrl(config, "/chat/completions"),
            {
                model: config.model,
                messages: withSystemMessage(config, messages),
                stream: true,
            },
            {
                headers: {
                    ...aiHeaders(config, "application/json"),
                } as Record<string, string>,
                responseType: "text",
                withCredentials: true,
                onDownloadProgress: (event) => {
                    const responseText = String(event.event?.target?.responseText || "");
                    const nextText = responseText.slice(processedLength);
                    processedLength = responseText.length;
                    buffer += nextText;
                    const chunks = buffer.split("\n\n");
                    buffer = chunks.pop() || "";
                    for (const chunk of chunks) {
                        parseStreamChunk(chunk, (delta) => {
                            answer += delta;
                            onDelta(answer);
                        });
                    }
                },
            },
        );
        if (typeof response.data === "object" && response.data && "code" in response.data && (response.data as { code?: number; msg?: string }).code !== 0) {
            throw new Error((response.data as { msg?: string }).msg || "请求失败");
        }
        if (typeof response.data === "string") {
            let apiError = "";
            try {
                const payload = JSON.parse(response.data) as { code?: number; msg?: string };
                const queued = parseQueuedEnvelope(payload);
                if (queued) return await resolveQueuedChat(config, queued, onDelta);
                if (typeof payload.code === "number" && payload.code !== 0) {
                    apiError = payload.msg || "请求失败";
                }
            } catch {
                // ignore plain text stream content
            }
            if (apiError) throw new Error(apiError);
        }
        if (buffer) {
            parseStreamChunk(buffer, (delta) => {
                answer += delta;
                onDelta(answer);
            });
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const queued = parseQueuedEnvelope(error.response?.data);
            if (queued) return await resolveQueuedChat(config, queued, onDelta);
        }
        throw new Error(readAxiosError(error, "请求失败") || "请求失败");
    }
    refreshRemoteUser(config);
    return answer || "没有返回内容";
}
