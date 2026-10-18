"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, FileText, ImagePlus, Layers3, Maximize2, Pause, Play, Plus, Sparkles, Video } from "lucide-react";

import { FlowBackground } from "@/components/flow-background";
import { navigationTools } from "@/constant/navigation-tools";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { promptImageUrl } from "@/lib/prompt-image-url";
import { fetchPrompts } from "@/services/api/prompts";
import { questions, showcase, toolDescriptions } from "./home-content";
import styles from "./home.module.css";

const scenes = [
    { label: "图像创作", icon: ImagePlus, image: "/showcase/desert.webp", title: "把脑海里的风景，变成眼前的画面。", prompt: showcase[0].prompt, route: "/image", format: "16 : 9" },
    { label: "视频叙事", icon: Video, image: "/showcase/coast.webp", title: "让每一帧，都有继续发生的故事。", prompt: "镜头缓缓掠过蓝绿色海面，海浪轻轻拍打海岸，光线自然，流畅的电影镜头。", route: "/video", format: "镜头灵感" },
    { label: "空间探索", icon: Box, image: "/showcase/architecture.webp", title: "从平面灵感，到有形的世界。", prompt: "极简主义建筑模型，流畅的几何形体，纯白材质，柔和阴影。", route: "/model-3d", format: "形体参考" },
];

