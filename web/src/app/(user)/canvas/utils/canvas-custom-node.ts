import { CanvasNodeType, type CanvasNodeData, type Position } from "../types";

export const CANVAS_IMAGE_DRAG_TYPE = "application/x-aivro-canvas-image";

export function moveCanvasImages(nodes: CanvasNodeData[], ids: string[], targetId?: string, position?: Position) {
    if (!ids.length) return nodes;
    const moving = new Set(ids);
    return nodes.map((node) => {
        if (moving.has(node.id)) return {
            ...node,
            position: position ? { x: position.x - node.width / 2, y: position.y - node.height / 2 } : node.position,
            metadata: { ...node.metadata, batchRootId: targetId },
        };
        const children = node.metadata?.batchChildIds;
        if (node.id === targetId) return {
            ...node,
            metadata: { ...node.metadata, isBatchRoot: true, imageBatchExpanded: false, batchChildIds: [...new Set([...(children || []), ...ids])] },
        };
        if (!children?.some((id) => moving.has(id))) return node;
        const remaining = children.filter((id) => !moving.has(id));
        if (node.type === CanvasNodeType.Custom) return { ...node, metadata: { ...node.metadata, batchChildIds: remaining } };
        const primary = nodes.find((item) => item.id === (remaining.includes(node.metadata?.primaryImageId || "") ? node.metadata?.primaryImageId : remaining[0]));
        return {
            ...node,
            ...(primary ? { width: primary.width, height: primary.height, position: { x: node.position.x + (node.width - primary.width) / 2, y: node.position.y + (node.height - primary.height) / 2 } } : {}),
            metadata: {
                ...node.metadata, batchChildIds: remaining, primaryImageId: primary?.id, isBatchRoot: remaining.length > 0,
                content: primary?.metadata?.content, storageKey: primary?.metadata?.storageKey,
                mimeType: primary?.metadata?.mimeType, bytes: primary?.metadata?.bytes,
                naturalWidth: primary?.metadata?.naturalWidth, naturalHeight: primary?.metadata?.naturalHeight,
            },
        };
    });
}
