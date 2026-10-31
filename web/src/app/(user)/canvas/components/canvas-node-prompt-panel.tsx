"use client";

import { resolveVideoConfig } from "@/lib/video-models";

import { useEffect, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { App, Button } from "antd";

import { ModelPicker } from "@/components/model-picker";
import { ModelBilling } from "@/components/model-billing";
import { defaultConfig, resolveVideoModel, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasVideoSettingsPopover } from "./canvas-video-settings-popover";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasNodeData } from "../types";
import { useI18n } from "@/hooks/use-i18n";
import { CanvasNodeReferences } from "./canvas-node-inputs";
import type { NodeGenerationInput } from "./canvas-node-generation";

export type CanvasNodeGenerationMode = CanvasGenerationMode;

type CanvasNodePromptPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    inputs: NodeGenerationInput[];
    onHighlightInput: (nodeId: string) => void;
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    onImageSettingsOpenChange?: (open: boolean) => void;
};

export function CanvasNodePromptPanel({ node, isRunning, inputs, onHighlightInput, onPromptChange, onConfigChange, onGenerate, onImageSettingsOpenChange }: CanvasNodePromptPanelProps) {
    const { message } = App.useApp();
    const { tr } = useI18n();
    const globalConfig = useEffectiveConfig();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = defaultMode(node.type);
    const config = buildNodeConfig(globalConfig, node, mode);
    const hasTextContent = node.type === CanvasNodeType.Text && Boolean(node.metadata?.content?.trim());
    const hasImageContent = node.type === CanvasNodeType.Image && Boolean(node.metadata?.content);
    const isEditingExistingContent = hasTextContent || hasImageContent;
    const [prompt, setPrompt] = useState(isEditingExistingContent ? "" : node.metadata?.prompt || "");
    const canGenerate = Boolean(prompt.trim() || inputs.some((input) => input.text?.trim() || (!hasImageContent && input.image)));
    const warnMissingModel = () => message.warning(tr("管理员尚未配置可用模型"));

    useEffect(() => {
        setPrompt(isEditingExistingContent ? "" : node.metadata?.prompt || "");
    }, [isEditingExistingContent, node.id]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        if (!isEditingExistingContent) onPromptChange(node.id, value);
    };

    const submit = () => {
        const text = prompt.trim();
        if (!canGenerate || isRunning) return;
        onGenerate(node.id, mode, text);
    };

    return (
        <div
            data-canvas-prompt-panel
            className="flex flex-col gap-5 rounded-2xl border p-4 shadow-2xl backdrop-blur"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <CanvasNodeReferences inputs={inputs} onHighlight={onHighlightInput} />
            {mode === "video" ? <p className="m-0 text-xs" style={{ color: theme.node.muted }}>{tr("视频生成最多支持 7 张参考图")}</p> : null}
            <textarea
                value={prompt}
                onChange={(event) => updatePrompt(event.target.value)}
                onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey) return;
                    event.preventDefault();
                    submit();
                }}
                className="thin-scrollbar m-0 block h-28 min-h-28 w-full shrink-0 resize-none rounded-xl border px-3 py-2 text-sm leading-5 outline-none"
                aria-label={tr("提示词")}
                style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                placeholder={tr(mode === "video" ? "描述要生成的视频内容" : mode === "image" ? (hasImageContent ? "请输入你想要把这张图修改成什么" : "描述要生成的图片内容") : hasTextContent ? "请输入你想要将本段文本修改成什么" : "请输入你想要生成的文本内容")}
            />

            <div className="thin-scrollbar flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto py-1 [&_.canvas-composer-model-picker]:min-h-10" data-canvas-no-zoom>
                <ModelPicker showBilling={false} className="max-w-none" config={config} kind={mode} models={mode === "image" ? config.imageModels : mode === "video" ? config.videoModels : config.textModels} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} onMissingConfig={warnMissingModel} />
                {mode === "image" ? (
                    <CanvasImageSettingsPopover
                        config={config}
                        placement="topLeft"
                        buttonClassName="!h-10 !justify-start !rounded-full !px-3"
                        onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })}
                        onMissingConfig={warnMissingModel}
                        onOpenChange={onImageSettingsOpenChange}
                    />
                ) : mode === "video" ? (
                    <CanvasVideoSettingsPopover config={config} buttonClassName="!min-h-10 !rounded-full !px-3" onConfigChange={(key, value) => onConfigChange(node.id, key === "videoSeconds" ? { seconds: value } : { [key]: value })} />
                ) : null}
                <Button
                    type="primary"
                    className="!ml-auto !h-10 !shrink-0 !rounded-full !px-3"
                    disabled={isRunning || !canGenerate}
                    onClick={submit}
                    aria-label={tr("生成")}
                    data-canvas-action="generate"
                    data-canvas-running={isRunning}
                >
                    <ModelBilling summaryOnly video={config} model={config.model} kind={mode} count={mode === "image" ? config.count : 1} className="shrink-0 [&>span]:whitespace-nowrap" />
                    {isRunning ? <LoaderCircle className="size-4 shrink-0 animate-spin" /> : <ArrowUp className="size-4 shrink-0" />}
                </Button>
            </div>
        </div>
    );
}

function defaultMode(type: CanvasNodeData["type"]): CanvasNodeGenerationMode {
    return type === CanvasNodeType.Text ? "text" : type === CanvasNodeType.Video ? "video" : "image";
}

function buildNodeConfig(globalConfig: AiConfig, node: CanvasNodeData, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? globalConfig.imageModel : mode === "video" ? globalConfig.videoModel : globalConfig.textModel;
    const result: AiConfig = {
        ...globalConfig,
        model: mode === "video" ? resolveVideoModel(globalConfig, node.metadata?.model) : node.metadata?.model || defaultModel || globalConfig.model || defaultConfig.model,
        quality: node.metadata?.quality || globalConfig.quality || defaultConfig.quality,
        size: node.metadata?.size || globalConfig.size || defaultConfig.size,
        videoBillingType: node.metadata?.videoBillingType || globalConfig.videoBillingType,
        videoSeconds: node.metadata?.seconds || globalConfig.videoSeconds || defaultConfig.videoSeconds,
        vquality: node.metadata?.vquality || globalConfig.vquality || defaultConfig.vquality,
        count: String(node.metadata?.count || (mode === "image" ? 3 : globalConfig.count) || defaultConfig.count),
    };
    return mode === "video" ? resolveVideoConfig(result) : result;
}
