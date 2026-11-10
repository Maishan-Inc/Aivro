import { apiGet, apiPost } from "@/services/api/request";
import type { GenerationHistory } from "./generation-history";

export type ExploreSettings = { freeImageEnabled: boolean; promptReverseEnabled: boolean; systemPrompt: string };
export type FreeImageCampaign = { id: string; name: string; enabled: boolean; startsAt: string; endsAt: string; models: string[]; groupLimits: Record<string, number>; createdAt?: string; updatedAt?: string };
export type FreeImageState = { campaign: FreeImageCampaign | null; group: string; limit: number; used: number; remaining: number };
export type FreeImageInput = { campaignId: string; agreement: string; model: string; prompt: string; size: string; quality: string };
export const freeImageAgreementVersion = "free-image-v1";

export const fetchExploreSettings = (token: string) => apiGet<ExploreSettings>("/api/admin/explore-settings", undefined, token);
export const saveExploreSettings = (token: string, input: ExploreSettings) => apiPost<ExploreSettings>("/api/admin/explore-settings", input, token);
export const fetchFreeImageCampaigns = (token: string, page = 1) => apiGet<{ items: FreeImageCampaign[]; total: number }>("/api/admin/free-image-campaigns", { page, pageSize: 20 }, token);
export const saveFreeImageCampaign = (token: string, input: FreeImageCampaign) => apiPost<FreeImageCampaign>("/api/admin/free-image-campaigns", input, token);
export const fetchFreeImageState = (token: string) => apiGet<FreeImageState>("/api/v1/free-image", undefined, token);
export type PromptReverseItem = { name: string; media?: import("./generation-history").GenerationHistoryMedia; status: string; error?: string; tokens: number; credits: number; result?: Record<string, unknown> };
export const reverseImagePrompt = (token: string, model: string, images: { name: string; image: string }[]) => apiPost<import("./image").GenerationTaskSubmitResult>("/api/v1/prompt-reverse", { model, images }, token);
export const fetchUserGenerationTasks = (token: string) => apiGet<import("./image").GenerationTaskView[]>("/api/v1/generation-tasks", undefined, token);
export const fetchFreeImageSubmissions = (token: string, page = 1) => apiGet<{ items: GenerationHistory[]; total: number }>("/api/admin/free-image-histories", { page, pageSize: 20 }, token);
export const publishFreeImage = (token: string, input: { historyId: string; title: string; prompt: string; rewardCredits: number }) => apiPost("/api/admin/free-image-publication", input, token);
