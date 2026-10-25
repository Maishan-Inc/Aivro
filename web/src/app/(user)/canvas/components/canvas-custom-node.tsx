"use client";

import { useLayoutEffect, useRef } from "react";
import { ImagePlus, Layers } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData } from "../types";
import { CANVAS_IMAGE_DRAG_TYPE } from "../utils/canvas-custom-node";

export function CanvasCustomNode({ node, images, readOnly, onContentChange, onResize, onUpload }: {
    node: CanvasNodeData;
    images: CanvasNodeData[];
    readOnly: boolean;
    onContentChange: (nodeId: string, content: string) => void;
    onResize: (nodeId: string, width: number, height: number) => void;
    onUpload?: (node: CanvasNodeData) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const contentRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (readOnly || !contentRef.current) return;
        const height = Math.ceil(contentRef.current.scrollHeight) + 4;
        if (height > node.height) onResize(node.id, node.width, height);
    }, [node.id, node.width, node.height, node.metadata?.content, images.length, onResize, readOnly]);

    return <div ref={contentRef} className="flex w-full flex-col gap-4 self-start p-4" style={{ color: theme.node.text }}>
        <div className="flex items-center justify-between gap-3 text-sm font-medium">
            <span className="flex items-center gap-2"><Layers className="size-4" />{tr("自定义")}</span>
            {!readOnly ? <button type="button" className="flex items-center gap-1.5 text-xs opacity-65 hover:opacity-100" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onClick={() => onUpload?.(node)}><ImagePlus className="size-4" />{tr("添加图片")}</button> : null}
        </div>
        <textarea
            data-i18n-skip
            aria-label={tr("提示词")}
            placeholder={tr("输入提示词，或拖入图片，也可以同时添加")}
            value={node.metadata?.content || ""}
            readOnly={readOnly}
            onChange={(event) => onContentChange(node.id, event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="m-0 min-h-24 w-full shrink-0 resize-none overflow-hidden rounded-xl border p-3 text-sm leading-6 outline-none [field-sizing:content]"
            style={{ background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
        />
        {images.length ? <div className="thin-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden pb-2" data-canvas-no-zoom onWheel={(event) => event.stopPropagation()}>
            {images.map((image, index) => <div
                key={image.id}
                data-custom-image-id={image.id}
                draggable={!readOnly}
                role="group"
                aria-label={`${tr("图片")} ${index + 1}`}
                title={tr("拖出图片可创建独立节点")}
                className="relative h-28 w-28 shrink-0 cursor-grab overflow-hidden rounded-xl border active:cursor-grabbing"
                style={{ borderColor: theme.node.stroke, background: theme.node.panel }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData(CANVAS_IMAGE_DRAG_TYPE, image.id); event.dataTransfer.effectAllowed = "move"; }}
            >
                <img data-i18n-skip src={image.metadata?.content} alt={image.title} draggable={false} className="h-full w-full object-contain" />
                <span className="absolute bottom-1 right-1 rounded px-1.5 text-[10px]" style={{ background: theme.node.panel }}>{index + 1}</span>
            </div>)}
        </div> : <div className="flex h-28 items-center justify-center gap-2 rounded-xl border border-dashed text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}><ImagePlus className="size-4" />{tr("拖入图片到此节点")}</div>}
    </div>;
}
