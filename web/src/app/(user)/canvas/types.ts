export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Custom = "custom",
    Config = "config",
    Video = "video",
    Model3D = "model3d",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "model3d";
export type CanvasImageGenerationType = "generation" | "edit";

export type CanvasNodeMetadata = {
    content?: string;
    prompt?: string;
    generationPrompt?: string;
    queuePosition?: number;
    composerContent?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    videoBillingType?: "fixed" | "second";
    vquality?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    inputOrder?: string[];
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    model3D?: Partial<Pick<import("@/services/api/model-3d").Model3DGenerationInput, "meshQuality" | "textureEnabled" | "pbrEnabled" | "targetFaceCount">>;
    model3DRequest?: import("@/services/api/model-3d").Model3DGenerationInput;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant";
    mode: "ask" | "image";
    text: string;
    isLoading?: boolean;
    isError?: boolean;
    references?: CanvasAssistantReference[];
    images?: CanvasAssistantImage[];
    agentOps?: import("./utils/canvas-agent-ops").CanvasAgentOp[];
    agentUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; credits: number; estimated?: boolean };
    agentNeedsClarification?: boolean;
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState = {
    x: number;
    y: number;
} & ({ type: "node"; nodeId: string } | { type: "canvas"; position: Position });
