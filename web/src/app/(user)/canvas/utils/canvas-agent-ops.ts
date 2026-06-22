import { nanoid } from "nanoid";

import { getNodeSpec } from "../constants";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type ViewportTransform } from "../types";

export type CanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: CanvasNodeType; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeMetadata }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeMetadata }
    | { type: "delete_node"; id?: string; ids?: string[] }
    | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video"; prompt?: string };

export type CanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
};

export function sanitizeCanvasAgentSnapshot(snapshot: CanvasAgentSnapshot): CanvasAgentSnapshot {
    const nodes = snapshot.nodes
        .slice(0, 80)
        .map((node) => ({
            id: safeId(node.id),
            type: node.type,
            title: limitText(node.title, 80),
            position: clampPosition(node.position),
            width: clampNumber(node.width, 40, 3000),
            height: clampNumber(node.height, 40, 3000),
            metadata: sanitizeMetadata(node.type, node.metadata, 500),
        }))
        .filter((node) => node.id);
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
        ...snapshot,
        title: limitText(snapshot.title, 80),
        nodes,
        connections: snapshot.connections
            .slice(0, 160)
            .map((connection) => ({ id: safeId(connection.id), fromNodeId: safeId(connection.fromNodeId), toNodeId: safeId(connection.toNodeId) }))
            .filter((connection) => connection.id && nodeIds.has(connection.fromNodeId) && nodeIds.has(connection.toNodeId) && connection.fromNodeId !== connection.toNodeId),
        selectedNodeIds: Array.from(new Set(snapshot.selectedNodeIds.filter((id) => nodeIds.has(id)))).slice(0, 80),
        viewport: { x: clampNumber(snapshot.viewport.x, -100000, 100000), y: clampNumber(snapshot.viewport.y, -100000, 100000), k: clampNumber(snapshot.viewport.k, 0.05, 5) },
    };
}

export function summarizeCanvasAgentOps(ops?: CanvasAgentOp[]) {
    const counts = (Array.isArray(ops) ? ops : []).reduce<Record<string, number>>((acc, op) => {
        if (!op?.type) return acc;
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${opLabel(type)} ${count}`)
        .join("，");
}

export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops?: CanvasAgentOp[]) {
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;

    (Array.isArray(ops) ? ops : []).forEach((op, index) => {
        if (!op?.type || op.type === "run_generation") return;
        if (op.type === "add_node") {
            const nodeType = Object.values(CanvasNodeType).includes(op.nodeType as CanvasNodeType) ? op.nodeType! : CanvasNodeType.Text;
            const spec = getNodeSpec(nodeType);
            const id = op.id || `${nodeType}-${Date.now()}-${index}`;
            if (nodes.some((node) => node.id === id)) return;
            const node: CanvasNodeData = {
                id,
                type: nodeType,
                title: op.title || spec.title,
                position: clampPosition(op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 }),
                width: clampNumber(op.width || spec.width, 40, 3000),
                height: clampNumber(op.height || spec.height, 40, 3000),
                metadata: sanitizeMetadata(nodeType, { ...spec.metadata, ...op.metadata }),
            };
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
        }
        if (op.type === "update_node") {
            nodes = nodes.map((node) => {
                if (node.id !== op.id) return node;
                const patch = op.patch || {};
                return {
                    ...node,
                    ...patch,
                    position: patch.position ? clampPosition(patch.position) : node.position,
                    width: patch.width ? clampNumber(patch.width, 40, 3000) : node.width,
                    height: patch.height ? clampNumber(patch.height, 40, 3000) : node.height,
                    metadata: sanitizeMetadata(node.type, { ...node.metadata, ...patch.metadata, ...op.metadata }),
                };
            });
        }
        if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((conn) => !ids.has(conn.fromNodeId) && !ids.has(conn.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
        }
        if (op.type === "delete_connections") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            connections = op.all ? [] : connections.filter((conn) => !ids.has(conn.id));
        }
        if (op.type === "connect_nodes") {
            if (!op.fromNodeId || !op.toNodeId) return;
            const exists = connections.some((conn) => conn.fromNodeId === op.fromNodeId && conn.toNodeId === op.toNodeId);
            const hasNodes = nodes.some((node) => node.id === op.fromNodeId) && nodes.some((node) => node.id === op.toNodeId);
            if (!exists && hasNodes) connections = [...connections, { id: op.id || nanoid(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId }];
        }
        if (op.type === "set_viewport" && op.viewport) viewport = { x: clampNumber(op.viewport.x, -100000, 100000), y: clampNumber(op.viewport.y, -100000, 100000), k: clampNumber(op.viewport.k, 0.05, 5) };
        if (op.type === "select_nodes") selectedNodeIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
    });

    return { ...snapshot, nodes, connections, selectedNodeIds, viewport };
}

function clampPosition(position: { x: number; y: number }) {
    return { x: clampNumber(position.x, -100000, 100000), y: clampNumber(position.y, -100000, 100000) };
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function sanitizeMetadata(nodeType: CanvasNodeType, metadata?: CanvasNodeMetadata, textLimit = 4000) {
    if (!metadata) return metadata;
    const result: CanvasNodeMetadata = {};
    (["content", "prompt", "composerContent", "status", "errorDetails", "fontSize", "generationMode", "generationType", "model", "size", "quality", "count", "seconds", "vquality", "freeResize"] as const).forEach((key) => {
        const value = metadata[key];
        if (value !== undefined) (result as Record<string, unknown>)[key] = typeof value === "string" ? limitText(value, textLimit) : value;
    });
    if (nodeType === CanvasNodeType.Image || nodeType === CanvasNodeType.Video) delete result.content;
    return result;
}

function limitText(value: string | undefined, limit: number) {
    const text = (value || "").trim();
    return text.length > limit ? text.slice(0, limit) : text;
}

function safeId(value: string | undefined) {
    const text = limitText(value, 120);
    return /^[a-zA-Z0-9._:-]+$/.test(text) ? text : "";
}

function opLabel(type: string) {
    if (type === "add_node") return "新增节点";
    if (type === "update_node") return "更新节点";
    if (type === "delete_node") return "删除节点";
    if (type === "delete_connections") return "删除连线";
    if (type === "connect_nodes") return "连接";
    if (type === "set_viewport") return "调整视图";
    if (type === "select_nodes") return "选择节点";
    if (type === "run_generation") return "触发生成";
    return type;
}
