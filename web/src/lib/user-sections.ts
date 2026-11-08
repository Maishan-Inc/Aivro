import { stripLocalePath } from "@/i18n/routing";
import type { AuthUser } from "@/services/api/auth";

export const userSections = [
    { key: "workflow", label: "工作流", path: "/canvas" },
    { key: "image", label: "生图工作台", path: "/image" },
    { key: "video", label: "视频创作台", path: "/video" },
    { key: "model3d", label: "3D 模型工作台", path: "/model-3d" },
    { key: "shares", label: "我的分享", path: "/console/shares" },
    { key: "community", label: "社区工作流", path: "/console/community" },
    { key: "free-image", label: "免费生成图片", path: "/free-image" },
    { key: "prompt-reverse", label: "提示词反推", path: "/prompt-reverse" },
] as const;

export type UserSection = (typeof userSections)[number]["key"];

export function sectionForPath(path: string): UserSection | undefined {
    const pathname = stripLocalePath(path.split(/[?#]/)[0]);
    if (pathname.startsWith("/canvas/community/")) return "community";
    if (pathname.startsWith("/share/workflows/")) return "shares";
    if (pathname === "/console/workflows") return "workflow";
    return userSections.find((section) => pathname === section.path || pathname.startsWith(`${section.path}/`))?.key;
}

export function canAccessPath(user: Pick<AuthUser, "disabledSections"> | null, path: string) {
    const section = sectionForPath(path);
    return !section || !user?.disabledSections?.includes(section);
}

export function defaultWorkspacePath(user: Pick<AuthUser, "disabledSections">) {
    return ["/image", "/video", "/model-3d", "/canvas", "/console/shares", "/console/community"].find((path) => canAccessPath(user, path)) || "/home";
}
