"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Box, Check, Clapperboard, GitBranch, ImagePlus, Layers, MousePointer2, ScanLine, Settings2, Sparkles, Type, Video } from "lucide-react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useI18n } from "@/hooks/use-i18n";
import { workflowScenes, workflowSteps } from "./home-workflow-scenes";
import styles from "./home-workflow-demo.module.css";

const icons = [ImagePlus, Box, Sparkles, Clapperboard, Video];
const connections = [
    { d: "M285 143 C325 143 320 150 350 150", step: 1 },
    { d: "M285 398 C320 398 320 150 350 150", step: 1 },
    { d: "M465 252 L465 320", step: 2 },
    { d: "M580 418 C625 418 620 166 660 166", step: 2 },
    { d: "M580 418 C625 418 620 486 660 486", step: 2 },
    { d: "M930 166 C975 166 965 347 1010 347", step: 3 },
    { d: "M930 486 C975 486 965 347 1010 347", step: 3 },
];
const asset = (name: string) => `/showcase/workflows/${name}.webp`;

export function HomeWorkflowDemo() {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const [{ scene: selected, step, branch }, setPlayback] = useState({ scene: 0, step: 0, branch: 0 });
    const [videoFailed, setVideoFailed] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const scene = workflowScenes[selected];
    const isVideo = "video" in scene;

    useEffect(() => {
        const timer = window.setTimeout(() => setPlayback((current) => current.step === 4
            ? { scene: (current.scene + 1) % workflowScenes.length, step: 0, branch: 0 }
            : { ...current, step: current.step + 1 }), step === 4 ? 8000 : 4000);
        return () => window.clearTimeout(timer);
    }, [selected, step, branch]);

    useEffect(() => { setVideoFailed(false); }, [selected]);
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const play = () => { void video.play().catch(() => {}); };
        play();
        video.addEventListener("pause", play);
        return () => video.removeEventListener("pause", play);
    }, [selected, videoFailed]);

    return <figure className={styles.demo} style={{
        "--demo-bg": theme.canvas.background, "--demo-dot": theme.canvas.dot,
        "--demo-panel": theme.node.panel, "--demo-fill": theme.node.fill,
        "--demo-line": theme.node.stroke, "--demo-text": theme.node.text,
        "--demo-muted": theme.node.muted, "--demo-active": theme.node.activeStroke,
    } as CSSProperties}>
        <div className={styles.scenarios} data-native-scroll role="tablist" aria-label={tr("创作场景")}>{workflowScenes.map((item, index) => {
            const Icon = icons[index];
            return <button key={item.id} id={`workflow-tab-${item.id}`} type="button" role="tab" aria-selected={selected === index} aria-controls="workflow-scene" tabIndex={selected === index ? 0 : -1} onClick={() => setPlayback({ scene: index, step: 0, branch: 0 })} onKeyDown={(event) => {
                const next = event.key === "ArrowRight" ? (index + 1) % workflowScenes.length : event.key === "ArrowLeft" ? (index + workflowScenes.length - 1) % workflowScenes.length : event.key === "Home" ? 0 : event.key === "End" ? workflowScenes.length - 1 : null;
                if (next !== null) { event.preventDefault(); setPlayback({ scene: next, step: 0, branch: 0 }); document.getElementById(`workflow-tab-${workflowScenes[next].id}`)?.focus(); }
            }}><Icon size={17} /><span>{tr(item.title)}</span><small>0{index + 1}</small></button>;
        })}</div>
        <div id="workflow-scene" role="tabpanel" aria-labelledby={`workflow-tab-${scene.id}`}>
            <div className={styles.toolbar}><span><span className={styles.logo} />Aivro Studio <span className={styles.toolbarDivider} />{tr(scene.title)}</span><span><span className={styles.statusDot} />{tr(workflowSteps[step])}<small>0{selected + 1} / 05</small></span></div>
            <div className={styles.viewport} data-native-scroll tabIndex={0} aria-label={tr("工作流画布，可横向滚动查看全部节点")}>
                <div key={scene.id} className={styles.stage} data-step={step}>
                    <svg className={styles.connections} viewBox="0 0 1360 680" fill="none" aria-hidden="true">{connections.map(({ d, step: active }) => <g key={d} data-active={step >= active}><path d={d} className={styles.connectionBase} /><path d={d} className={styles.connection} /></g>)}</svg>
                    <div className={`${styles.node} ${styles.promptNode}`}><div className={styles.nodeHeader}><Type size={14} />{tr("创作要求")}<small>01</small></div><p>{tr(scene.prompt)}</p><span className={styles.outputPort} /></div>
                    <div className={`${styles.node} ${styles.referenceNode}`}><div className={styles.nodeHeader}><ImagePlus size={14} />{tr(scene.referenceTitle)}<small>02</small></div><img src={asset(scene.reference)} alt={tr(scene.referenceTitle)} loading="lazy" decoding="async" /><span className={styles.outputPort} /></div>
                    <div className={`${styles.node} ${styles.planNode}`} data-active={step >= 1}><div className={styles.nodeHeader}><GitBranch size={14} />{tr("创意拆解")}<small>03</small></div><p>{tr(scene.brief)}</p><div className={styles.constraint}><ScanLine size={12} />{tr(scene.constraint)}</div><span className={styles.inputPort} /><span className={styles.bottomPort} /></div>
                    <div className={`${styles.node} ${styles.configNode}`} data-active={step >= 2}><div className={styles.nodeHeader}><Settings2 size={14} />{tr("生成配置")}<small>04</small></div><div className={styles.configRows}><span>{tr("生成方式")}<strong>{tr(isVideo ? "图生视频" : "参考图编辑")}</strong></span><span>{tr("画面比例")}<strong>{scene.format}</strong></span><span>{tr("输出分支")}<strong>02</strong></span></div><div className={styles.generate}><Sparkles size={13} />{tr(step >= 3 ? "结果已就绪" : "运行生成")}</div><span className={styles.topPort} /><span className={styles.outputPort} /></div>
                    {scene.outputs.map((name, index) => <div key={`${scene.id}-${index}`} className={`${styles.node} ${index ? styles.branchSecond : styles.branchFirst}`} data-active={step >= 3}>
                        <div className={styles.nodeHeader}>{isVideo ? <Clapperboard size={14} /> : <ImagePlus size={14} />}{tr(scene.branches[index])}<small>0{5 + index}</small></div>
                        <button type="button" className={styles.resultChoice} aria-label={`${tr(isVideo ? "预览此镜头" : "选用此方案")} · ${tr(scene.branches[index])}`} aria-pressed={step === 4 && branch === index} onClick={() => {
                            setPlayback({ scene: selected, step: 4, branch: index });
                            if (isVideo && videoRef.current) videoRef.current.currentTime = scene.frameTimes[index];
                        }}>
                            <span className={styles.resultImage}><img src={asset(name)} alt={tr(scene.branches[index])} loading="lazy" decoding="async" /><span className={styles.scan} aria-hidden="true" /></span>
                            <span className={styles.resultFooter}>{step === 4 && branch === index ? <Check size={12} /> : <ArrowUpRight size={12} />}{tr(step < 3 ? "等待生成" : step === 4 && branch === index ? (isVideo ? "正在预览" : "已选用") : (isVideo ? "预览此镜头" : "选用此方案"))}</span>
                        </button><span className={styles.inputPort} /><span className={styles.outputPort} />
                    </div>)}
                    <div className={`${styles.node} ${styles.resultNode}`} data-active={step >= 4}><div className={styles.nodeHeader}>{isVideo ? <Video size={14} /> : <Layers size={14} />}{tr(scene.deliverable)}<small>07</small></div>
                        <div className={styles.finalMedia}>{isVideo ? <><video ref={videoRef} src={scene.video} poster={asset(scene.reference)} autoPlay muted loop playsInline preload="metadata" aria-label={tr("视频流程示例片段")} onError={() => setVideoFailed(true)} />{videoFailed ? <div className={styles.videoError}><span>{tr("视频暂不可用")}</span><button type="button" onClick={() => { setVideoFailed(false); videoRef.current?.load(); }}>{tr("重新加载")}</button></div> : null}</> : <img src={asset(scene.outputs[branch])} alt={tr(scene.branches[branch])} loading="lazy" decoding="async" />}</div>
                        <div className={styles.finalSummary}><strong>{tr(scene.next)}</strong><span>{tr(isVideo ? "视频素材演示，非本次 AI 生成" : "保留参考，连接下一步创作")}<ArrowRight size={14} /></span></div><span className={styles.inputPort} /></div>
                    <div className={styles.cursor} aria-hidden="true"><MousePointer2 size={22} fill="var(--demo-panel)" /><span>Aivro</span></div>
                    <div className={styles.stageNote}><span>01 — 07</span>{tr(scene.subtitle)}</div>
                </div>
            </div>
        </div>
        <figcaption className={styles.caption}>{workflowSteps.map((label, index) => <span key={label} data-active={step === index}><small>0{index + 1}</small>{tr(label)}{index < 4 ? <ArrowRight size={14} aria-hidden="true" /> : null}</span>)}</figcaption>
        <div className={styles.note}><span>{tr(isVideo ? "参考帧取自同一视频；片段用于演示视频创作流程。" : "图片由 AI 生成，并基于对应参考图编辑；画布为流程演示。")}</span>{isVideo ? <span><a href={scene.source} target="_blank" rel="noopener noreferrer">{scene.credit}<ArrowUpRight size={12} /></a>{" · "}<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a></span> : null}</div>
    </figure>;
}
