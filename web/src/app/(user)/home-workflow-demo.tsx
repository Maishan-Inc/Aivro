"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUpRight, Box, Clapperboard, ImagePlus, MousePointer2, Sparkles, Video } from "lucide-react";
import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { playCanvasPlayback, preloadCanvasPlayback, type CanvasPlayback } from "./canvas/utils/canvas-playback";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { workflowScenes, workflowSteps } from "./home-workflow-scenes";
import styles from "./home-workflow-demo.module.css";

const CanvasEditor = dynamic(() => import("./canvas/[id]/canvas-client-page").then((module) => module.InfiniteCanvasPage), { ssr: false, loading: () => <div className="grid h-full place-items-center"><AivroDrawableLoader /></div> });
const icons = [ImagePlus, Box, Sparkles, Clapperboard, Video, Box];

export function HomeWorkflowDemo() {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr, locale } = useI18n();
    const [{ scene: selected, round }, setSelection] = useState({ scene: 0, round: 0 });
    const [step, setStep] = useState(0);
    const [playback, setPlayback] = useState<CanvasPlayback>();
    const [failed, setFailed] = useState(false);
    const [visible, setVisible] = useState(false);
    const [stageScale, setStageScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const scene = workflowScenes[selected];

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const fit = () => setStageScale(element.clientWidth / 1920);
        fit();
        const resize = new ResizeObserver(fit);
        resize.observe(element);
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: "200px" });
        observer.observe(element);
        return () => { resize.disconnect(); observer.disconnect(); };
    }, []);

    useEffect(() => {
        if (!visible) return;
        const controller = new AbortController();
        const { signal } = controller;
        let started = false;
        setPlayback(undefined);
        setFailed(false);
        setStep(0);
        const fail = () => {
            if (signal.aborted) return;
            setPlayback(undefined);
            setFailed(true);
            controller.abort();
        };
        void preloadCanvasPlayback(scene, tr, signal).then((preloaded) => {
            if (signal.aborted) return;
            setPlayback({ ...preloaded, onReady: (canvas) => {
                if (started || signal.aborted || !cursorRef.current) return;
                started = true;
                cursorRef.current.style.transform = "translate(160px, 360px)";
                cursorRef.current.dataset.clicking = "false";
                void playCanvasPlayback(canvas, cursorRef.current, signal, setStep).then(() => {
                    if (signal.aborted) return;
                    setPlayback(undefined);
                    setSelection((current) => ({ scene: (current.scene + 1) % workflowScenes.length, round: current.round + 1 }));
                }).catch(fail);
            } });
        }).catch(fail);
        return () => controller.abort();
    }, [round, scene, tr, visible]);

    const chooseScene = (index: number) => {
        setPlayback(undefined);
        setSelection((current) => ({ scene: index, round: current.round + 1 }));
    };

    return <figure className={styles.demo}>
        <div className={styles.scenarios} data-native-scroll role="tablist" aria-label={tr("创作场景")}>{workflowScenes.map((item, index) => {
            const Icon = icons[index];
            return <button key={item.id} id={`workflow-tab-${item.id}`} type="button" role="tab" aria-selected={selected === index} aria-controls="workflow-scene" tabIndex={selected === index ? 0 : -1} onClick={() => chooseScene(index)} onKeyDown={(event) => {
                const next = event.key === "ArrowRight" ? (index + 1) % workflowScenes.length : event.key === "ArrowLeft" ? (index + workflowScenes.length - 1) % workflowScenes.length : event.key === "Home" ? 0 : event.key === "End" ? workflowScenes.length - 1 : null;
                if (next !== null) { event.preventDefault(); chooseScene(next); document.getElementById(`workflow-tab-${workflowScenes[next].id}`)?.focus(); }
            }}><Icon size={17} /><span>{tr(item.title)}</span><small>0{index + 1}</small></button>;
        })}</div>
        <div id="workflow-scene" role="tabpanel" aria-labelledby={`workflow-tab-${scene.id}`}>
            <div ref={containerRef} className={styles.canvas} style={{ background: theme.canvas.background, color: theme.node.text }}>
                <div className={styles.stage} style={{ transform: `scale(${stageScale})` }} inert>
                    {playback ? <CanvasEditor key={`${selected}-${round}-${locale}`} playback={playback} /> : <div className="grid h-full place-items-center"><AivroDrawableLoader /></div>}
                    <div ref={cursorRef} className={styles.cursor} hidden={!playback} aria-hidden="true"><MousePointer2 size={24} fill={theme.node.panel} /><span>Aivro</span></div>
                </div>
                {failed ? <div className="absolute inset-0 grid place-content-center gap-3 text-center" style={{ background: theme.canvas.background }}><span>{tr("加载失败")}</span><button type="button" className="cursor-pointer underline underline-offset-4" onClick={() => chooseScene(selected)}>{tr("重试")}</button></div> : null}
            </div>
        </div>
        <figcaption className={styles.caption}>{workflowSteps.map((label, index) => <span key={label} data-active={step === index}><small>0{index + 1}</small>{tr(label)}{index < 4 ? <ArrowRight size={14} aria-hidden="true" /> : null}</span>)}</figcaption>
        <div className={styles.note}><span>{tr("model3D" in scene ? "3D 模型与参考图来自公开示例，仅用于演示工作流。" : "video" in scene ? "参考帧取自同一视频；片段用于演示视频创作流程。" : "图片由 AI 生成，并基于对应参考图编辑；画布为流程演示。")}</span>{"model3D" in scene ? <span><a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ToyCar" target="_blank" rel="noopener noreferrer">ToyCar · Khronos glTF Sample Assets · CC0<ArrowUpRight size={12} /></a></span> : null}{"video" in scene ? <span><a href={scene.source} target="_blank" rel="noopener noreferrer">{scene.credit}<ArrowUpRight size={12} /></a>{" · "}<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a></span> : null}</div>
    </figure>;
}
