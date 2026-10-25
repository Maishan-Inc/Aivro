"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasVideoPlayer({ src, className = "h-full w-full" }: { src: string; className?: string }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [failedSource, setFailedSource] = useState<string | null>(null);

    return <div className={`relative overflow-hidden rounded-[18px] ${className}`} style={{ background: theme.node.fill }} data-canvas-no-zoom data-canvas-video-player
        onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <video ref={videoRef} src={src} controls playsInline preload="metadata" aria-label={tr("预览视频")}
            className="block h-full max-h-[80vh] w-full object-contain"
            onLoadedData={() => setFailedSource(null)} onError={() => setFailedSource(src)} />
        {failedSource === src ? <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-xs" style={{ background: theme.node.fill, color: theme.node.muted }}>
            <span>{tr("视频加载失败，请重试或替换视频")}</span>
            <button type="button" className="flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                onClick={() => { setFailedSource(null); videoRef.current?.load(); }}><RefreshCw className="size-3.5" />{tr("重新加载")}</button>
        </div> : null}
    </div>;
}
