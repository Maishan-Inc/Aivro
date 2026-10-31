import axios from "axios";

import { dataUrlToFile } from "@/lib/image-utils";
import { imageToDataUrl } from "@/services/image-storage";
import { authHeader } from "@/services/api/request";
import { resolveVideoModel, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";
import type { UploadedFile } from "@/services/file-storage";

export type VideoQueueUpdate = { taskId: string; status: "queued" | "executing" | "succeeded" | "failed" | "canceled"; queuePosition: number; aheadCount: number };

type VideoResponse = { id: string; status?: string; file?: UploadedFile; error?: { message?: string } };
type GenerationTaskSubmitResult = { queued: boolean; taskId: string; status: string; queuePosition: number; aheadCount: number; model: string; path: string };
type GenerationTaskView = { id: string; status: "queued" | "executing" | "succeeded" | "failed" | "canceled"; queuePosition: number; aheadCount: number; error: string; resultAvailable: boolean };
type ApiVideoResponse = VideoResponse | GenerationTaskSubmitResult | { code?: number; data?: VideoResponse | GenerationTaskSubmitResult | GenerationTaskView | null; msg?: string };

function aiApiUrl(_config: AiConfig, path: string) {
    return `/api/v1${path}`;
}

function aiHeaders(_config: AiConfig) {
    const token = useUserStore.getState().token;
    return authHeader(token);
}

function refreshRemoteUser(_config: AiConfig) {
    void useUserStore.getState().hydrateUser();
}

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], onQueue?: (update: VideoQueueUpdate) => void): Promise<Blob | UploadedFile> {
    const model = resolveVideoModel(config, config.model);
    if (!model) throw new Error("管理员尚未配置可用模型");
    const body = new FormData();
    body.append("model", model);
    body.append("prompt", prompt);
    body.append("seconds", normalizeVideoSeconds(config.videoSeconds));
    if (normalizeVideoSize(config.size)) body.append("size", normalizeVideoSize(config.size)!);
    body.append("resolution_name", normalizeVideoResolution(config.vquality));
    body.append("preset", "normal");
    const files = await Promise.all(references.slice(0, 7).map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => body.append("input_reference[]", file));
    try {
        const createdPayload = (await axios.post<ApiVideoResponse>(aiApiUrl(config, "/videos"), body, { headers: aiHeaders(config), withCredentials: true })).data;
        const created = isQueuedVideoEnvelope(createdPayload) ? await waitForQueuedVideo(config, createdPayload.data, onQueue) : unwrapVideoResponse(createdPayload);
        if (!created.file?.url) throw new Error("视频接口没有返回生成文件");
        refreshRemoteUser(config);
        return created.file;
    } catch (error) {
        throw new Error(readAxiosError(error, "视频生成失败"));
    }
}

function normalizeVideoSeconds(value: string) {
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(20, seconds)));
}

function normalizeVideoSize(value: string) {
    if (value === "auto") return null;
    const size = value || "1280x720";
    if (/^\d+x\d+$/.test(size)) return size;
    return ["9:16", "2:3", "3:4"].includes(size) ? "720x1280" : "1280x720";
}

function normalizeVideoResolution(value: string) {
    if (value === "low") return "480p";
    if (value === "auto" || value === "high" || value === "medium") return "720p";
    const resolution = value.replace(/p$/i, "") || "720";
    return `${resolution}p`;
}

function isQueuedVideoEnvelope(payload: ApiVideoResponse): payload is { code?: number; data: GenerationTaskSubmitResult; msg?: string } {
    return Boolean(payload && typeof payload === "object" && "data" in payload && payload.data && "queued" in payload.data && payload.data.queued);
}

async function waitForQueuedVideo(config: AiConfig, task: GenerationTaskSubmitResult, onQueue?: (update: VideoQueueUpdate) => void): Promise<VideoResponse> {
    onQueue?.({ taskId: task.taskId, status: task.status === "executing" ? "executing" : "queued", queuePosition: task.queuePosition, aheadCount: task.aheadCount });
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await fetchGenerationTask(config, task.taskId);
        onQueue?.({ taskId: current.id, status: current.status, queuePosition: current.queuePosition, aheadCount: current.aheadCount });
        if (current.status === "succeeded") {
            return unwrapVideoResponse((await axios.get<ApiVideoResponse>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(task.taskId)}/result`), { headers: aiHeaders(config), withCredentials: true })).data);
        }
        if (current.status === "failed" || current.status === "canceled") {
            refreshRemoteUser(config);
            throw new Error(current.error || (current.status === "canceled" ? "视频任务已撤销" : "视频生成失败"));
        }
    }
}

async function fetchGenerationTask(config: AiConfig, id: string): Promise<GenerationTaskView> {
    const response = await axios.get<{ code?: number; data?: GenerationTaskView; msg?: string }>(aiApiUrl(config, `/generation-tasks/${encodeURIComponent(id)}`), { headers: aiHeaders(config), withCredentials: true });
    if (typeof response.data.code === "number" && response.data.code !== 0) throw new Error(response.data.msg || "任务查询失败");
    if (!response.data.data) throw new Error("任务不存在");
    return response.data.data;
}

function unwrapVideoResponse(payload: ApiVideoResponse): VideoResponse {
    if (!payload) throw new Error("接口没有返回视频任务");
    if ("id" in payload) return payload;
    if (!("data" in payload)) throw new Error("接口没有返回视频任务");
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (!payload.data || "resultAvailable" in payload.data || "queued" in payload.data) throw new Error("接口没有返回视频任务");
    return payload.data;
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        return responseData?.msg || responseData?.error?.message || (error.response?.status ? `${fallback}：${error.response.status}` : fallback);
    }
    return error instanceof Error ? error.message : fallback;
}

