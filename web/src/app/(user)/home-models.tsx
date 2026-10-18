"use client";

import Link from "next/link";
import { ArrowUpRight, Box } from "lucide-react";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import styles from "./home.module.css";

const modelGroups = [
    { label: "生图模型", href: "/image", models: [
        { name: "GPT-Image", company: "OpenAI", versions: "2.5 Sunburst · 2.5 Flare · 2 Medium", logo: "openai.svg" },
        { name: "Grok Imagine", company: "xAI", versions: "Image 2.0", logo: "grok.svg" },
        { name: "MAI-Image", company: "Microsoft AI", versions: "2.6", logo: "microsoft.svg" },
        { name: "Nano Banana", company: "Google", versions: "2.1", logo: "nanobanana.svg" },
        { name: "Reve", company: "Reve", versions: "2.1 · 2.0", logo: "reve.svg" },
        { name: "Muse Image", company: "Meta", versions: "", logo: "meta.svg" },
    ] },
    { label: "视频模型", href: "/video", models: [
        { name: "Grok Imagine", company: "xAI", versions: "", logo: "grok.svg" },
        { name: "Flux", company: "Black Forest Labs", versions: "3", logo: "flux.svg" },
        { name: "Seedance", company: "字节跳动", versions: "2.5 · 2.0 Fast · 1.5 Pro", logo: "bytedance.svg" },
        { name: "Kling", company: "快手", versions: "3.0 · 2.6 Image-to-Video", logo: "kling.svg" },
        { name: "Veo", company: "Google", versions: "3.1 · 3.1 Fast Generate", logo: "google.svg" },
    ] },
    { label: "3D 模型", href: "/model-3d", models: [
        { name: "PicGen3D", company: "CSM", versions: "", logo: "" },
        { name: "TRELLIS", company: "Microsoft Research", versions: "", logo: "trellis.png" },
        { name: "Meshy", company: "Meshy", versions: "", logo: "meshy.svg" },
        { name: "404_GEN", company: "404-GEN", versions: "", logo: "404gen.svg" },
        { name: "Meshy-7", company: "", versions: "", logo: "meshy.svg" },
        { name: "Zaohaowu3D", company: "Zaohaowu", versions: "", logo: "zaohao.jpeg" },
        { name: "Hunyuan 3D", company: "腾讯", versions: "", logo: "hunyuan.svg" },
        { name: "UniLat3D-3DGS", company: "", versions: "", logo: "" },
        { name: "InstantMesh", company: "腾讯 ARC", versions: "", logo: "tencent.svg" },
        { name: "SAM 3D", company: "Meta", versions: "", logo: "meta.svg" },
    ] },
];
const supportedModels = modelGroups.flatMap(({ label, href, models }) => models.map((model) => ({ ...model, label, href })));

export function HomeModels() {
    const localizedPath = useLocalizedPath();

    return <section id="models" className={styles.modelsSection} aria-labelledby="models-title" data-reveal>
        <div className={styles.discoveryHeading}>
            <div><span className={styles.eyebrow}>汇聚创作的力量</span><h2 id="models-title">支持的模型</h2></div>
            <a href="#plans" className={styles.textLink}>套餐推荐 <ArrowUpRight size={17} /></a>
        </div>
        <div className={styles.modelTicker} data-native-scroll>
            <div className={styles.modelTrack}>{[0, 1].map((copy) => <ul key={copy} className={styles.modelList} aria-label={copy === 0 ? "支持的模型" : undefined} aria-hidden={copy === 1}>
                {supportedModels.map((model) => <li key={model.label + model.name}>
                    <Link href={localizedPath(model.href)} tabIndex={copy === 1 ? -1 : undefined} className={styles.modelBrand} title={[model.label, model.name, model.versions, model.company].filter(Boolean).join(" · ")}>
                        {model.logo.endsWith(".svg") ? <span className={styles.modelLogo} data-wide={model.name === "404_GEN"} style={{ maskImage: `url(/icons/${model.logo})` }} aria-hidden="true" /> : model.logo ? <img className={styles.modelImage} data-monochrome={model.logo === "zaohao.jpeg"} src={`/icons/${model.logo}`} width={34} height={34} alt="" loading="lazy" /> : <span className={styles.modelWordmark} aria-hidden="true">{model.company || <Box size={28} strokeWidth={1.3} />}</span>}
                        <strong>{model.name}</strong><span>{model.label} · {model.company || "品牌信息待确认"}</span>
                        <small>{model.versions || "\u00a0"}</small>
                    </Link>
                </li>)}
            </ul>)}</div>
        </div>
        <p className={styles.sourceNote}>模型品牌展示，具体可用型号以工作台为准。</p>
    </section>;
}
