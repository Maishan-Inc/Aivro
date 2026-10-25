"use client";

import { useState } from "react";
import { App, Button, Dropdown, Modal } from "antd";
import { ChevronDown, Scan, SlidersHorizontal } from "lucide-react";
import { ImageSettingsPanel, imageQualityLabel, imageSizeLabel } from "@/components/image-settings-panel";
import { VideoSettingsPanel, videoResolutionLabel, videoSecondsLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { ModelBilling } from "@/components/model-billing";
import { canvasThemes } from "@/lib/canvas-theme";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

export function StudioGenerationSettings({ kind, part }: { kind: "image" | "video"; part?: "model" | "settings" }) {
    const { message } = App.useApp();
    const config = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [open, setOpen] = useState(false);
    const image = kind === "image";
    const count = String(Math.max(1, Math.min(10, Number(config.count) || 1)));
    const qualityOptions = image ? ["auto", "high", "medium", "low"] : ["480", "720"];
    const quantityOptions = image ? Array.from({ length: 10 }, (_, index) => String(index + 1)) : ["6", "10", "12", "16", "20"];

    if (part === "model") return <ModelPicker config={config} kind={kind} models={image ? config.imageModels : config.videoModels} value={(image ? config.imageModel : config.videoModel) || config.model} onChange={(value) => updateConfig(image ? "imageModel" : "videoModel", value)} onMissingConfig={() => message.warning("管理员尚未配置可用模型")} />;

    return <>
        {part ? null : <ModelPicker config={config} kind={kind} models={image ? config.imageModels : config.videoModels} value={(image ? config.imageModel : config.videoModel) || config.model} onChange={(value) => updateConfig(image ? "imageModel" : "videoModel", value)} onMissingConfig={() => message.warning("管理员尚未配置可用模型")} />}
        <Button type="text" icon={<Scan size={14} />} onClick={() => setOpen(true)} title="调整宽高比和尺寸">{image ? imageSizeLabel(config.size) : videoSizeLabel(config.size)}<ChevronDown size={12} /></Button>
        <Dropdown trigger={["click"]} placement="bottomLeft" menu={{ selectable: true, selectedKeys: [image ? config.quality : config.vquality], items: qualityOptions.map((key) => ({ key, label: image ? imageQualityLabel(key) : `${key}p` })), onClick: ({ key }) => updateConfig(image ? "quality" : "vquality", key) }}>
            <Button type="text" title={image ? "图像质量" : "视频清晰度"}>{image ? imageQualityLabel(config.quality) : videoResolutionLabel(config.vquality)}<ChevronDown size={12} /></Button>
        </Dropdown>
        <Dropdown trigger={["click"]} placement="bottomLeft" menu={{ selectable: true, selectedKeys: [image ? count : config.videoSeconds], items: quantityOptions.map((key) => ({ key, label: image ? `${key} 张` : `${key} 秒` })), onClick: ({ key }) => updateConfig(image ? "count" : "videoSeconds", key) }}>
            <Button type="text" title={image ? "生成张数" : "视频时长"}>{image ? `${count} 张` : videoSecondsLabel(config.videoSeconds)}<ChevronDown size={12} /></Button>
        </Dropdown>
        <Button type="text" icon={<SlidersHorizontal size={14} />} onClick={() => setOpen(true)} aria-label="打开生成参数" title="更多参数" />
        <ModelBilling model={(image ? config.imageModel : config.videoModel) || config.model} kind={kind} count={count} />
        <Modal centered title={image ? "图像生成参数" : "视频生成参数"} open={open} onCancel={() => setOpen(false)} footer={<Button type="primary" onClick={() => setOpen(false)}>完成</Button>} width={540}>
            {image ? <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-5 py-4" maxCount={10} /> : <VideoSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-5 py-4" />}
            <ModelBilling model={(image ? config.imageModel : config.videoModel) || config.model} kind={kind} count={count} />
        </Modal>
    </>;
}
