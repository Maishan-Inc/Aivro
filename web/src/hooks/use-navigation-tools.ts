"use client";

import { navigationTools } from "@/constant/navigation-tools";
import { canAccessPath } from "@/lib/user-sections";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function useNavigationTools() {
    const explore = useConfigStore((state) => state.publicSettings?.explore);
    const user = useUserStore((state) => state.user);
    return navigationTools.filter((tool) => canAccessPath(user, `/${tool.slug}`) && (tool.slug === "free-image" ? explore?.freeImageEnabled : tool.slug === "prompt-reverse" ? explore?.promptReverseEnabled : true));
}
