"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { SiX, SiFacebook, SiDiscord, SiTiktok, SiBilibili } from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, ImagePlus, Maximize2, Pause, Play, Plus, Video } from "lucide-react";
import { FlowBackground } from "@/components/flow-background";
import { ImagePromptComposer } from "@/components/image-prompt-composer";
import { CookiePreferences } from "@/components/cookie-preferences";
import { PromptLibraryImage } from "@/components/prompt-library-image";
import { navigationTools } from "@/constant/navigation-tools";
import { defaultHomeSettings, homeSocialPlatforms } from "@/constant/home-settings";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { promptGallerySources, usePromptGallery } from "@/hooks/use-prompt-gallery";
import { questions, toolDescriptions } from "./home-content";
import { homeWordmarkPaths } from "./home-wordmark";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useImageComposerStore } from "@/stores/use-image-composer-store";
import { useUserStore } from "@/stores/use-user-store";
import { useHomeScroll } from "./use-home-scroll";
import { HomeModels } from "./home-models";
import { HomePlans } from "./home-plans";
import { HomeNetwork } from "./home-network";
import styles from "./home.module.css";

const scenes = [
    { label: "图像创作", icon: ImagePlus, title: <>一句描述<br />万千种可能</>, text: "用文字勾勒画面，也用参考图传递那些难以描述的细节。在每一次生成中，靠近心里的答案。", route: "/image", points: ["文字生图与参考图编辑", "自由比例与多张生成", "保存作品，继续创作"] },
    { label: "视频叙事", icon: Video, title: <>让故事<br />从这一帧继续</>, text: "为静态的灵感赋予时间。描述镜头的运动、主体的动作与场景氛围，让想象逐帧展开。", route: "/video", points: ["文字与参考图输入", "镜头、尺寸与时长", "从灵感到动态叙事"] },
    { label: "空间探索", icon: Box, title: <>多一个维度<br />多一种表达</>, text: "从文字、一张图片或多个视角出发，探索三维形体。让材质与结构，成为表达的一部分。", route: "/model-3d", points: ["文字、图片与多视角", "网格、纹理与 PBR", "生成并下载模型"] },
];

