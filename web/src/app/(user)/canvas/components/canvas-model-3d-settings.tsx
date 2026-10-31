"use client";

import { Button, InputNumber, Popover, Select, Switch } from "antd";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { resolveCanvasModel3D } from "../utils/canvas-model-3d";
import type { CanvasNodeData, CanvasNodeMetadata } from "../types";

export function CanvasModel3DSettings({ node, onChange }: { node: CanvasNodeData; onChange: (patch: Partial<CanvasNodeMetadata>) => void }) {
    const { tr } = useI18n();
    const { capabilities, options } = resolveCanvasModel3D(useEffectiveConfig(), node);
    const patch = (value: CanvasNodeMetadata["model3D"]) => onChange({ model3D: { ...node.metadata?.model3D, ...value } });
    const qualityLabels = { standard: "标准网格", high: "高质量网格", ultra: "超高质量网格" };
    return <Popover trigger="click" placement="topLeft" content={<div className="w-64 space-y-3" data-canvas-no-zoom onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <label className="flex items-center justify-between gap-3 text-xs">{tr("网格质量")}<Select className="w-36" value={options.meshQuality} disabled={capabilities.qualities.length === 1} options={capabilities.qualities.map((value) => ({ value, label: tr(qualityLabels[value]) }))} onChange={(meshQuality) => patch({ meshQuality })} /></label>
        <label className="flex items-center justify-between text-xs">{tr("纹理")}<Switch size="small" aria-label={tr("纹理")} checked={options.textureEnabled} disabled={!capabilities.texture} onChange={(textureEnabled) => patch({ textureEnabled })} /></label>
        <label className="flex items-center justify-between text-xs">{tr("PBR 材质")}<Switch size="small" aria-label={tr("PBR 材质")} checked={options.pbrEnabled} disabled={!capabilities.pbr || !options.textureEnabled} onChange={(pbrEnabled) => patch({ pbrEnabled })} /></label>
        <label className="flex items-center justify-between gap-3 text-xs">{tr("目标面数")}<InputNumber aria-label={tr("目标面数")} className="w-36" value={options.targetFaceCount} min={capabilities.minFaces} max={capabilities.maxFaces || undefined} precision={0} disabled={!capabilities.maxFaces} onChange={(value) => { if (value !== null) patch({ targetFaceCount: value }); }} /></label>
    </div>}>
        <Button type="text" className="!h-10 !shrink-0 !rounded-full !px-3"><SlidersHorizontal size={14} />{tr(qualityLabels[options.meshQuality])}</Button>
    </Popover>;
}
