"use client";

import { memo, useState } from "react";
import { guessModelVendor, vendorIconOptions } from "@/lib/model-pricing";

import styles from "./model-logo.module.css";

// 厂商图标：SVG 用主题色蒙版显示，位图直接展示，加载失败时退回厂商首字母。
export const ModelLogo = memo(function ModelLogo({ icon, name, size = 20 }: { icon?: string; name: string; size?: number }) {
    const source = localIcon(icon, name);
    return <ModelLogoInner key={source || "none"} icon={source} name={name} size={size} />;
});

const localIcons = new Map([...vendorIconOptions.map((item) => item.value), "/icons/google.svg", "/icons/trellis.png"].map((path) => [path.split("/").pop(), path]));

function localIcon(icon: string | undefined, name: string) {
    if (!icon) return guessModelVendor(name).icon;
    if (!/^https?:\/\//i.test(icon)) return icon;
    try {
        const filename = new URL(icon).pathname.split("/").pop()?.replace(/-color(?=\.svg$)/, "");
        return localIcons.get(filename) || guessModelVendor(name).icon || icon;
    } catch { return guessModelVendor(name).icon; }
}

function ModelLogoInner({ icon, name, size }: { icon?: string; name: string; size: number }) {
    const [failed, setFailed] = useState(false);
    const style = { width: size, height: size };
    if (!icon || failed) return <span className={styles.wordmark} style={style} aria-hidden="true">{initials(name)}</span>;
    if (icon.endsWith(".svg")) return <span className={styles.logoMask} style={{ ...style, maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }} aria-hidden="true"><img src={icon} alt="" width={size} height={size} style={{ opacity: 0 }} onError={() => setFailed(true)} /></span>;
    return <img className={styles.logo} style={style} src={icon} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function initials(name: string) {
    const trimmed = (name || "").trim();
    return trimmed ? trimmed.slice(0, 2).toUpperCase() : "AI";
}
