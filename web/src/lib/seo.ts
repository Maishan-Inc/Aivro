import type { Metadata } from "next";

import type { Locale } from "@/i18n/messages";
import { defaultLocale, locales, withLocalePath } from "@/i18n/routing";

export const siteUrl = "https://aivro.org";

export type SeoPageKey =
    | "home"
    | "pricing"
    | "image"
    | "video"
    | "model3d"
    | "canvas"
    | "prompts"
    | "assets"
    | "assetLibrary"
    | "privacy"
    | "terms"
    | "login"
    | "forgotPassword"
    | "profileSetup"
    | "pricingSuccess"
    | "metamaskEmail"
    | "workflowShare";

export type SeoPage = {
    path: string;
    index: boolean;
    private?: boolean;
    title: Record<Locale, string>;
    description: Record<Locale, string>;
};

export const seoPages: Record<SeoPageKey, SeoPage> = {
    home: {
        path: "/",
        index: true,
        title: { "zh-CN": "Aivro - AI 无限画布创作工具", "en-US": "Aivro - AI Infinite Canvas Creation Tool" },
        description: { "zh-CN": "Aivro 支持图片、视频、文本、提示词和工作流创作，让每次生成都沉淀为连续可复用的 AI 创作流程。", "en-US": "Aivro helps you create images, videos, text, prompts, and workflows so every generation becomes a reusable AI creation process." },
    },
    pricing: {
        path: "/pricing",
        index: true,
        title: { "zh-CN": "套餐购买 - Aivro", "en-US": "Plans - Aivro" },
        description: { "zh-CN": "购买 Aivro 套餐，获取算力点和云端工作流创建次数，支持图片、视频、画布和 AI 创作。", "en-US": "Buy Aivro plans to get credits and cloud workflow quota for image, video, canvas, and AI creation." },
    },
    image: {
        path: "/image",
        index: true,
        title: { "zh-CN": "AI 生图工作台 - Aivro", "en-US": "AI Image Studio - Aivro" },
        description: { "zh-CN": "在 Aivro 生图工作台使用后台配置的模型生成图片，管理参考图、参数和云端生成记录。", "en-US": "Generate images with configured AI models in Aivro Image Studio, with reference images, settings, and cloud history." },
    },
    video: {
        path: "/video",
        index: true,
        title: { "zh-CN": "AI 视频创作台 - Aivro", "en-US": "AI Video Studio - Aivro" },
        description: { "zh-CN": "使用 Aivro 视频创作台生成视频，支持提示词、参考图、清晰度、尺寸、秒数和生成记录。", "en-US": "Create videos in Aivro Video Studio with prompts, reference images, resolution, size, duration, and generation history." },
    },
    model3d: {
        path: "/model-3d",
        index: true,
        title: { "zh-CN": "AI 3D 模型工作台 - Aivro", "en-US": "AI 3D Model Studio - Aivro" },
        description: { "zh-CN": "通过 Aivro 3D 模型工作台探索 AI 生成 3D 内容的创作流程。", "en-US": "Explore AI-generated 3D content workflows with Aivro 3D Model Studio." },
    },
    canvas: {
        path: "/canvas",
        index: false,
        title: { "zh-CN": "AI 工作流画布 - Aivro", "en-US": "AI Workflow Canvas - Aivro" },
        description: { "zh-CN": "在 Aivro 无限画布中连接图片、文本、参考图和生成节点，把创作变成可复用工作流。", "en-US": "Connect images, text, references, and generation nodes in Aivro's infinite canvas to build reusable workflows." },
    },
    prompts: {
        path: "/prompts",
        index: true,
        title: { "zh-CN": "AI 提示词库 - Aivro", "en-US": "AI Prompt Library - Aivro" },
        description: { "zh-CN": "浏览和收藏 Aivro 提示词库中的图片、视频和创作提示词，快速复用稳定风格。", "en-US": "Browse and save image, video, and creative prompts in Aivro's prompt library to reuse proven styles." },
    },
    assets: {
        path: "/assets",
        index: false,
        title: { "zh-CN": "我的素材 - Aivro", "en-US": "My Assets - Aivro" },
        description: { "zh-CN": "管理 Aivro 中保存的文本、图片和视频素材，支持导入、导出和云端文件引用。", "en-US": "Manage saved text, image, and video assets in Aivro with import, export, and cloud file references." },
    },
    assetLibrary: {
        path: "/asset-library",
        index: true,
        title: { "zh-CN": "素材库 - Aivro", "en-US": "Asset Library - Aivro" },
        description: { "zh-CN": "浏览 Aivro 素材库，发现可用于 AI 创作的文本、图片和视频内容。", "en-US": "Browse Aivro's asset library to discover text, image, and video content for AI creation." },
    },
    privacy: {
        path: "/privacy",
        index: true,
        title: { "zh-CN": "隐私政策 - Aivro", "en-US": "Privacy Policy - Aivro" },
        description: { "zh-CN": "查看 Aivro 隐私政策，了解账号、生成内容、云存储和第三方服务相关数据处理方式。", "en-US": "Read Aivro's privacy policy for account, generated content, cloud storage, and third-party service data handling." },
    },
    terms: {
        path: "/terms",
        index: true,
        title: { "zh-CN": "服务条款 - Aivro", "en-US": "Terms of Service - Aivro" },
        description: { "zh-CN": "查看 Aivro 服务条款，了解 AI 创作、账号、安全、内容责任和服务变更规则。", "en-US": "Read Aivro's terms for AI creation, accounts, security, content responsibility, and service changes." },
    },
    login: {
        path: "/login",
        index: false,
        title: { "zh-CN": "登录 - Aivro", "en-US": "Sign in - Aivro" },
        description: { "zh-CN": "登录 Aivro 账号，继续使用工作流、生图、视频、提示词和素材能力。", "en-US": "Sign in to Aivro to continue using workflows, image generation, video creation, prompts, and assets." },
    },
    forgotPassword: {
        path: "/forgot-password",
        index: false,
        title: { "zh-CN": "找回密码 - Aivro", "en-US": "Reset password - Aivro" },
        description: { "zh-CN": "通过已绑定邮箱重置 Aivro 账号密码。", "en-US": "Reset your Aivro account password with your verified email." },
    },
    profileSetup: {
        path: "/profile/setup",
        index: false,
        private: true,
        title: { "zh-CN": "完善账户信息 - Aivro", "en-US": "Complete profile - Aivro" },
        description: { "zh-CN": "完善 Aivro 账号资料后继续创作。", "en-US": "Complete your Aivro profile before continuing." },
    },
    pricingSuccess: {
        path: "/pricing/success",
        index: false,
        private: true,
        title: { "zh-CN": "支付处理中 - Aivro", "en-US": "Payment processing - Aivro" },
        description: { "zh-CN": "查看 Aivro 套餐支付后的额度到账状态。", "en-US": "Check your Aivro plan payment and credit update status." },
    },
    metamaskEmail: {
        path: "/metamask-email",
        index: false,
        private: true,
        title: { "zh-CN": "绑定 MetaMask 邮箱 - Aivro", "en-US": "Bind MetaMask email - Aivro" },
        description: { "zh-CN": "首次使用 MetaMask 登录 Aivro 时绑定邮箱。", "en-US": "Bind an email when signing in to Aivro with MetaMask for the first time." },
    },
    workflowShare: {
        path: "/share/workflows",
        index: false,
        private: true,
        title: { "zh-CN": "工作流分享 - Aivro", "en-US": "Workflow share - Aivro" },
        description: { "zh-CN": "查看受保护的 Aivro 工作流分享。", "en-US": "View a protected Aivro workflow share." },
    },
};