export function HomeClientPage() {
    const localizedPath = useLocalizedPath();
    const { locale } = useI18n();
    const rootRef = useRef<HTMLElement>(null);
    const [sceneIndex, setSceneIndex] = useState(0);
    const [category, setCategory] = useState("精选灵感");
    const [paused, setPaused] = useState(false);
    const [visible, setVisible] = useState(true);
    const scene = scenes[sceneIndex];
    const filteredShowcase = category === "精选灵感" ? showcase : showcase.filter((item) => item.category === category);
    const prompts = useQuery({ queryKey: ["home-prompts", locale], queryFn: () => fetchPrompts({ locale, pageSize: 4 }) });

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.setAttribute("data-visible", "true");
                observer.unobserve(entry.target);
            }
        }), { root, threshold: 0.08 });
        root.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
        const updateVisibility = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", updateVisibility);
        updateVisibility();
        return () => { observer.disconnect(); document.removeEventListener("visibilitychange", updateVisibility); };
    }, []);

    return (
        <main ref={rootRef} className={styles.home} data-paused={paused || !visible} id="top">
            <section className={styles.hero}>
                <FlowBackground />
                <div className={styles.heroCopy}>
                    <Link href={localizedPath("/#platform")} className={styles.announcement}><span className={styles.liveDot} />一个空间，无限创作可能<ChevronRight size={13} /></Link>
                    <h1>让想象，<br /><span>成为作品。</span></h1>
                    <p>连接你的灵感与 AI 的可能。<br className="sm:hidden" />从图像、视频到 3D，<br className="hidden sm:block" />在同一个创作空间，完成下一个好作品。</p>
                    <div className={styles.actions}>
                        <Link href={localizedPath("/canvas")} className={styles.primary}>开始创作 <ArrowUpRight size={16} /></Link>
                        <a href="#showcase" className={styles.secondary}>探索灵感 <ArrowDown size={15} /></a>
                    </div>
                    <span className={styles.heroNote}>为创作者而生 · 让工具顺着想法走</span>
                </div>

                <div className={styles.heroDemo}>
                    <div className={styles.demoBar}>
                        <span className={styles.demoBrand}><span className={styles.logoMark} />创作，从这里发生</span>
                        <div className={styles.sceneTabs} role="tablist" aria-label="创作场景">
                            {scenes.map(({ label, icon: Icon }, index) => <button key={label} id={`scene-tab-${index}`} type="button" role="tab" aria-selected={sceneIndex === index} aria-controls="scene-preview" tabIndex={sceneIndex === index ? 0 : -1} data-active={sceneIndex === index} onClick={() => setSceneIndex(index)} onKeyDown={(event) => {
                                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                                event.preventDefault();
                                const next = event.key === "Home" ? 0 : event.key === "End" ? scenes.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + scenes.length) % scenes.length;
                                setSceneIndex(next);
                                document.getElementById(`scene-tab-${next}`)?.focus();
                            }}><Icon size={13} /><span>{label}</span></button>)}
                        </div>
                    </div>
                    <div id="scene-preview" role="tabpanel" aria-labelledby={`scene-tab-${sceneIndex}`} className={styles.demoStage}>
                        <div className={styles.promptNode}>
                            <div className={styles.nodeHeading}><FileText size={13} />灵感输入<span>01</span></div>
                            <p key={sceneIndex} data-i18n-skip>{scene.prompt}</p>
                            <div className={styles.nodeFoot}><span className={styles.liveDot} />准备好探索了吗<ArrowRight size={14} /></div>
                        </div>
                        <div className={styles.connection} aria-hidden="true"><span /><div className={styles.engine}><span className={styles.logoMark} /></div><span /></div>
                        <Link key={scene.image} href={localizedPath(`${scene.route}?prompt=${encodeURIComponent(scene.prompt)}`)} className={styles.outputNode}>
                            <img src={scene.image} alt={scene.title} width={1200} height={800} fetchPriority="high" />
                            <span className={styles.imageBadge}>{scene.format}</span>
                            <div className={styles.outputCaption}><span>视觉灵感参考<strong>{scene.title}</strong></span><ArrowUpRight size={20} /></div>
                        </Link>
                    </div>
                    <div className={styles.demoFoot}><span><span className={styles.liveDot} />灵感 → 提示词 → 创作</span><span>你的下一件作品，只差一个开始。</span><button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "播放页面动画" : "暂停页面动画"} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "播放动效" : "暂停动效"}</button></div>
                </div>
                <div className={styles.capabilities}><span>让创作自然衔接</span>{[{ icon: Maximize2, label: "无限画布" }, { icon: ImagePlus, label: "图像生成" }, { icon: Video, label: "视频创作" }, { icon: Box, label: "3D 模型" }, { icon: Layers3, label: "灵感管理" }].map(({ icon: Icon, label }) => <span key={label}><Icon size={18} />{label}</span>)}</div>
            </section>

            <div className={styles.content}>
                <section id="platform" className={styles.section} data-reveal>
                    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / 创作的全貌</span><h2>好想法不该<br />停在工具之间。</h2></div><p>从第一句提示词到最终输出，<br />把分散的步骤连接起来。<br />一个工作空间，容纳你的整个创作过程。</p></div>
                    <div className={styles.workflow}>
                        <div className={styles.workflowCopy}><Maximize2 size={24} strokeWidth={1.4} /><h3>像思考一样，<br />自由连接。</h3><p>把文字、参考图、生成节点放到无限画布上。随时调整，持续探索，让每一步都成为下一次灵感的起点。</p><Link href={localizedPath("/canvas")} className={styles.textLink}>打开工作流 <ArrowRight size={15} /></Link><div className={styles.smallTags}><span>节点连接</span><span>参考图</span><span>画布助手</span></div></div>
                        <div className={styles.workflowDiagram} aria-label="工作流示意：灵感笔记连接图像生成，再连接视频分镜">
                            <svg className={styles.wires} viewBox="0 0 640 380" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M160 100H235Q260 100 260 125V185Q260 210 285 210H325M160 285H235Q260 285 260 260V235Q260 210 285 210M465 210H505Q535 210 535 185V90H575" /><path className={styles.wireActive} d="M160 100H235Q260 100 260 125V185Q260 210 285 210H325M465 210H505Q535 210 535 185V90H575" /></svg>
                            <div className={styles.diagramNote}><span><FileText size={12} />灵感笔记</span><p>在山与云之间，<br />寻找一束光。</p><i /></div>
                            <div className={styles.diagramReference}><img src="/showcase/alpine.webp" alt="云雾间的山峰参考" width={1200} height={800} loading="lazy" /><span>参考图 · 原始比例</span><i /></div>
                            <div className={styles.diagramGenerate}><span><Sparkles size={13} />图像生成</span><img src="/showcase/desert.webp" alt="荒漠砂岩视觉参考" width={1200} height={800} loading="lazy" /><div>让想法拥有画面 <Check size={12} /></div><i /></div>
                            <div className={styles.diagramVideo}><Video size={15} /><span>继续创作<br /><strong>视频分镜</strong></span></div>
                            <div className={styles.diagramLabel}>创作流程示意 <span>+</span><span>−</span><span>100%</span></div>
                        </div>
                    </div>
                </section>

                <section id="showcase" className={styles.section} data-reveal>
                    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>02 / 灵感没有边界</span><h2>先看见，<br />再创造你的版本。</h2></div><p>自然的纹理、建筑的秩序、人物的情绪。<br />从一个视觉线索出发，<br />让你的表达拥有自己的风格。</p></div>
                    <div className={styles.galleryToolbar}><div className={styles.filterTabs} aria-label="灵感分类">{["精选灵感", "自然与空间", "人像与风格"].map((item) => <button key={item} type="button" aria-pressed={category === item} data-active={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div><Link href={localizedPath("/prompts")} className={styles.textLink}>浏览提示词库 <ArrowUpRight size={14} /></Link></div>
                    <div className={styles.gallery}>{filteredShowcase.map((item, index) => <Link key={item.id} href={localizedPath(`/image?prompt=${encodeURIComponent(item.prompt)}`)} className={styles.galleryCard}>
                        <div className={styles.galleryImage}><img src={item.image} alt={item.title} width={1200} height={800} loading="lazy" /><span>使用灵感提示词 <ArrowUpRight size={15} /></span></div><div className={styles.galleryCaption}><span><small>0{index + 1} / {item.category}</small><strong>{item.title}</strong></span><Plus size={17} /></div>
                    </Link>)}</div>
                    <p className={styles.sourceNote}>摄影图片用于视觉灵感展示，生成效果以实际模型输出为准。图片来源：<a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash <ArrowUpRight size={10} /></a></p>
                </section>

                <section className={styles.featureSection} data-reveal>
                    <div className={styles.featureCopy}><span className={styles.eyebrow}><ImagePlus size={14} />03 / 图像创作</span><h2>一句描述。<br />万千种可能。</h2><p>用文字勾勒画面，也用参考图传递那些难以描述的细节。选择模型、调整尺寸与质量，在每一次生成中，靠近心里的答案。</p><ul><li><Check size={14} />文字生成与参考图编辑</li><li><Check size={14} />多张生成与历史记录</li><li><Check size={14} />保存素材，继续创作</li></ul><Link href={localizedPath("/image")} className={styles.primary}>进入生图工作台 <ArrowUpRight size={15} /></Link></div>
                    <div className={styles.imageFeature}><img src="/showcase/architecture.webp" alt="白色建筑与蓝天的几何构图" width={1200} height={800} loading="lazy" /><div className={styles.imagePrompt}><Sparkles size={16} /><p>极简建筑，明亮天光，<br />让线条和留白成为主角。</p><Link href={localizedPath(`/image?prompt=${encodeURIComponent(showcase[1].prompt)}`)} aria-label="使用建筑灵感提示词"><ArrowUpRight size={18} /></Link></div><span className={styles.cornerLabel}>构图 / 光线 / 质感</span></div>
                </section>

                <section className={styles.videoFeature} data-reveal>
                    <img src="/showcase/coast.webp" alt="蓝色海面与远处天空的镜头灵感" width={1200} height={800} loading="lazy" />
                    <div className={styles.videoOverlay}><span className={styles.eyebrow}><Video size={14} />04 / 视频叙事</span><h2>让故事，<br />从这一帧继续。</h2><p>为静态的灵感赋予时间。描述镜头的运动、主体的动作与场景氛围，让想象逐帧展开。</p><Link href={localizedPath("/video")} className={styles.lightButton}>进入视频创作台 <ArrowUpRight size={16} /></Link></div>
                    <div className={styles.timeline} aria-hidden="true"><Video size={16} /><span>镜头灵感</span><div>{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 13) % 23)}px` }} />)}</div><span>让时间参与创作</span></div>
                </section>

                <section className={styles.featureSection} data-reveal>
                    <div className={styles.modelFeature} aria-label="旋转的几何立方体示意"><div className={styles.modelGrid} /><div className={styles.cubeStage}><div className={styles.cube}>{["front", "back", "left", "right", "top", "bottom"].map((side) => <div key={side} data-side={side}><span /></div>)}</div></div><span className={styles.modelAxis}>Y<br />↑<br />└── X</span><div className={styles.modelLegend}><span><span className={styles.liveDot} />空间，正在展开</span><span>3D / 形体示意</span></div></div>
                    <div className={styles.featureCopy}><span className={styles.eyebrow}><Box size={14} />05 / 三维探索</span><h2>多一个维度，<br />多一种表达。</h2><p>从文字、一张图片或多个视角出发，探索三维形体。调整网格质量、纹理与 PBR 参数，把创意转化为可以继续使用的模型文件。</p><div className={styles.smallTags}><span>文字 / 图片输入</span><span>纹理与材质</span><span>模型下载</span></div><Link href={localizedPath("/model-3d")} className={styles.primary}>进入 3D 工作台 <ArrowUpRight size={15} /></Link></div>
                </section>

                <section className={styles.section} data-reveal>
                    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>06 / 灵感的下一站</span><h2>从一句好提示词，<br />到你的下一件作品。</h2></div><Link href={localizedPath("/prompts")} className={styles.textLink}>探索全部提示词 <ArrowUpRight size={15} /></Link></div>
                    <div className={styles.promptGrid}>
                        {prompts.data?.items.length ? prompts.data.items.map((item) => <Link key={item.id} href={localizedPath(`/image?prompt=${encodeURIComponent(item.prompt)}`)} className={styles.promptCard}><img src={promptImageUrl(item.coverUrl)} onError={(event) => { if (event.currentTarget.getAttribute("src") !== "/showcase/alpine.webp") event.currentTarget.src = "/showcase/alpine.webp"; }} alt={item.title} width={600} height={400} loading="lazy" /><div><span>{item.category}</span><h3>{item.title}</h3><p data-i18n-skip>{item.prompt}</p><strong>使用提示词 <ArrowUpRight size={14} /></strong></div></Link>) : showcase.slice(0, 4).map((item) => <Link key={item.id} href={localizedPath(`/image?prompt=${encodeURIComponent(item.prompt)}`)} className={styles.promptCard}><img src={item.image} alt={item.title} width={600} height={400} loading="lazy" /><div><span>灵感起点 / {item.category}</span><h3>{item.title}</h3><p data-i18n-skip>{item.prompt}</p><strong>使用提示词 <ArrowUpRight size={14} /></strong></div></Link>)}
                    </div>
                    {prompts.isError ? <p className={styles.sourceNote}>在线推荐暂时不可用，先从这些灵感示例开始。<button type="button" onClick={() => void prompts.refetch()}>重新加载</button></p> : null}
                </section>

                <section className={styles.section} data-reveal>
                    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>07 / 你的创作工具箱</span><h2>各有所长，<br />也彼此相连。</h2></div><p>生成、整理、探索、复用。<br />打开左侧导航，<br />找到适合当下这一步的工具。</p></div>
                    <div className={styles.toolGrid}>{navigationTools.map((tool) => <Link key={tool.slug} href={tool.external ? tool.href + ("localeAware" in tool && tool.localeAware && locale === "zh-CN" ? "/zh-CN" : "") : localizedPath(`/${tool.slug}`)} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noopener noreferrer" : undefined} className={styles.toolCard}><tool.icon size={21} strokeWidth={1.4} /><h3>{tool.label}<ArrowUpRight size={14} /></h3><p>{toolDescriptions[tool.slug]}</p><span>{tool.external ? "在独立站点打开" : "在工作空间中打开"}</span></Link>)}</div>
                </section>

                <section className={styles.stepsSection} data-reveal><span className={styles.eyebrow}>08 / 现在，轮到你了</span><h2>从想法到作品，<br className="sm:hidden" />就从这三步开始。</h2><div className={styles.steps}>{[{ title: "找到一个起点", text: "一句描述、一张参考图，或提示词库里让你心动的画面。", href: "/prompts", link: "寻找灵感" }, { title: "选择你的表达", text: "打开图片、视频或 3D 工作台，选择模型，调整参数。", href: "/image", link: "尝试生成" }, { title: "让创作继续", text: "保存作品与素材，在画布中连接下一步，建立自己的工作流。", href: "/canvas", link: "打开画布" }].map((step, index) => <div key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={localizedPath(step.href)} className={styles.textLink}>{step.link}<ArrowRight size={14} /></Link></div>)}</div></section>

                <section id="faq" className={styles.faqSection} data-reveal><div><span className={styles.eyebrow}>09 / 开始之前</span><h2>你可能<br />还想了解。</h2><Link href={localizedPath("/pricing")} className={styles.textLink}>查看套餐 <ArrowUpRight size={14} /></Link></div><div>{questions.map((item) => <details key={item.question} className={styles.faq}><summary>{item.question}<Plus size={16} /></summary><p>{item.answer}</p></details>)}</div></section>

                <section className={styles.closing} data-reveal><FlowBackground /><span className={styles.eyebrow}>下一个好作品，从你的想象开始。</span><h2>想到了，<br />就去创造。</h2><div className={styles.actions}><Link href={localizedPath("/canvas")} className={styles.primary}>开启我的创作 <ArrowUpRight size={16} /></Link><Link href={localizedPath("/prompts")} className={styles.secondary}>再找一点灵感 <ArrowRight size={15} /></Link></div></section>

                <footer className={styles.footer}><div className={styles.footerTop}><div><Link href={localizedPath("/")} className={styles.footerBrand}><span className={styles.logoMark} />Aivro</Link><p>让想象，成为作品。</p></div><div><strong>创作</strong><Link href={localizedPath("/canvas")}>工作流</Link><Link href={localizedPath("/image")}>图像生成</Link><Link href={localizedPath("/video")}>视频创作</Link><Link href={localizedPath("/model-3d")}>3D 模型</Link></div><div><strong>探索</strong><Link href={localizedPath("/prompts")}>提示词库</Link><Link href={localizedPath("/assets")}>我的素材</Link><Link href={localizedPath("/console/community")}>社区工作流</Link><Link href={localizedPath("/pricing")}>套餐</Link></div><div><strong>关于</strong><a href="#faq">常见问题</a><Link href={localizedPath("/privacy")}>隐私政策</Link><Link href={localizedPath("/terms")}>服务条款</Link><a href="#top">回到顶部 ↑</a></div></div><div className={styles.footerBottom}><span>Copyright © 2026 Maishan Inc. All rights reserved Aivro</span><span><span className={styles.liveDot} />保持好奇，持续创造。</span></div><div className={styles.footerWordmark} aria-hidden="true">Aivro</div></footer>
            </div>
        </main>
    );
}
