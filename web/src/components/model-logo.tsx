"use client";

import { useState } from "react";

import styles from "./model-logo.module.css";

// 厂商图标：SVG 用主题色蒙版显示，位图直接展示，加载失败时退回厂商首字母。
export function ModelLogo({ icon, name, size = 20 }: { icon?: string; name: string; size?: number }) {
    return <ModelLogoInner key={icon || "none"} icon={icon} name={name} size={size} />;
}

function ModelLogoInner({ icon, name, size }: { icon?: string; name: string; size: number }) {
    const [failed, setFailed] = useState(false);
    const style = { width: size, height: size };
    if (!icon || failed) return <span className={styles.wordmark} style={style} aria-hidden="true">{initials(name)}</span>;
    if (icon.endsWith(".svg")) return <span className={styles.logoMask} style={{ ...style, maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }} aria-hidden="true" />;
    return <img className={styles.logo} style={style} src={icon} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function initials(name: string) {
    const trimmed = (name || "").trim();
    return trimmed ? trimmed.slice(0, 2).toUpperCase() : "AI";
}
