import { create } from "zustand";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "../types";

export type CanvasProject = {
    id: string;
    userId: string;
    slug: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    sourceShareId: string;
    sourceWorkflowId: string;
    sourceSyncMode: "none" | "detached" | "linked";
    sourceVersion: number;
    deletedAt: string;
};

type CanvasStore = {
    hydrated: boolean;
    projects: CanvasProject[];
    setProjects: (projects: CanvasProject[]) => void;
    upsertProject: (project: CanvasProject) => void;
    removeProjects: (ids: string[]) => void;
    openProject: (id: string) => CanvasProject | null;
};

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
    hydrated: true,
    projects: [],
    setProjects: (projects) => set({ projects }),
    upsertProject: (project) =>
        set((state) => ({
            projects: state.projects.some((item) => item.id === project.id) ? state.projects.map((item) => (item.id === project.id ? project : item)) : [project, ...state.projects],
        })),
    removeProjects: (ids) => set((state) => ({ projects: state.projects.filter((project) => !ids.includes(project.id)) })),
    openProject: (id) => get().projects.find((item) => item.id === id) || null,
}));
