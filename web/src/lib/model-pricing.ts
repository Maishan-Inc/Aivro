import type { AdminModelChannel, AdminModelCost } from "@/services/api/admin";

// 后台与前台共用的模型定价工具。后台设置页写回的 modelCosts 和前台定价表
// 都从这里取默认值和计算方式，避免两处规则不一致。

export type BillingType = "fixed" | "token";

export const defaultAPIMultiplier = 2;
export const planPricingCodes = ["go", "plus", "pro", "max"] as const;
export type PlanPricingCode = (typeof planPricingCodes)[number];

export const capabilityLabels: Record<string, string> = { image: "图片", video: "视频", text: "文本", model3d: "3D" };

// 内置厂商目录：模型名命中关键词时自动带出厂商名称和图标。
const vendorCatalog: Array<{ vendor: string; icon: string; tokens: string[] }> = [
    { vendor: "OpenAI", icon: "openai.svg", tokens: ["gpt", "dall-e", "dalle", "sora", "openai", "whisper"] },
    { vendor: "Anthropic", icon: "claude.svg", tokens: ["claude", "anthropic", "sonnet", "opus", "haiku"] },
    { vendor: "Google", icon: "nanobanana.svg", tokens: ["nano-banana", "nanobanana"] },
    { vendor: "Google", icon: "gemini.svg", tokens: ["gemini", "imagen", "veo", "palm", "google"] },
    { vendor: "xAI", icon: "grok.svg", tokens: ["grok", "xai"] },
    { vendor: "DeepSeek", icon: "deepseek.svg", tokens: ["deepseek"] },
    { vendor: "智谱 AI", icon: "glm.svg", tokens: ["glm", "cogview", "cogvideo", "chatglm", "zhipu"] },
    { vendor: "字节跳动", icon: "bytedance.svg", tokens: ["seedance", "seedream", "doubao", "bytedance", "jimeng", "即梦"] },
    { vendor: "快手", icon: "kling.svg", tokens: ["kling", "kuaishou", "可灵"] },
    { vendor: "腾讯", icon: "hunyuan.svg", tokens: ["hunyuan", "混元"] },
    { vendor: "Black Forest Labs", icon: "flux.svg", tokens: ["flux"] },
    { vendor: "Meta", icon: "meta.svg", tokens: ["llama", "meta", "muse", "sam-3d", "sam3d"] },
    { vendor: "Microsoft", icon: "microsoft.svg", tokens: ["mai-image", "trellis", "microsoft", "phi-"] },
    { vendor: "腾讯 ARC", icon: "tencent.svg", tokens: ["instantmesh", "arc"] },
    { vendor: "Meshy", icon: "meshy.svg", tokens: ["meshy"] },
    { vendor: "404-GEN", icon: "404gen.svg", tokens: ["404_gen", "404-gen", "404gen"] },
    { vendor: "Reve", icon: "reve.svg", tokens: ["reve"] },
    { vendor: "UniLat3D", icon: "unilat3d.png", tokens: ["unilat"] },
    { vendor: "造好物", icon: "zaohao.jpeg", tokens: ["zaohao", "造好物"] },
    { vendor: "Midjourney", icon: "", tokens: ["midjourney", "mj-"] },
    { vendor: "Stability AI", icon: "", tokens: ["stable-diffusion", "sdxl", "stability"] },
    { vendor: "阿里云", icon: "", tokens: ["qwen", "wanx", "tongyi", "通义"] },
    { vendor: "MiniMax", icon: "", tokens: ["minimax", "hailuo", "海螺"] },
    { vendor: "Runway", icon: "", tokens: ["runway", "gen-3", "gen-4"] },
    { vendor: "Luma", icon: "", tokens: ["luma", "dream-machine", "ray-2"] },
    { vendor: "Pika", icon: "", tokens: ["pika"] },
    { vendor: "Ideogram", icon: "", tokens: ["ideogram"] },
    { vendor: "Recraft", icon: "", tokens: ["recraft"] },
    { vendor: "CSM", icon: "", tokens: ["picgen3d", "csm"] },
];

export const vendorIconOptions = Array.from(new Map(vendorCatalog.filter((item) => item.icon).map((item) => [item.icon, item]))).map(([icon, item]) => ({ label: `${item.vendor} · ${icon}`, value: `/icons/${icon}` }));

export function guessModelVendor(model: string) {
    const name = (model || "").toLowerCase().trim();
    const matched = name ? vendorCatalog.find((item) => item.tokens.some((token) => name.includes(token))) : undefined;
    return { vendor: matched?.vendor || "", icon: matched?.icon ? `/icons/${matched.icon}` : "" };
}

export function blankModelCost(model: string, modelId = ""): AdminModelCost {
    return { modelId, model, credits: 0, billingType: "fixed", vendor: "", icon: "", planCredits: {}, apiCredits: 0, apiBilling: "fixed", apiMultiplier: defaultAPIMultiplier };
}

