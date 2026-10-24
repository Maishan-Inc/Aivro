"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Box, Clapperboard, ImagePlus, MousePointer2, Sparkles, Video } from "lucide-react";
import { ConnectionPath } from "@/app/(user)/canvas/components/canvas-connections";
import { CanvasNode } from "@/app/(user)/canvas/components/canvas-node";
import { CanvasToolbar } from "@/app/(user)/canvas/components/canvas-toolbar";
import { CanvasZoomControls } from "@/app/(user)/canvas/components/canvas-zoom-controls";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/app/(user)/canvas/types";
import { useI18n } from "@/hooks/use-i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { workflowScenes, workflowSteps } from "./home-workflow-scenes";
import styles from "./home-workflow-demo.module.css";

const icons = [ImagePlus, Box, Sparkles, Clapperboard, Video];
const asset = (name: string) => `/showcase/workflows/${name}.webp?v=${process.env.NEXT_PUBLIC_APP_VERSION || "dev"}`;
const phases = [
    { step: 0, duration: 4000, target: "reference" },
    { step: 1, duration: 4000, target: "config" },
    { step: 2, duration: 2600, target: "config" },
    { step: 2, duration: 2800, target: "branch-0", loading: true },
    { step: 3, duration: 5200, target: "branch-1" },
    { step: 4, duration: 8000, target: "result" },
] as const;
const viewport = { x: 32, y: 160, k: 0.92 };
const stageWidth = 1920;

function sceneCanvas(sceneIndex: number, phase: number): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
    const scene = workflowScenes[sceneIndex];
    const { step } = phases[phase];
    const loading = "loading" in phases[phase] && phases[phase].loading;
    const isVideo = "video" in scene;
    const node = (id: string, type: CanvasNodeType, title: string, x: number, y: number, width: number, height: number, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({ id: `${scene.id}-${id}`, type, title, position: { x, y }, width, height, metadata });
    const image = (id: string, title: string, name: string, x: number, y: number, width = 320) => {
        const square = name.endsWith("-reference") && sceneIndex < 3;
        const naturalWidth = isVideo ? 960 : square ? 1024 : 1200;
        const naturalHeight = isVideo ? 528 : square ? 1024 : 800;
        return node(id, CanvasNodeType.Image, title, x, y, width, width * naturalHeight / naturalWidth, { content: asset(name), status: "success", naturalWidth, naturalHeight, prompt: scene.prompt });
    };
    const waiting = (id: string, title: string, x: number, y: number, width = 320) => node(id, CanvasNodeType.Image, title, x, y, width, width / (isVideo ? 20 / 11 : 3 / 2), { content: "", status: loading ? "loading" : "idle" });
    const nodes = [
        node("prompt", CanvasNodeType.Text, "创作要求", 40, 40, 300, 230, { content: scene.prompt, prompt: scene.prompt, status: "success", fontSize: 15 }),
        image("reference", scene.referenceTitle, scene.reference, 40, 350, 300),
        node("brief", CanvasNodeType.Text, "创意拆解", 430, 55, 280, 215, { content: `${scene.brief}\n\n${scene.constraint}`, status: "success", fontSize: 14 }),
        node("config", CanvasNodeType.Config, "生成配置", 430, 355, 280, 280, { status: loading ? "loading" : step >= 3 ? "success" : "idle", generationMode: isVideo ? "video" : "image", generationType: "edit", model: isVideo ? "grok-imagine-video" : "gpt-image-2", size: scene.format, quality: "high", count: isVideo ? 1 : 2, seconds: "10", vquality: "720", prompt: step >= 1 ? scene.prompt : "" }),
        ...scene.outputs.map((name, index) => step >= 3 ? image(`branch-${index}`, scene.branches[index], name, 800, index ? 370 : 40) : waiting(`branch-${index}`, scene.branches[index], 800, index ? 370 : 40)),
        step >= 3
            ? isVideo
                ? node("result", CanvasNodeType.Video, scene.deliverable, 1210, 190, 400, 220, { content: scene.video, status: "success", naturalWidth: 960, naturalHeight: 528 })
                : image("result", scene.deliverable, scene.outputs[0], 1210, 175, 400)
            : waiting("result", scene.deliverable, 1210, 175, 400),
    ];
    const links = [["prompt", "config"], ["reference", "config"], ["brief", "config"], ["config", "branch-0"], ["config", "branch-1"], ["branch-0", "result"], ["branch-1", "result"]];
    return { nodes, connections: links.map(([from, to]) => ({ id: `${scene.id}-${from}-${to}`, fromNodeId: `${scene.id}-${from}`, toNodeId: `${scene.id}-${to}` })) };
}

