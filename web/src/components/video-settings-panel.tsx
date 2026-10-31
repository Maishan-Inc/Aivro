"use client";

import { type ReactNode } from "react";
import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { useI18n } from "@/hooks/use-i18n";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { getVideoCapabilities, resolveVideoConfig, videoAspectRatio, videoDurationsFor, videoResolution } from "@/lib/video-models";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoBillingType", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config: input, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const { tr } = useI18n();
    const channel = useConfigStore((state) => state.publicSettings?.modelChannel);
    const config = resolveVideoConfig(input);
    const caps = getVideoCapabilities(config.model);
    const secondPrice = channel?.modelCosts.find((item) => item.model === config.model)?.videoSecondPrice;
    const groups = [
        { title: "清晰度", key: "vquality", values: caps.resolutions, current: config.vquality },
        { title: "画面比例", key: "size", values: caps.aspectRatios, current: config.size },
        { title: "秒数", key: "videoSeconds", values: videoDurationsFor(config.model, config.vquality).map(String), current: config.videoSeconds },
    ] as const;
    return <ImageSettingsTheme theme={theme}>
        <div data-i18n-skip className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
            {showTitle ? <div className="text-lg font-semibold">{tr("视频设置")}</div> : null}
            {groups.map((group) => <div key={group.key} className="space-y-2.5">
                <div className="text-xs font-medium" style={{ color: theme.node.muted }}>{tr(group.title)}</div>
                <div className="grid grid-cols-3 gap-2.5">
                    {group.values.map((value) => <OptionPill key={value} selected={group.current === value} theme={theme} onClick={() => onConfigChange(group.key, value)}>{group.key === "videoSeconds" ? `${value}s` : value === "auto" ? tr("自动") : value}</OptionPill>)}
                </div>
            </div>)}
            <div className="space-y-2.5">
                <div className="text-xs font-medium" style={{ color: theme.node.muted }}>{tr("计费方式")}</div>
                <div className="grid grid-cols-2 gap-2.5">
                    <OptionPill selected={config.videoBillingType === "fixed"} theme={theme} onClick={() => onConfigChange("videoBillingType", "fixed")}>{tr("按次计费")}</OptionPill>
                    {secondPrice ? <OptionPill selected={config.videoBillingType === "second"} theme={theme} onClick={() => onConfigChange("videoBillingType", "second")}>{tr("按秒计费")}</OptionPill> : null}
                </div>
                {config.videoBillingType === "second" ? <p className="text-xs leading-5" style={{ color: theme.node.muted }}>{tr("按请求时长计费：每秒单价 × 请求秒数，失败退回本次费用。")}</p> : null}
            </div>
            <p className="text-xs leading-5" style={{ color: theme.node.muted }}>{tr("参考图：{0}–{1} 张").replace("{0}", String(caps.minImages)).replace("{1}", String(caps.maxImages))} · {tr("图片顺序决定首尾帧；部分模型的画面比例跟随参考图。")}</p>
        </div>
    </ImageSettingsTheme>;
}

export function videoResolutionLabel(value: string) { return videoResolution(value); }
export function videoSizeLabel(value: string) { return value === "auto" ? "自动" : videoAspectRatio(value); }
export function videoSecondsLabel(value: string) { return `${value || "6"}s`; }

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return <button type="button" aria-pressed={selected} className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>{children}</button>;
}
