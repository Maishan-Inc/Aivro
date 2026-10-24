"use client";

import { useQueries } from "@tanstack/react-query";
import { useI18n } from "@/hooks/use-i18n";
import { fetchPrompts } from "@/services/api/prompts";

export const davidWuPromptSource = { id: "davidwu-gpt-image2-prompts", label: "David Wu GPT Image 2" };

export const promptGallerySources = [
    { id: "system", label: "系统精选" },
    { id: "awesome-gpt-image", label: "Awesome GPT Image" },
    { id: "awesome-gpt4o-image-prompts", label: "GPT-4o Image" },
    { id: "youmind-gpt-image-2", label: "YouMind GPT Image 2" },
    { id: "youmind-nano-banana-pro", label: "Nano Banana Pro" },
    davidWuPromptSource,
];

export function usePromptGallery(category?: string) {
    const { locale } = useI18n();
    const sources = category ? promptGallerySources.filter((source) => source.id === category) : promptGallerySources;
    const pageSize = category ? 12 : 8;
    const queries = useQueries({ queries: sources.map(({ id }) => ({
        queryKey: ["prompt-gallery", id, locale, pageSize],
        queryFn: () => fetchPrompts({ category: id, locale, pageSize }),
        staleTime: 300_000,
    })) });
    const groups = queries.map((query) => (query.data?.items || []).filter((item) => item.coverUrl && item.prompt));
    const items = Array.from({ length: pageSize }, (_, index) => groups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
    return { items, isLoading: queries.some((query) => query.isPending), isError: queries.some((query) => query.isError), refetch: () => Promise.all(queries.map((query) => query.refetch())) };
}
