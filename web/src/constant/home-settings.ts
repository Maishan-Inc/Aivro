import type { AdminPublicHomeSettings } from "@/services/api/admin";

export const defaultBannerText = "0DAY GPT-Image-2.6 模型系列已全量上线，尽情使用吧";

export const homeSocialPlatforms = [
    { id: "x", label: "X.COM" },
    { id: "facebook", label: "Facebook" },
    { id: "discord", label: "Discord" },
    { id: "tiktok", label: "TikTok" },
    { id: "bilibili", label: "BiliBili" },
] as const;

export const defaultHomeSettings: AdminPublicHomeSettings = {
    bannerEnabled: false,
    bannerText: {},
    videoEnabled: true,
    videoUrl: "https://oss-us-gn.aivro.org/d/onedrive-oen-default/Aivro/Aivro.mp4",
    socialLinks: Object.fromEntries(homeSocialPlatforms.map(({ id }) => [id, { enabled: true, url: "" }])),
};
