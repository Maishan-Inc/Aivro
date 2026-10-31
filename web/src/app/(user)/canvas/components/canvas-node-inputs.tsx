"use client";

import { Image as ImageIcon, Link2, Video } from "lucide-react";
import { ModelIcon } from "@/components/model-picker";
import { imageQualityLabel, imageSizeLabel } from "@/components/image-settings-panel";
import { videoResolutionLabel, videoSecondsLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { resolveVideoConfig } from "@/lib/video-models";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData } from "../types";
import type { NodeGenerationInput } from "./canvas-node-generation";

type NodeInputsProps = {
    inputs: NodeGenerationInput[];
    onHighlight: (nodeId: string) => void;
};

export function CanvasNodeReferences({ inputs, onHighlight }: NodeInputsProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const images = inputs.filter((input) => input.image);
    if (!images.length) return null;

    return <div className="min-w-0">
        <div className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: theme.node.muted }}><Link2 className="size-3.5" />{tr("参考图")} · {images.length}</div>
        <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1" data-canvas-no-zoom onWheel={(event) => event.stopPropagation()}>
            {images.map((input, index) => <button
                key={input.nodeId}
                type="button"
                data-canvas-reference={input.nodeId}
                className="relative size-12 shrink-0 overflow-hidden rounded-lg border-2 outline-offset-2 transition-opacity hover:opacity-75 focus-visible:outline-2"
                style={{ borderColor: theme.node.stroke, background: theme.node.panel, outlineColor: theme.node.activeStroke }}
                title={tr("定位并高亮参考图")}
                aria-label={`${tr("定位并高亮参考图")} ${index + 1}`}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); onHighlight(input.nodeId); }}
            >
                <img src={input.image!.dataUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                <span className="absolute bottom-0 right-0 rounded-tl px-1 text-[10px]" style={{ background: theme.node.panel, color: theme.node.text }}>{index + 1}</span>
            </button>)}
        </div>
    </div>;
}

export function CanvasImageDraft({ node, inputs, onHighlight }: NodeInputsProps & { node: CanvasNodeData }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useEffectiveConfig();
    const { tr } = useI18n();
    const prompt = [node.metadata?.prompt, ...inputs.map((input) => input.text)].filter(Boolean).join("\n\n");
    const model = node.metadata?.model || config.imageModel || config.model;
    const size = node.metadata?.size || config.size || "auto";
    const quality = node.metadata?.quality || config.quality || "auto";

    return <div className="thin-scrollbar flex h-full w-full flex-col gap-3 overflow-y-auto p-4 text-xs" data-canvas-no-zoom style={{ color: theme.node.text }} onWheel={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium"><ImageIcon className="size-4" />{tr("图片节点")}</span>
            <span style={{ color: theme.node.muted }}>{tr("待生成")}</span>
        </div>
        {prompt ? <p data-i18n-skip className="m-0 line-clamp-3 shrink-0 whitespace-pre-wrap break-words text-sm leading-5">{prompt}</p> : <p className="m-0 leading-5" style={{ color: theme.node.muted }}>{tr("连接参考图或输入提示词")}</p>}
        <CanvasNodeReferences inputs={inputs} onHighlight={onHighlight} />
        <div className="mt-auto space-y-2 border-t pt-3" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            <div className="flex min-w-0 items-center gap-2"><ModelIcon model={model} /><span data-i18n-skip className="truncate" title={model || tr("选择模型")}>{model || tr("选择模型")}</span></div>
            <div className="flex flex-wrap gap-x-3 gap-y-1"><span>{tr("尺寸")} · {tr(imageSizeLabel(size))}</span><span>{tr("质量")} · {tr(imageQualityLabel(quality))}</span><span>{tr("生成张数")} · {node.metadata?.count || 3}</span></div>
        </div>
    </div>;
}

export function CanvasVideoDraft({ node, inputs, onHighlight }: NodeInputsProps & { node: CanvasNodeData }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useEffectiveConfig();
    const { tr } = useI18n();
    const prompt = [node.metadata?.prompt, ...inputs.map((input) => input.text)].filter(Boolean).join("\n\n");
    const video = resolveVideoConfig({ ...config, size: node.metadata?.size || config.size, videoSeconds: node.metadata?.seconds || config.videoSeconds, vquality: node.metadata?.vquality || config.vquality, videoBillingType: node.metadata?.videoBillingType || config.videoBillingType }, node.metadata?.model || config.videoModel);
    const model = video.model;

    return <div className="thin-scrollbar flex h-full w-full flex-col gap-3 overflow-y-auto p-4 text-xs" data-canvas-no-zoom style={{ color: theme.node.text }} onWheel={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-medium"><Video className="size-4" />{tr("视频节点")}</span><span style={{ color: theme.node.muted }}>{tr("待生成")}</span></div>
        {prompt ? <p data-i18n-skip className="m-0 line-clamp-2 shrink-0 whitespace-pre-wrap break-words leading-5">{prompt}</p> : <p className="m-0 leading-5" style={{ color: theme.node.muted }}>{tr("连接参考图或输入提示词")}</p>}
        <CanvasNodeReferences inputs={inputs} onHighlight={onHighlight} />
        <div className="mt-auto shrink-0 space-y-2 border-t pt-2" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            <div className="flex min-w-0 items-start gap-2"><ModelIcon model={model} /><span data-i18n-skip className="min-w-0 break-all">{model || tr("选择模型")}</span></div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 break-words"><span>{tr(videoSizeLabel(video.size))}</span><span>{videoResolutionLabel(video.vquality)}</span><span>{videoSecondsLabel(video.videoSeconds)}</span><span>{tr(video.videoBillingType === "second" ? "按秒计费" : "按次计费")}</span></div>
        </div>
    </div>;
}
