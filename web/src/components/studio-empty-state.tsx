"use client";

import { ArrowUpRight } from "lucide-react";
import { PromptLibraryImage } from "@/components/prompt-library-image";
import { usePromptGallery } from "@/hooks/use-prompt-gallery";
import styles from "./studio-layout.module.css";

const examples = {
    image: { title: "画面，始于你的想象。", text: "描述一个场景，或上传喜欢的参考图。在这里，完成你的下一件作品。", prompt: "极简白色建筑，几何线条与负空间，柔和的自然光，低角度仰拍，建筑摄影，干净而安静的构图。", offset: 0 },
    video: { title: "让灵感，开始流动。", text: "描述主体的动作、镜头的运动与光线。你的故事，正等待第一帧。", prompt: "镜头缓缓掠过蓝绿色海面，海浪轻轻拍打海岸，日落的金色光线，流畅的电影镜头。", offset: 3 },
    "model-3d": { title: "想象，拥有新的维度。", text: "从一段描述或参考图开始，探索形体、纹理与材质，构建你的三维世界。", prompt: "一个极简风格的白色陶瓷花瓶，流畅有机曲线，磨砂材质，完整的三维模型。", offset: 6 },
};

export function StudioEmptyState({ kind, onUsePrompt }: { kind: keyof typeof examples; onUsePrompt: (prompt: string) => void }) {
    const example = examples[kind];
    const gallery = usePromptGallery();
    const items = gallery.items.slice(example.offset, example.offset + 3);
    return <div className={styles.empty}>
        <div className={styles.emptyArt}>{Array.from({ length: 3 }, (_, index) => <PromptLibraryImage key={items[index]?.id || index} prompt={items[index]} />)}</div>
        <h3>{example.title}</h3><p>{example.text}</p>
        <button type="button" onClick={() => onUsePrompt(kind === "image" && items[0] ? items[0].prompt : example.prompt)}>试试这个灵感 <ArrowUpRight size={13} /></button>
        <small>提示词图库视觉参考 · 选择灵感，开始创作</small>
        {gallery.isError ? <button type="button" onClick={() => void gallery.refetch()}>重新加载图库</button> : null}
    </div>;
}
