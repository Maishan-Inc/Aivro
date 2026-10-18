import { ArrowUpRight, Box } from "lucide-react";
import styles from "./studio-layout.module.css";

const examples = {
    image: { title: "画面，始于你的想象。", text: "描述一个场景，或上传喜欢的参考图。在这里，完成你的下一件作品。", prompt: "极简白色建筑，几何线条与负空间，柔和的自然光，低角度仰拍，建筑摄影，干净而安静的构图。", images: ["portrait", "architecture", "desert"] },
    video: { title: "让灵感，开始流动。", text: "描述主体的动作、镜头的运动与光线。你的故事，正等待第一帧。", prompt: "镜头缓缓掠过蓝绿色海面，海浪轻轻拍打海岸，日落的金色光线，流畅的电影镜头。", images: ["alpine", "coast", "space"] },
    "model-3d": { title: "想象，拥有新的维度。", text: "从一段描述或参考图开始，探索形体、纹理与材质，构建你的三维世界。", prompt: "一个极简风格的白色陶瓷花瓶，流畅有机曲线，磨砂材质，完整的三维模型。", images: [] },
};

export function StudioEmptyState({ kind, onUsePrompt }: { kind: keyof typeof examples; onUsePrompt: (prompt: string) => void }) {
    const example = examples[kind];
    return <div className={styles.empty}>
        {kind === "model-3d" ? <div className={styles.modelArt}><Box size={90} strokeWidth={.65} /></div> : <div className={styles.emptyArt}>{example.images.map((name) => <img key={name} src={`/showcase/${name}.webp`} width={240} height={320} alt="视觉灵感示例" loading="lazy" />)}</div>}
        <h3>{example.title}</h3><p>{example.text}</p>
        <button type="button" onClick={() => onUsePrompt(example.prompt)}>试试这个灵感 <ArrowUpRight size={13} /></button>
        <small>{kind === "model-3d" ? "几何图形为示意，生成后展示实际结果" : "视觉参考 · 点击示例填入提示词后即可开始创作"}</small>
    </div>;
}
