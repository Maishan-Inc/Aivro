"use client";

import type { CSSProperties } from "react";
import { ArrowRight, Check, ImagePlus, Maximize2, MousePointer2, Play, Plus, Settings2, Type } from "lucide-react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import styles from "./home-workflow-demo.module.css";

const connections = ["M310 125 C370 125 360 208 420 208", "M300 368 C365 368 355 294 420 294", "M640 250 C692 250 693 250 745 250"];
const mobileConnections = ["M260 425 C260 485 392 485 392 544", "M740 425 C740 485 608 485 608 544", "M500 1037 L500 1139"];

export function HomeWorkflowDemo() {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return <figure className={styles.demo} style={{
        "--demo-bg": theme.canvas.background, "--demo-dot": theme.canvas.dot,
        "--demo-panel": theme.node.panel, "--demo-fill": theme.node.fill,
        "--demo-line": theme.node.stroke, "--demo-text": theme.node.text,
        "--demo-muted": theme.node.muted, "--demo-active": theme.node.activeStroke,
    } as CSSProperties}>
        <div className={styles.toolbar} aria-hidden="true"><span><span className={styles.logo} />Aivro Studio <span className={styles.toolbarDivider} />工作流使用演示</span><span><Plus size={15} /><Maximize2 size={15} /><span>100%</span></span></div>
        <div className={styles.viewport} data-native-scroll tabIndex={0} aria-label="工作流动画演示">
            <div className={styles.stage} aria-hidden="true">
                <svg className={styles.connections} viewBox="0 0 1000 500" fill="none">{connections.map((d, index) => <g key={d}><path d={d} className={styles.connectionBase} /><path d={d} pathLength={1} className={styles.connection} data-step={index} /></g>)}</svg>
                <svg className={`${styles.connections} ${styles.mobileConnections}`} viewBox="0 0 1000 1700" fill="none">{mobileConnections.map((d, index) => <g key={d}><path d={d} className={styles.connectionBase} /><path d={d} pathLength={1} className={styles.connection} data-step={index} /></g>)}</svg>
                <div className={`${styles.node} ${styles.promptNode}`}><div className={styles.nodeHeader}><Type size={14} />提示词<span>01</span></div><p className={styles.promptText}>一座极简白色建筑<br />几何线条，柔和的自然光</p><span className={styles.outputPort} /></div>
                <div className={`${styles.node} ${styles.referenceNode}`}><div className={styles.nodeHeader}><ImagePlus size={14} />参考图<span>02</span></div><img src="/showcase/alpine.webp" alt="" loading="lazy" decoding="async" /><span className={styles.outputPort} /></div>
                <div className={`${styles.node} ${styles.configNode}`}><div className={styles.nodeHeader}><Settings2 size={14} />生成配置<span>03</span></div><div className={styles.configRows}><span>模型<strong>GPT Image 2</strong></span><span>比例<strong>4:3</strong></span></div><span className={styles.generate}><Play size={12} fill="currentColor" />生成图片</span><span className={styles.inputPort} data-port="prompt" /><span className={styles.inputPort} data-port="reference" /><span className={styles.outputPort} /></div>
                <div className={`${styles.node} ${styles.resultNode}`}><div className={styles.nodeHeader}><ImagePlus size={14} />生成结果<span>04</span></div><div className={styles.resultImage}><div className={styles.generating}><span className={styles.generatingMark} /><span>生成中</span><span className={styles.progress}><span /></span></div><img className={styles.generatedImage} src="/showcase/architecture.webp" alt="" loading="lazy" decoding="async" /></div><div className={styles.resultFooter}><Check size={12} /><span>继续创作</span><ArrowRight size={13} /></div><span className={styles.inputPort} /></div>
                <div className={styles.cursor}><MousePointer2 size={22} fill="var(--demo-panel)" /><span>Aivro</span></div>
                <span className={styles.stageNote}>连接灵感，让下一步自然发生</span>
            </div>
        </div>
        <figcaption className={styles.caption}>{["写下想法", "连接参考", "运行生成", "继续创作"].map((label, index) => <span key={label}><small>0{index + 1}</small>{label}{index < 3 ? <ArrowRight size={14} aria-hidden="true" /> : null}</span>)}</figcaption>
        <p className={styles.note}>交互流程演示，示例图片仅用于展示</p>
    </figure>;
}
