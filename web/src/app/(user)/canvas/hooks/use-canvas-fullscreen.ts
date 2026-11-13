import { useEffect, useState } from "react";
import { App } from "antd";
import { useI18n } from "@/hooks/use-i18n";

export function useCanvasFullscreen() {
    const [fullscreen, setFullscreen] = useState(false);
    const { message } = App.useApp();
    const { tr } = useI18n();
    useEffect(() => {
        const update = () => setFullscreen(Boolean(document.fullscreenElement));
        update();
        document.addEventListener("fullscreenchange", update);
        return () => document.removeEventListener("fullscreenchange", update);
    }, []);
    const toggleFullscreen = async () => {
        if (document.fullscreenElement) {
            screen.orientation?.unlock();
            await document.exitFullscreen();
            return;
        }
        const mobile = window.matchMedia("(pointer:coarse)").matches;
        try {
            if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
            if (!mobile) return;
            const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };
            if (orientation?.lock) await orientation.lock("landscape");
            else if (window.innerHeight > window.innerWidth) message.info(tr("请旋转手机以横屏使用画布"));
        } catch {
            if (mobile) message.info(tr("请旋转手机以横屏使用画布"));
        }
    };
    return { fullscreen, toggleFullscreen };
}