export function seoPageForPath(pathname: string) {
    return Object.values(seoPages).find((item) => item.path === pathname) || seoPages.home;
}

export function localizedUrl(path: string, locale: Locale) {
    return `${siteUrl}${withLocalePath(path, locale)}`;
}

export function alternateLanguages(path: string) {
    return {
        "zh-CN": localizedUrl(path, "zh-CN"),
        "en-US": localizedUrl(path, "en-US"),
        "x-default": localizedUrl(path, defaultLocale),
    };
}

export function buildMetadata(page: SeoPage, locale: Locale): Metadata {
    const title = page.title[locale];
    const description = page.description[locale];
    const url = localizedUrl(page.path, locale);
    const robots = page.index ? { index: true, follow: true } : { index: false, follow: false };
    if (!page.index || page.private) {
        return {
            title,
            description,
            alternates: page.private
                ? {}
                : {
                      canonical: url,
                  },
            openGraph: {
                title,
                description,
                siteName: "Aivro",
                type: "website",
                locale: locale.replace("-", "_"),
            },
            twitter: {
                card: "summary",
                title,
                description,
            },
            robots,
        };
    }
    return {
        title,
        description,
        alternates: {
            canonical: url,
            languages: alternateLanguages(page.path),
        },
        openGraph: {
            title,
            description,
            url,
            siteName: "Aivro",
            type: "website",
            locale: locale.replace("-", "_"),
            alternateLocale: locales.filter((item) => item !== locale).map((item) => item.replace("-", "_")),
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
        robots,
    };
}
