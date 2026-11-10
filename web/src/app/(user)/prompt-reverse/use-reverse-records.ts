"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "@/stores/use-user-store";
import { fetchUserGenerationTasks, type PromptReverseItem } from "@/services/api/explore";
import { fetchGenerationHistories, type GenerationHistory } from "@/services/api/generation-history";

export type ReverseRecord = { id: string; model: string; items: PromptReverseItem[]; status: string; credits: number; progress: number; error?: string; createdAt: string; history?: GenerationHistory };
export const reverseRunning = (status: string) => ["submitting", "queued", "executing"].includes(status);

export function useReverseRecords() {
    const token = useUserStore((state) => state.token);
    const userId = useUserStore((state) => state.user?.id);
    const tasks = useQuery({ queryKey: ["reverse-tasks", userId, token], queryFn: () => fetchUserGenerationTasks(token), enabled: Boolean(token && userId), refetchInterval: 3000 });
    const histories = useQuery({ queryKey: ["explore-history", "prompt-reverse", userId, token], queryFn: () => fetchGenerationHistories(token, { type: "prompt-reverse", pageSize: 100 }), enabled: Boolean(token && userId), refetchInterval: tasks.data?.some((task) => task.path === "/prompt-reverse" && reverseRunning(task.status)) ? 3000 : 30000 });
    const finished = tasks.data?.filter((task) => task.path === "/prompt-reverse" && task.finishedAt).map((task) => task.finishedAt).join();
    const refetchHistories = histories.refetch;
    useEffect(() => { if (finished) void refetchHistories(); }, [finished, refetchHistories]);
    const records = new Map<string, ReverseRecord>();
    for (const task of tasks.data || []) {
        if (task.path !== "/prompt-reverse" || !reverseRunning(task.status)) continue;
        records.set(task.id, { ...task, items: task.items || [] });
    }
    for (const history of histories.data?.items || []) {
        if (Date.parse(history.expiresAt) <= Date.now()) continue;
        records.set(history.id, { id: history.id, model: history.model, items: (history.result?.items as PromptReverseItem[]) || [], status: history.status === "成功" ? "succeeded" : "failed", credits: Number(history.result?.credits || 0), progress: 100, error: history.error, createdAt: history.createdAt, history });
    }
    return { records: [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), error: tasks.error || histories.error, refresh: async () => { await Promise.all([tasks.refetch(), histories.refetch()]); } };
}