// 统一补齐默认值：套餐价只保留大于 0 的档位，厂商和图标留空时按模型名自动识别。
export function normalizeModelCost(item: Partial<AdminModelCost>): AdminModelCost {
    const billingType: BillingType = item.billingType === "token" ? "token" : "fixed";
    const planCredits: Record<string, number> = {};
    for (const code of planPricingCodes) {
        const value = Math.max(0, Math.floor(Number(item.planCredits?.[code]) || 0));
        if (value > 0) planCredits[code] = value;
    }
    const guessed = guessModelVendor(item.model || "");
    return {
        modelId: item.modelId || "",
        videoSecondPrice: item.videoSecondPrice ? {
            credits: Math.max(0, Math.floor(Number(item.videoSecondPrice.credits) || 0)),
            apiCredits: Math.max(0, Math.floor(Number(item.videoSecondPrice.apiCredits) || 0)),
            planCredits: Object.fromEntries(planPricingCodes.map((code) => [code, Math.max(0, Math.floor(Number(item.videoSecondPrice?.planCredits?.[code]) || 0))]).filter(([, value]) => Number(value) > 0)),
        } : undefined,
        model: item.model || "",
        credits: Math.max(0, Math.floor(Number(item.credits) || 0)),
        billingType,
        vendor: (item.vendor || "").trim() || guessed.vendor,
        icon: (item.icon || "").trim() || guessed.icon,
        planCredits,
        apiCredits: Math.max(0, Math.floor(Number(item.apiCredits) || 0)),
        // 后台暂不单独编辑 API 计费方式，默认跟随控制台计费方式；
        // 后端保留了独立字段，后续接入 API 调用时再单独配置。
        apiBilling: billingType,
        apiMultiplier: Math.max(1, Math.floor(Number(item.apiMultiplier) || defaultAPIMultiplier)),
    };
}

// API 价：显式单价优先，否则按标准价乘以倍数。
export function apiCostOf(item: Pick<AdminModelCost, "credits" | "apiCredits" | "apiMultiplier">) {
    if (item.apiCredits > 0) return item.apiCredits;
    return Math.max(0, Math.floor(item.credits)) * Math.max(1, Math.floor(item.apiMultiplier) || defaultAPIMultiplier);
}

// 套餐专属价：未配置或配置为 0 时沿用标准价。
export function planCostOf(item: Pick<AdminModelCost, "credits" | "planCredits">, planCode: string) {
    const value = item.planCredits?.[planCode];
    return value && value > 0 ? value : item.credits;
}

export function billingUnit(type?: string) {
    return type === "token" ? "点/千 token" : type === "second" ? "点/秒" : "点/次";
}

// 模型类型取自后台的模型范围配置，用于前台筛选和标签。
export function capabilityOf(model: string, modelChannel?: { imageModels?: string[]; videoModels?: string[]; textModels?: string[]; model3DModels?: string[] }) {
    if (!modelChannel) return "image";
    if (modelChannel.imageModels?.includes(model)) return "image";
    if (modelChannel.videoModels?.includes(model)) return "video";
    if (modelChannel.textModels?.includes(model)) return "text";
    if (modelChannel.model3DModels?.includes(model)) return "model3d";
    return "image";
}

export function syncModelCostsWithPublicModels(items: AdminModelCost[], publicModels: string[], channels: AdminModelChannel[]): AdminModelCost[] {
    const byID = new Map(items.filter((item) => item.modelId).map((item) => [item.modelId, item]));
    const byModel = new Map(items.map((item) => [item.model, item]));
    const seen = new Set<string>();
    return filterModels(publicModels, collectChannelModels(channels))
        .map((model) => {
            const modelId = channelModelId(channels, model);
            const saved = (modelId && byID.get(modelId)) || byModel.get(model);
            return normalizeModelCost({ ...blankModelCost(model, modelId), ...(saved || {}), model, modelId });
        })
        .filter((item) => {
            const key = modelCostKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export function channelModelId(channels: AdminModelChannel[], model: string) {
    for (const channel of channels) {
        if (!channel.enabled) continue;
        const mapping = (channel.modelMappings || []).find((item) => item.name === model);
        if (mapping?.id) return mapping.id;
    }
    return "";
}

export function modelCostKey(item: Pick<AdminModelCost, "modelId" | "model">) {
    return item.modelId || `model:${item.model}`;
}

export function collectChannelModels(channels: AdminModelChannel[]) {
    return uniqueModels(channels.filter((channel) => channel.enabled).flatMap((channel) => channel.models || []));
}

export function collectChannelModelColors(channels: AdminModelChannel[]) {
    const result: Record<string, string> = {};
    channels.forEach((channel) => {
        if (!channel.enabled) return;
        (channel.models || []).forEach((model) => {
            if (!result[model]) result[model] = channel.color;
        });
    });
    return result;
}

export function uniqueModels(models: string[]) {
    return Array.from(new Set(models.filter(Boolean)));
}

export function filterModels(models: string[], options: string[]) {
    const optionSet = new Set(options);
    return uniqueModels(models).filter((model) => optionSet.has(model));
}