export function HomeClientPage() {
    const router = useRouter();
    const { message } = App.useApp();
    const localizedPath = useLocalizedPath();
    const { locale } = useI18n();
    const [category, setCategory] = useState("all");
    const [paused, setPaused] = useState(false);
    const [visible, setVisible] = useState(true);
    const [sending, setSending] = useState(false);
    const [openQuestion, setOpenQuestion] = useState<string | null>(null);
    const home = useConfigStore((state) => state.publicSettings?.home);
    const config = useEffectiveConfig();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [failedVideoUrl, setFailedVideoUrl] = useState("");
    const videoUrl = home?.videoUrl || defaultHomeSettings.videoUrl;
    const videoEnabled = Boolean(home?.videoEnabled && failedVideoUrl !== videoUrl);
    const rootRef = useHomeScroll(paused || !visible);
    const gallery = usePromptGallery();
    const featured = category === "all" ? gallery.items.slice(0, 12) : gallery.items.filter((item) => item.category === category);
    const promptLink = (index: number, route = "/image") => localizedPath(gallery.items[index] ? route + "?prompt=" + encodeURIComponent(gallery.items[index].prompt) : route);

    useEffect(() => {
        const update = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => {
            if (paused || !visible || reduced.matches) video.pause();
            else void video.play().catch(() => {});
        };
        sync();
        reduced.addEventListener("change", sync);
        return () => reduced.removeEventListener("change", sync);
    }, [paused, visible, videoEnabled, videoUrl]);

    const startImage = async () => {
        if (sending) return;
        const { prompt, references } = useImageComposerStore.getState();
        if (!prompt.trim()) return;
        if (!useConfigStore.getState().isAiConfigReady(config, config.imageModel || config.model)) {
            message.warning("管理员尚未配置可用模型，或配置仍在加载");
            return;
        }
        setSending(true);
        try {
            const draft = nanoid();
            await localforage.setItem(`image-draft-${draft}`, { prompt, references, config: { model: config.model, imageModel: config.imageModel, quality: config.quality, size: config.size, count: config.count } });
            const destination = localizedPath(`/image?draft=${draft}`);
            router.push(useUserStore.getState().token ? destination : localizedPath(`/login?redirect=${encodeURIComponent(destination)}`));
        } catch {
            message.error("无法保存创作草稿，请检查浏览器存储空间");
            setSending(false);
        }
    };

    return <main ref={rootRef} className={styles.home} data-home-scroll data-paused={paused || !visible} id="top">
        <div className={styles.ambient} aria-hidden="true"><div><FlowBackground /></div></div>
        <div data-home-content className={styles.homeContent}>
            <section className={styles.hero} data-video={videoEnabled}>
                {videoEnabled ? <div className={styles.heroMedia}><video ref={videoRef} src={videoUrl} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onError={() => setFailedVideoUrl(videoUrl)} /></div> : null}
                <div className={styles.heroCopy}>
                    <a href="#platform" className={styles.announcement}><span className={styles.liveDot} />一个空间，无限创作可能<ChevronRight size={14} /></a>
                    <h1>让想象成为作品</h1>
                    <div className={styles.heroComposer}><ImagePromptComposer onSubmit={() => void startImage()} running={sending} /></div>
                </div>
            </section>

            <HomeModels />
            <HomePlans />
            <HomeNetwork />

            <div id="platform" className={styles.platformHeading}>
                <span className={styles.eyebrow}>一个想法，更多表达。</span>
                <div className={styles.sceneLinks}>{scenes.map(({ label, icon: Icon }, index) => <a key={label} href={"#scene-" + index}><Icon size={18} />{label}<ArrowDown size={14} /></a>)}</div>
                <button type="button" className={styles.motionToggle} onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "播放动效" : "暂停动效"}</button>
            </div>

            {scenes.map(({ label, icon: Icon, title, text, route, points }, index) => <section key={label} id={"scene-" + index} className={styles.scene} data-reverse={index % 2 === 1} data-reveal>
                <div className={styles.sceneCopy}><span className={styles.eyebrow}><Icon size={17} />0{index + 1} / {label}</span><h2>{title}</h2><p>{text}</p><ul>{points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul><Link href={localizedPath(route)} className={styles.primary}>开始{label} <ArrowUpRight size={18} /></Link></div>
                <div className={styles.sceneVisual}>
                    <Link href={promptLink(index, route)} className={styles.sceneImage}><PromptLibraryImage prompt={gallery.items[index]} className={styles.fillImage} /><span className={styles.imageCaption}><span>灵感参考 / {label}</span><ArrowUpRight size={22} /></span></Link>
                    <Link href={promptLink(index + 6, route)} className={styles.sceneInset} aria-label={"使用" + label + "灵感"}><PromptLibraryImage prompt={gallery.items[index + 6]} className={styles.fillImage} /></Link>
                    <span className={styles.sceneNumber} aria-hidden="true">0{index + 1}</span>
                </div>
            </section>)}

            <section className={styles.workflow} data-reveal>
                <div><span className={styles.eyebrow}><Maximize2 size={17} />04 / 让创作连起来</span><h2>像思考一样<br />自由连接</h2><p>把灵感、参考与生成步骤放到无限画布上。<br />让每一步，都成为下一次创作的起点。</p><Link href={localizedPath("/canvas")} className={styles.textLink}>打开工作流 <ArrowRight size={18} /></Link></div>
                <div className={styles.workflowImages} aria-label="参考图与创作灵感"><PromptLibraryImage prompt={gallery.items[3]} /><span aria-hidden="true">→</span><PromptLibraryImage prompt={gallery.items[4]} /><span aria-hidden="true">→</span><PromptLibraryImage prompt={gallery.items[5]} /></div>
            </section>

            <section id="showcase" className={styles.section} data-reveal>
                <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>05 / 灵感没有边界</span><h2>先看见<br />再创造你的版本</h2></div><Link href={localizedPath("/prompts")} className={styles.textLink}>探索完整图库 <ArrowUpRight size={18} /></Link></div>
                <div className={styles.filterTabs} data-native-scroll aria-label="灵感图库分类">{[{ id: "all", label: "全部灵感" }, ...promptGallerySources].map((source) => <button type="button" key={source.id} data-active={category === source.id} aria-pressed={category === source.id} onClick={() => setCategory(source.id)}>{source.label}</button>)}</div>
                <div className={styles.gallery} aria-busy={gallery.isLoading}>
                    {featured.map((item) => <Link key={item.id} href={localizedPath("/image?prompt=" + encodeURIComponent(item.prompt))} className={styles.galleryCard}><PromptLibraryImage prompt={item} className={styles.galleryImage} /><div className={styles.galleryCaption}><span><small>{promptGallerySources.find((source) => source.id === item.category)?.label || item.category}</small><strong>{item.title}</strong></span><ArrowUpRight size={20} /></div></Link>)}
                    {!featured.length && gallery.isLoading ? Array.from({ length: 6 }, (_, index) => <div key={index} className={styles.gallerySkeleton} />) : null}
                </div>
                {!featured.length && !gallery.isLoading ? <p className={styles.sourceNote}>这个分类暂时还没有可展示的作品。</p> : null}
                {gallery.isError ? <p className={styles.sourceNote}>部分图库暂时未能加载。<button type="button" onClick={() => void gallery.refetch()}>重新加载</button></p> : null}
                <p className={styles.sourceNote}>展示作品来自提示词图库。点击作品，将对应提示词带入创作工作台。</p>
            </section>

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>06 / 创作工具箱</span><h2>各有所长<br />也彼此相连</h2></div><p>生成、整理、探索、复用。<br />为每一个想法，找到合适的工具。</p></div>
                <div className={styles.toolGrid}>{navigationTools.map((tool) => <Link key={tool.slug} href={tool.external ? tool.href + ("localeAware" in tool && tool.localeAware && locale === "zh-CN" ? "/zh-CN" : "") : localizedPath("/" + tool.slug)} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noopener noreferrer" : undefined} className={styles.toolCard}><tool.icon size={30} strokeWidth={1.2} /><h3>{tool.label}<ArrowUpRight size={19} /></h3><p>{toolDescriptions[tool.slug]}</p><span>{tool.external ? "在独立站点打开" : "在工作空间中打开"}</span></Link>)}</div>
            </section>

            <section className={styles.stepsSection} data-reveal><span className={styles.eyebrow}>07 / 现在，轮到你了</span><h2>从想法到作品<br className="sm:hidden" />就从这三步开始</h2><div className={styles.steps}>{[{ title: "找到一个起点", text: "一句描述、一张参考图，或图库里让你心动的画面。", href: "/prompts", link: "寻找灵感" }, { title: "选择你的表达", text: "打开图片、视频或 3D 工作台，把想象写下来。", href: "/image", link: "尝试生成" }, { title: "让创作继续", text: "保存作品，在画布中连接下一步，建立自己的工作流。", href: "/canvas", link: "打开画布" }].map((step, index) => <div key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={localizedPath(step.href)} className={styles.textLink}>{step.link}<ArrowRight size={17} /></Link></div>)}</div></section>

            <section id="faq" className={styles.faqSection} data-reveal><div><span className={styles.eyebrow}>08 / 开始之前</span><h2>你可能<br />还想了解</h2><Link href={localizedPath("/pricing")} className={styles.textLink}>查看套餐 <ArrowUpRight size={17} /></Link></div><div>{questions.map((item, index) => <div key={item.question} className={styles.faq} data-open={openQuestion === item.question}><h3><button type="button" id={`faq-question-${index}`} aria-expanded={openQuestion === item.question} aria-controls={`faq-answer-${index}`} onClick={() => setOpenQuestion((value) => value === item.question ? null : item.question)}>{item.question}<Plus size={19} /></button></h3><div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} aria-hidden={openQuestion !== item.question} className={styles.faqBody}><div><p>{item.answer}</p></div></div></div>)}</div></section>

            <section className={styles.closing} data-reveal><span className={styles.eyebrow}>下一个好作品从你的想象开始</span><h2>想到了就去创造</h2><div className={styles.actions}><Link href={localizedPath("/canvas")} className={styles.primary}>开启我的创作 <ArrowUpRight size={18} /></Link><Link href={localizedPath("/prompts")} className={styles.secondary}>再找一点灵感 <ArrowRight size={17} /></Link></div></section>

            <footer className={styles.footer}>
                <div className={styles.footerTop}><div><Link href={localizedPath("/")} className={styles.footerBrand}><span className={styles.logoMark} />Aivro</Link><p className={styles.footerIntro}>让想象成为作品。<br />连接文字、图像、视频与三维世界，<br />把每一次灵感，变成值得分享的创作。</p><div className={styles.footerSocial} aria-label="社交媒体">{homeSocialPlatforms.map(({ id, label }) => {
                    const link = home?.socialLinks[id] || defaultHomeSettings.socialLinks[id];
                    const Icon = { x: SiX, facebook: SiFacebook, discord: SiDiscord, tiktok: SiTiktok, bilibili: SiBilibili }[id];
                    return link.enabled ? <a key={id} href={link.url || undefined} role="link" aria-label={label} title={label} aria-disabled={!link.url} target={link.url ? "_blank" : undefined} rel={link.url ? "noopener noreferrer" : undefined}><Icon size={18} /></a> : null;
                })}</div></div><div><strong>创作</strong><Link href={localizedPath("/canvas")}>工作流</Link><Link href={localizedPath("/image")}>图像生成</Link><Link href={localizedPath("/video")}>视频创作</Link><Link href={localizedPath("/model-3d")}>3D 模型</Link></div><div><strong>探索</strong><Link href={localizedPath("/prompts")}>提示词库</Link><Link href={localizedPath("/assets")}>我的素材</Link><Link href={localizedPath("/console/community")}>社区工作流</Link><Link href={localizedPath("/models")}>模型定价</Link><Link href={localizedPath("/pricing")}>套餐</Link></div><div><strong>关于</strong><a href="#faq">常见问题</a><Link href={localizedPath("/privacy")}>隐私政策</Link><Link href={localizedPath("/terms")}>服务条款</Link><a href="#top">回到顶部 ↑</a></div></div>
                <div className={styles.footerBottom}><span><span className={styles.liveDot} />All systems normal.</span><CookiePreferences /><span className={styles.copyright}>Copyright © 2026 Maishan Inc. All rights reserved Aivro</span></div>
                <svg data-wordmark className={styles.footerWordmark} viewBox="0 0 1000 330" aria-label="Aivro" role="img">{homeWordmarkPaths.map((d, index) => <g key={index}><path data-wordmark-base d={d} aria-hidden="true" /><path data-wordmark-trace d={d} /></g>)}</svg>
            </footer>
        </div>
    </main>;
}

