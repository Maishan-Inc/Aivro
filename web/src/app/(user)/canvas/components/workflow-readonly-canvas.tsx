"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CloudWorkflow } from "@/services/api/workflows";
import { ConnectionPath } from "./canvas-connections";
import { CanvasNode } from "./canvas-node";
import { CanvasZoomControls } from "./canvas-zoom-controls";
import { InfiniteCanvas } from "./infinite-canvas";
import type { ViewportTransform } from "../types";

export function WorkflowReadonlyCanvas({ workflow, overlay }: { workflow?: Pick<CloudWorkflow, "nodes" | "connections" | "backgroundMode" | "viewport" | "showImageInfo"> | null; overlay?: ReactNode }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const containerRef = useRef<HTMLDivElement>(null);
    const nodes = useMemo(() => workflow?.nodes || [], [workflow?.nodes]);
    const connections = workflow?.connections || [];
    const [viewport, setViewport] = useState<ViewportTransform>(() => workflow?.viewport || { x: 120, y: 96, k: 0.9 });

    useEffect(() => {
        if (workflow?.viewport) setViewport(workflow.viewport);
    }, [workflow?.viewport]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

    return (
        <main className="relative h-screen min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            {overlay}
            <InfiniteCanvas containerRef={containerRef} viewport={viewport} backgroundMode={workflow?.backgroundMode || "lines"} onViewportChange={setViewport} onContextMenu={(event) => event.preventDefault()}>
                <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
                    {connections.map((connection) => {
                        const from = nodeById.get(connection.fromNodeId);
                        const to = nodeById.get(connection.toNodeId);
                        if (!from || !to) return null;
                        return <ConnectionPath key={connection.id} connection={connection} from={from} to={to} active={false} onSelect={() => undefined} />;
                    })}
                </svg>
                {nodes.map((node) => (
                    <div key={node.id} className="workflow-readonly-node">
                        <CanvasNode
                            data={node}
                            scale={viewport.k}
                            isSelected={false}
                            isRelated={false}
                            isFocusRelated={false}
                            isConnectionTarget={false}
                            isConnecting={false}
                            showPanel={false}
                            showImageInfo={workflow?.showImageInfo === true}
                            onMouseDown={() => undefined}
                            onHoverStart={() => undefined}
                            onHoverEnd={() => undefined}
                            onConnectStart={() => undefined}
                            onResize={() => undefined}
                            onContentChange={() => undefined}
                            onContextMenu={(event) => event.preventDefault()}
                        />
                    </div>
                ))}
            </InfiniteCanvas>
            <style jsx global>{`
                .workflow-readonly-node .node-element,
                .workflow-readonly-node .node-element * {
                    pointer-events: none !important;
                }
            `}</style>
            <CanvasZoomControls scale={viewport.k} onScaleChange={(k) => setViewport((current) => ({ ...current, k }))} onReset={() => setViewport(workflow?.viewport || { x: 120, y: 96, k: 0.9 })} isMiniMapOpen={false} onToggleMiniMap={() => undefined} />
            <div className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs opacity-70 backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <span>只读预览</span>
                    <span className="h-3 w-px" style={{ background: theme.toolbar.border }} />
                    <span>节点内容不可编辑，生成和助手操作已禁用</span>
                </div>
            </div>
        </main>
    );
}
