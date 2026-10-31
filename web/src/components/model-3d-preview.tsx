"use client";

import { useEffect, useRef, useState } from "react";
import type { Group, Material, Mesh, Texture, WebGLRenderTarget } from "three";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useThemeStore } from "@/stores/use-theme-store";
import { Model3DLoading } from "./model-3d-loading";

export type Model3DViewMode = "default" | "white" | "wireframe";

export function Model3DPreview({ url, mode = "default", className = "" }: { url: string; mode?: Model3DViewMode; className?: string }) {
    const { tr } = useI18n();
    const theme = useThemeStore((state) => state.theme);
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{ display: (mode: Model3DViewMode, dark: boolean) => void; reset: () => void } | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        let disposed = false;
        let cleanup = () => {};
        setState("loading");
        void (async () => {
            const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
                import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/controls/OrbitControls.js"), import("three/addons/environments/RoomEnvironment.js"),
            ]);
            if (disposed) return;
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            container.appendChild(renderer.domElement);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enablePan = false;
            const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.7, side: THREE.DoubleSide });
            const wire = new THREE.MeshBasicMaterial({ wireframe: true });
            const materials = new Map<Mesh, Material | Material[]>();
            const textures = new Set<Texture>();
            const originals = new Set<Material>();
            let model: Group | undefined;
            let environment: WebGLRenderTarget | undefined;
            const render = () => { if (!disposed) renderer.render(scene, camera); };
            const reset = () => {
                const distance = 1.25 / Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * Math.min(camera.aspect, 1)));
                camera.position.set(distance * 0.65, distance * 0.35, distance);
                controls.minDistance = 1.5;
                controls.maxDistance = distance * 4;
                controls.target.set(0, 0, 0);
                controls.update();
                render();
            };
            const resize = () => {
                const { clientWidth: width, clientHeight: height } = container;
                if (!width || !height) return;
                renderer.setSize(width, height);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                reset();
            };
            const observer = new ResizeObserver(resize);
            const releaseModel = (root: Group) => root.traverse((object) => {
                const mesh = object as Mesh;
                if (!mesh.isMesh) return;
                mesh.geometry.dispose();
                const source = materials.get(mesh) || mesh.material;
                for (const material of Array.isArray(source) ? source : [source]) {
                    originals.add(material);
                    for (const value of Object.values(material)) if ((value as Texture)?.isTexture) textures.add(value as Texture);
                }
            });
            cleanup = () => {
                sceneRef.current = null;
                observer.disconnect();
                controls.dispose();
                if (model) releaseModel(model);
                originals.forEach((material) => material.dispose());
                textures.forEach((texture) => texture.dispose());
                white.dispose();
                wire.dispose();
                environment?.dispose();
                renderer.dispose();
                renderer.forceContextLoss();
                renderer.domElement.remove();
            };
            const room = new RoomEnvironment();
            const pmrem = new THREE.PMREMGenerator(renderer);
            environment = pmrem.fromScene(room, 0.04);
            scene.environment = environment.texture;
            room.dispose();
            pmrem.dispose();
            controls.addEventListener("change", render);
            observer.observe(container);
            resize();
            const gltf = await new GLTFLoader().loadAsync(url);
            model = gltf.scene;
            if (disposed) { releaseModel(model); originals.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose()); return; }
            const box = new THREE.Box3().setFromObject(model);
            const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
            if (!Number.isFinite(radius) || radius <= 0) throw new Error("模型预览加载失败，请重试或下载模型文件");
            const center = box.getCenter(new THREE.Vector3());
            const pivot = new THREE.Group();
            pivot.add(model);
            pivot.scale.setScalar(1 / radius);
            pivot.position.copy(center).multiplyScalar(-1 / radius);
            model.traverse((object) => { const mesh = object as Mesh; if (mesh.isMesh) materials.set(mesh, mesh.material); });
            scene.add(pivot);
            sceneRef.current = {
                reset,
                display: (viewMode, dark) => {
                    wire.color.set(dark ? 0xd4d4d4 : 0x404040);
                    materials.forEach((original, mesh) => { mesh.material = viewMode === "white" ? white : viewMode === "wireframe" ? wire : original; });
                    render();
                },
            };
            setState("ready");
        })().catch(() => { if (!disposed) { cleanup(); setState("error"); } });
        return () => { disposed = true; cleanup(); };
    }, [url, attempt]);

    useEffect(() => { sceneRef.current?.display(mode, theme === "dark"); }, [mode, theme, state]);

    return <div className={`relative h-full min-h-40 w-full overflow-hidden rounded-[inherit] ${className}`} data-canvas-no-zoom data-model3d-state={state}
        onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <div ref={containerRef} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" role="img" aria-label={tr("3D 模型预览")} />
        {state === "loading" ? <div className="absolute inset-0"><Model3DLoading label="正在加载模型" /></div> : null}
        {state === "error" ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center text-xs">
            <p>{tr("模型预览加载失败，请重试或下载模型文件")}</p>
            <button type="button" className="rounded-full border border-current px-4 py-2" onClick={() => setAttempt((value) => value + 1)}>{tr("重试")}</button>
            <a href={url} download className="underline underline-offset-4">{tr("下载模型文件")}</a>
        </div> : null}
        {state === "ready" ? <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[10px] opacity-65">
            <span>{tr("拖动旋转 · 滚轮缩放")}</span>
            <button type="button" className="pointer-events-auto rounded-full border border-current p-1.5" title={tr("重置视角")} aria-label={tr("重置视角")} onClick={() => sceneRef.current?.reset()}><RotateCcw size={13} /></button>
        </div> : null}
    </div>;
}
