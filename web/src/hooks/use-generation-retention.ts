"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGenerationRetention } from "@/services/api/generation-retention";
import { useUserStore } from "@/stores/use-user-store";

export function useGenerationRetention() {
    const token = useUserStore((state) => state.token);
    const userId = useUserStore((state) => state.user?.id);
    return useQuery({
        queryKey: ["generation-retention", token, userId], queryFn: () => fetchGenerationRetention(token),
        enabled: Boolean(token && userId), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000,
    });
}
