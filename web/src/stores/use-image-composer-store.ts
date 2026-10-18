"use client";

import { create } from "zustand";
import type { ReferenceImage } from "@/types/image";
import type { AiConfig } from "@/stores/use-config-store";

export type ImageComposerDraft = {
    prompt: string;
    references: ReferenceImage[];
    config: Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;
};

export const useImageComposerStore = create<{
    prompt: string;
    references: ReferenceImage[];
    setPrompt: (prompt: string) => void;
    setReferences: (references: ReferenceImage[] | ((value: ReferenceImage[]) => ReferenceImage[])) => void;
}>((set) => ({
    prompt: "",
    references: [],
    setPrompt: (prompt) => set({ prompt }),
    setReferences: (references) => set((state) => ({ references: typeof references === "function" ? references(state.references) : references })),
}));