export function HomeWorkflowDemo() {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { tr } = useI18n();
    const [{ scene: selected, phase, branch }, setPlayback] = useState({ scene: 0, phase: 0, branch: 0 });
    const [stageScale, setStageScale] = useState(1);
    const [cursor, setCursor] = useState({ x: 190, y: 460, clicking: false });
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef(cursor);
    const scene = workflowScenes[selected];
    const isVideo = "video" in scene;
    const { step } = phases[phase];
    const loading = "loading" in phases[phase] && phases[phase].loading;
    const canvas = useMemo(() => sceneCanvas(selected, phase), [selected, phase]);
    const nodes = useMemo(() => canvas.nodes.map((node) => node.id.endsWith("result") && branch === 1 && !isVideo && step >= 3 ? { ...node, metadata: { ...node.metadata, content: asset(scene.outputs[1]) } } : node), [branch, canvas.nodes, isVideo, scene.outputs, step]);
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const selectedId = `${scene.id}-${phases[phase].target}`;
    const selectedNode = nodeById.get(selectedId)!;
    const config = nodeById.get(`${scene.id}-config`)!.metadata!;
    const inputNodes = canvas.connections.filter((connection) => connection.toNodeId === selectedId).map((connection) => nodeById.get(connection.fromNodeId)!);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const fit = () => setStageScale(element.clientWidth / stageWidth);
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => setPlayback((current) => current.phase === phases.length - 1
            ? { scene: (current.scene + 1) % workflowScenes.length, phase: 0, branch: 0 }
            : { ...current, phase: current.phase + 1, branch: current.phase === 3 ? 1 : current.branch }), phases[phase].duration);
        return () => window.clearTimeout(timer);
    }, [selected, phase, branch]);

    useEffect(() => {
        const target = nodeById.get(selectedId);
        if (!target) return;
        const from = cursorRef.current;
        const to = { x: target.position.x + target.width * 0.55, y: target.position.y + target.height * 0.52 };
        const started = performance.now();
        const duration = Math.min(1500, Math.max(750, Math.hypot(to.x - from.x, to.y - from.y) / 0.8)) + (selected * 137 + phase * 83) % 240;
        const bend = ((selected + phase) % 2 ? 1 : -1) * (18 + phase * 3);
        let frame = 0;
        const move = (time: number) => {
            const progress = Math.min(1, (time - started) / duration);
            const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
            const next = {
                x: from.x + (to.x - from.x) * eased + Math.sin(progress * Math.PI) * bend,
                y: from.y + (to.y - from.y) * eased - Math.sin(progress * Math.PI) * Math.abs(bend) * 0.45,
                clicking: progress > 0.88 && progress < 1,
            };
            cursorRef.current = next;
            setCursor(next);
            if (progress < 1) frame = requestAnimationFrame(move);
        };
        frame = requestAnimationFrame(move);
        return () => cancelAnimationFrame(frame);
    }, [nodeById, phase, selected, selectedId]);

    useEffect(() => {
        if (!isVideo || step < 3) return;
        let video = null as HTMLVideoElement | null;
        const play = () => {
            video ||= containerRef.current?.querySelector<HTMLVideoElement>(`[data-node-id="${scene.id}-result"] video`) || null;
            if (!video) return;
            void video.play().catch(() => {});
            video.currentTime = scene.frameTimes[branch];
        };
        play();
        const timer = window.setTimeout(() => {
            play();
            if (video) video.currentTime = scene.frameTimes[branch];
        }, 0);
        const seek = () => { if (video) video.currentTime = scene.frameTimes[branch]; };
        video?.addEventListener("loadedmetadata", seek, { once: true });
        if (video?.readyState) seek();
        return () => { window.clearTimeout(timer); video?.removeEventListener("loadedmetadata", seek); };
    }, [branch, isVideo, scene, step]);

    const chooseScene = (index: number) => {
        setPlayback({ scene: index, phase: 0, branch: 0 });
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
            <div className={styles.toolbar}><span><span className={styles.logo} />Aivro Studio <span className={styles.toolbarDivider} />{tr(scene.title)}</span><span><span className={styles.statusDot} />{tr(loading ? "生成中" : workflowSteps[step])}<small>0{selected + 1} / 05</small></span></div>
            <div ref={containerRef} className={styles.canvas} style={{ background: theme.canvas.background, color: theme.node.text }}>
                <div className={styles.stage} style={{ transform: `scale(${stageScale})`, backgroundImage: `linear-gradient(${theme.canvas.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.canvas.line} 1px, transparent 1px)` }}>
                <div className={styles.nodes} style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})` }}>
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", zIndex: 0 }}>
                        {canvas.connections.map((connection) => {
                            const from = nodeById.get(connection.fromNodeId);
                            const to = nodeById.get(connection.toNodeId);
                            if (!from || !to) return null;
                            return <ConnectionPath key={connection.id} connection={connection} from={from} to={to} active={step >= 2 && (connection.fromNodeId.endsWith("config") || step >= 3)} onSelect={() => undefined} />;
                        })}
                    </svg>
                    {nodes.map((node) => <CanvasNode key={node.id} data={node} scale={viewport.k} isSelected={node.id === selectedId} isRelated={false} isFocusRelated={false} isConnectionTarget={false} isConnecting={false} showPanel={false} showImageInfo readOnly renderVideo={(videoNode) => <video src={videoNode.metadata?.content} autoPlay muted loop playsInline preload="none" controls aria-label={tr(scene.deliverable)} className="h-full w-full rounded-3xl object-contain" style={{ background: theme.node.fill }} data-canvas-no-zoom />} onMouseDown={() => undefined} onHoverStart={() => undefined} onHoverEnd={() => undefined} onConnectStart={() => undefined} onResize={() => undefined} onContentChange={() => undefined} onContextMenu={(event) => event.preventDefault()} />)}
                    <div className={styles.cursor} data-clicking={cursor.clicking} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden="true"><MousePointer2 size={24} fill={theme.node.panel} /><span>Aivro</span></div>
                </div>
                <aside className={styles.inspector} data-native-scroll style={{ background: theme.node.panel, borderColor: theme.node.stroke }} aria-label={tr("节点详情")}>
                    <header><span>{tr("节点详情")}</span><small>{tr(loading ? "生成中" : workflowSteps[step])}</small></header>
                    <h3>{tr(selectedNode.title)}</h3>
                    <dl className={styles.properties}>
                        <div><dt>{tr("类型")}</dt><dd>{tr(selectedNode.type === CanvasNodeType.Text ? "文本" : selectedNode.type === CanvasNodeType.Config ? "生成配置" : selectedNode.type === CanvasNodeType.Video ? "视频" : "图片")}</dd></div>
                        {selectedNode.metadata?.naturalWidth ? <div><dt>{tr("尺寸")}</dt><dd>{selectedNode.metadata.naturalWidth} × {selectedNode.metadata.naturalHeight}</dd></div> : null}
                        <div><dt>{tr("输入来源")}</dt><dd>{inputNodes.length ? inputNodes.map((node) => tr(node.title)).join(" / ") : tr(scene.referenceTitle)}</dd></div>
                    </dl>
                    <section><h4>{tr("生成配置")}</h4><dl className={styles.properties}>
                        <div><dt>{tr("模型")}</dt><dd>{config.model}</dd></div>
                        <div><dt>{tr("尺寸")}</dt><dd>{config.size}</dd></div>
                        <div><dt>{tr(isVideo ? "清晰度" : "质量")}</dt><dd>{isVideo ? `${config.vquality}p` : tr("高质量")}</dd></div>
                        <div><dt>{tr(isVideo ? "时长" : "生成张数")}</dt><dd>{isVideo ? `${config.seconds}s` : config.count}</dd></div>
                    </dl></section>
                    <section><h4>{tr("提示词")}</h4><p>{tr(selectedNode.type === CanvasNodeType.Text ? selectedNode.metadata?.content || scene.prompt : scene.prompt)}</p></section>
                    <section><h4>{tr("创作要求")}</h4><p>{tr(scene.constraint)}</p></section>
                    <div className={styles.inspectorStatus} style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}><Sparkles size={16} />{tr(loading ? "生成中" : workflowSteps[step])}</div>
                </aside>
                <div className={styles.demoTools} inert>
                    <CanvasToolbar selectedCount={0} canUndo={false} canRedo={false} backgroundMode="lines" showImageInfo onAddImage={() => undefined} onAddVideo={() => undefined} onAddText={() => undefined} onAddConfig={() => undefined} onUndo={() => undefined} onRedo={() => undefined} onUpload={() => undefined} onDelete={() => undefined} onClear={() => undefined} onDeselect={() => undefined} onBackgroundModeChange={() => undefined} onShowImageInfoChange={() => undefined} onOpenAssetLibrary={() => undefined} onOpenMyAssets={() => undefined} />
                    <CanvasZoomControls scale={viewport.k} onScaleChange={() => undefined} onReset={() => undefined} isMiniMapOpen={false} onToggleMiniMap={() => undefined} />
                </div>
                </div>
            </div>
        </div>
        <figcaption className={styles.caption}>{workflowSteps.map((label, index) => <span key={label} data-active={step === index}><small>0{index + 1}</small>{tr(label)}{index < 4 ? <ArrowRight size={14} aria-hidden="true" /> : null}</span>)}</figcaption>
        <div className={styles.note}><span>{tr(isVideo ? "参考帧取自同一视频；片段用于演示视频创作流程。" : "图片由 AI 生成，并基于对应参考图编辑；画布为流程演示。")}</span>{isVideo ? <span><a href={scene.source} target="_blank" rel="noopener noreferrer">{scene.credit}<ArrowUpRight size={12} /></a>{" · "}<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a></span> : null}</div>
    </figure>;
}
