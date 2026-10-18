"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { App, Button, Dropdown, Input } from "antd";
import { ArrowUp, BookOpen, ClipboardPaste, FolderPlus, Plus, Upload, X } from "lucide-react";
import { nanoid } from "nanoid";
import { StudioGenerationSettings } from "@/components/studio-generation-settings";
import { useImageComposerStore } from "@/stores/use-image-composer-store";
import styles from "./image-prompt-composer.module.css";

const PromptSelectDialog = dynamic(() => import("@/components/prompts/prompt-select-dialog").then((module) => module.PromptSelectDialog), { ssr: false });
const AssetPickerModal = dynamic(() => import("@/app/(user)/canvas/components/asset-picker-modal").then((module) => module.AssetPickerModal), { ssr: false });

export function ImagePromptComposer({ onSubmit, running = false }: { onSubmit: () => void; running?: boolean }) {
    const { message } = App.useApp();
    const { prompt, references, setPrompt, setReferences } = useImageComposerStore();
    const fileInput = useRef<HTMLInputElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [promptsOpen, setPromptsOpen] = useState(false);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [reading, setReading] = useState(false);
    const addImages = async (files: File[]) => {
        if (!files.length || reading || running) return;
        setReading(true);
        try {
            if (files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 50 * 1024 * 1024)) throw new Error("参考图仅支持 PNG、JPEG、WebP，单张不超过 50MB");
            const images = await Promise.all(files.map(async (file) => ({ id: nanoid(), name: file.name, type: file.type, dataUrl: await readLocalImage(file) })));
            setReferences((value) => [...value, ...images]);
            setExpanded(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取参考图失败");
        } finally {
            setReading(false);
        }
    };
    const pasteImages = async () => {
        try {
            const items = await navigator.clipboard.read();
            const files = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map(async (type) => new File([await item.getType(type)], "剪切板图片", { type }))));
            if (!files.length) throw new Error("剪切板里没有可读取的图片");
            await addImages(files);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取剪切板失败");
        }
    };

    return <>
        <div className={styles.composer} data-expanded={expanded} data-dragging={dragging} onFocus={() => setExpanded(true)} onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
        }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!running) void addImages(Array.from(event.dataTransfer.files));
        }}>
            {references.length ? <div className={styles.references}>{references.map((image) => <div key={image.id} className={styles.reference}>
                <img src={image.dataUrl} alt={image.name} />
                <button type="button" disabled={running} aria-label="移除参考图" onClick={() => setReferences((value) => value.filter((item) => item.id !== image.id))}><X size={12} /></button>
            </div>)}</div> : null}
            <div className={styles.inputRow}>
                <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} variant="borderless" autoSize={{ minRows: 1 }} wrap="soft" disabled={running} aria-label="生图提示词" placeholder="描述你想创作的画面，也可以添加参考图..." onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        if (prompt.trim() && !running && !reading) onSubmit();
                    }
                }} onPaste={(event) => {
                    const files = Array.from(event.clipboardData.files);
                    if (files.length) { event.preventDefault(); void addImages(files); }
                }} />
                <Button className={styles.send} type="primary" shape="circle" icon={<ArrowUp size={20} />} loading={running || reading} disabled={!prompt.trim() || running || reading} onClick={onSubmit} aria-label="开始生成" title={reading ? "正在读取参考图" : "开始生成"} />
            </div>
            <div className={styles.controls}><div><div className={styles.toolbar} inert={!expanded}>
                <Dropdown trigger={["click"]} placement="bottomLeft" disabled={running || reading} menu={{ items: [
                    { key: "upload", icon: <Upload size={15} />, label: "添加参考图" },
                    { key: "clipboard", icon: <ClipboardPaste size={15} />, label: "读取剪切板图片" },
                    { key: "assets", icon: <FolderPlus size={15} />, label: "我的素材" },
                    { key: "prompts", icon: <BookOpen size={15} />, label: "提示词库" },
                ], onClick: ({ key }) => {
                    if (key === "upload") fileInput.current?.click();
                    if (key === "clipboard") void pasteImages();
                    if (key === "assets") setAssetsOpen(true);
                    if (key === "prompts") setPromptsOpen(true);
                } }}><Button type="text" shape="circle" icon={<Plus size={19} />} aria-label="添加参考图或选择灵感" /></Dropdown>
                <StudioGenerationSettings kind="image" />
            </div></div></div>
        </div>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { void addImages(Array.from(event.target.files || [])); event.target.value = ""; }} />
        {promptsOpen ? <PromptSelectDialog open onOpenChange={setPromptsOpen} onSelect={setPrompt} /> : null}
        {assetsOpen ? <AssetPickerModal open defaultTab="my-assets" onClose={() => setAssetsOpen(false)} onInsert={(payload) => {
            if (payload.kind === "text") setPrompt(payload.content);
            else if (payload.kind === "image") setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: "image/png", dataUrl: payload.dataUrl }]);
            else message.warning("生图工作台暂不支持插入视频素材");
            setAssetsOpen(false);
        }} /> : null}
    </>;
}

function readLocalImage(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("读取参考图失败"));
        reader.readAsDataURL(file);
    });
}
