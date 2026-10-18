"use client";

import { useQueries } from "@tanstack/react-query";
import { useI18n } from "@/hooks/use-i18n";
import { fetchPrompts } from "@/services/api/prompts";

export const promptGallerySources = [
    { id: "system", label: "系统精选" },
    { id: "awesome-gpt-image", label: "Awesome GPT Image" },
    { id: "awesome-gpt4o-image-prompts", label: "GPT-4o Image" },
    { id: "youmind-gpt-image-2", label: "YouMind GPT Image 2" },
    { id: "youmind-nano-banana-pro", label: "Nano Banana Pro" },
    { id: "davidwu-gpt-image2-prompts", label: "David Wu GPT Image 2" },
];

export function usePromptGallery() {
    const { locale } = useI18n();
    const queries = useQueries({ queries: promptGallerySources.map(({ id }) => ({
        queryKey: ["prompt-gallery", id, locale],
        queryFn: () => fetchPrompts({ category: id, locale, pageSize: 8 }),
        staleTime: 300_000,
    })) });
    const groups = queries.map((query) => (query.data?.items || []).filter((item) => item.coverUrl && item.prompt));
    const items = Array.from({ length: 8 }, (_, index) => groups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
    return { items, isLoading: queries.some((query) => query.isPending), isError: queries.some((query) => query.isError), refetch: () => Promise.all(queries.map((query) => query.refetch())) };
}
