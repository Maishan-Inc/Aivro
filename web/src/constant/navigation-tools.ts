import { Box, FileText, ImagePlus, Images, Maximize2, SearchCheck, Sparkles, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "工作流",
        labelKey: "nav.canvas",
        href: undefined,
        external: false,
        icon: Maximize2,
    },
    {
        slug: "image",
        label: "生图工作台",
        labelKey: "nav.image",
        href: undefined,
        external: false,
        icon: ImagePlus,
    },
    {
        slug: "video",
        label: "视频创作台",
        labelKey: "nav.video",
        href: undefined,
        external: false,
        icon: Video,
    },
    {
        slug: "model-3d",
        label: "3D 模型工作台",
        labelKey: "nav.model3d",
        href: undefined,
        external: false,
        icon: Box,
    },
    {
        slug: "prompts",
        label: "提示词库",
        labelKey: "nav.prompts",
        href: undefined,
        external: false,
        icon: FileText,
    },
    {
        slug: "assets",
        label: "我的素材",
        labelKey: "nav.assets",
        href: undefined,
        external: false,
        icon: Images,
    },
    {
        slug: "prompt-reverse",
        label: "提示词反推",
        labelKey: "nav.promptReverse",
        href: "https://insigh.aivro.org",
        external: true,
        icon: SearchCheck,
    },
    {
        slug: "free-image",
        label: "免费生成图片",
        labelKey: "nav.freeImage",
        href: "https://edge.aivro.org",
        external: true,
        localeAware: true,
        icon: Sparkles,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
