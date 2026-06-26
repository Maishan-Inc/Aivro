"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Eye, History, ImageIcon, LoaderCircle, MessageSquare, PanelRightClose, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { App, Button, Modal, Tooltip } from "antd";

import { ImageGenerationPending } from "@/components/image-generation-pending";
import { ModelPicker } from "@/components/model-picker";
import { useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { batchDeleteCanvasAssistantSessions, fetchCanvasAssistantSessions, planCanvasAgent } from "@/services/api/workflows";
import { imageToDataUrl, storeGeneratedImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { CanvasNodeType, type CanvasAssistantImage, type CanvasAssistantMessage, type CanvasAssistantReference, type CanvasAssistantSession, type CanvasNodeData } from "../types";
import { sanitizeCanvasAgentSnapshot, summarizeCanvasAgentOps, type CanvasAgentOp, type CanvasAgentSnapshot } from "../utils/canvas-agent-ops";

type AssistantMode = "ask" | "image";
const PANEL_MOTION_MS = 500;
type AnimeInstance = {
    cancel?: () => void;
    pause?: () => void;
};

type CanvasAssistantPanelProps = {
    workflowId: string;
    nodes: CanvasNodeData[];
    selectedNodeIds: Set<string>;
    snapshot: CanvasAgentSnapshot;
    previewOps: CanvasAgentOp[];
    sessions: CanvasAssistantSession[];
    activeSessionId: string | null;
    onSelectNodeIds: (ids: Set<string>) => void;
    onSessionsChange: (sessions: CanvasAssistantSession[], activeSessionId: string | null) => void;
    onPreviewOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot | null;
    onCancelPreview: () => void;
    onConfirmPreview: () => void;
    onInsertImage: (image: CanvasAssistantImage) => void;
    onInsertText: (text: string) => void;
    onPasteImage: (file: File) => void;
    onCollapseStart: () => void;
    onCollapse: () => void;
};

export function CanvasAssistantPanel({ workflowId, nodes, selectedNodeIds, snapshot, previewOps, sessions, activeSessionId, onSelectNodeIds, onSessionsChange, onPreviewOps, onCancelPreview, onConfirmPreview, onInsertImage, onInsertText, onPasteImage, onCollapseStart, onCollapse }: CanvasAssistantPanelProps) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const effectiveConfig = useEffectiveConfig();
    const modelCosts = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts);
    const cleanupImages = useAssetStore((state) => state.cleanupImages);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const [width, setWidth] = useState(390);
    const [view, setView] = useState<"chat" | "history">("chat");
    const [mode, setMode] = useState<AssistantMode>("ask");
    const [prompt, setPrompt] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [checkedChatIds, setCheckedChatIds] = useState<string[]>([]);
    const [deleteChatIds, setDeleteChatIds] = useState<string[]>([]);
    const [closing, setClosing] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [removedReferenceIds, setRemovedReferenceIds] = useState<Set<string>>(new Set());
    const [localSessions, setLocalSessions] = useState<CanvasAssistantSession[]>(() => (sessions.length ? sessions : [createSession()]));
    const [localActiveSessionId, setLocalActiveSessionId] = useState<string | null>(activeSessionId);
    const rootRef = useRef<HTMLDivElement>(null);
    const asideRef = useRef<HTMLElement>(null);
    const openedRef = useRef(false);
    const snapshotRef = useRef(snapshot);

    useEffect(() => {
        if (!sessions.length) return;
        setLocalSessions(sessions);
        setLocalActiveSessionId(activeSessionId);
    }, [activeSessionId, sessions]);

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    useEffect(() => {
        if (!token || !workflowId) return;
        fetchCanvasAssistantSessions(token, workflowId)
            .then((result) => {
                const next = result.items.length ? result.items : [createSession()];
                setLocalSessions(next);
                setLocalActiveSessionId((current) => (current && next.some((session) => session.id === current) ? current : next[0]?.id || null));
            })
            .catch((error) => message.error(error instanceof Error ? error.message : "读取助手历史失败"));
    }, [message, token, workflowId]);

    useEffect(() => {
        onSessionsChange(localSessions, localActiveSessionId);
    }, [localActiveSessionId, localSessions, onSessionsChange]);

    const safeSessions = localSessions.length ? localSessions : [createSession()];
    const activeSession = useMemo(() => safeSessions.find((session) => session.id === localActiveSessionId) || safeSessions[0] || null, [localActiveSessionId, safeSessions]);
    const historySessions = safeSessions.filter((session) => session.messages.length > 0);
    const messages = activeSession?.messages || [];
    const hasMessages = messages.length > 0;
    const selectedNodeKey = useMemo(() => Array.from(selectedNodeIds).sort().join(","), [selectedNodeIds]);
    const allSelectedReferences = useMemo(() => buildAssistantReferences(nodes, selectedNodeIds), [nodes, selectedNodeIds]);
    const selectedReferences = useMemo(() => allSelectedReferences.filter((item) => !removedReferenceIds.has(item.id)), [allSelectedReferences, removedReferenceIds]);
    const iconButtonStyle = { color: theme.node.muted };

    useEffect(() => {
        setRemovedReferenceIds(new Set());
    }, [selectedNodeKey]);

    useEffect(() => {
        const root = rootRef.current;
        const aside = asideRef.current;
        if (!root || !aside || resizing) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            if (closing) onCollapse();
            return;
        }
        let rootAnimation: AnimeInstance | undefined;
        let asideAnimation: AnimeInstance | undefined;
        if (!openedRef.current) {
            openedRef.current = true;
            root.style.width = "0px";
            root.style.opacity = "0";
            aside.style.transform = "translateX(48px)";
        }
        void import("animejs").then(({ animate }) => {
            rootAnimation = animate(root, { width: closing ? 0 : width + 1, opacity: closing ? 0 : 1, ease: "outCubic", duration: PANEL_MOTION_MS }) as AnimeInstance;
            asideAnimation = animate(aside, {
                translateX: closing ? 28 : 0,
                ease: "outCubic",
                duration: PANEL_MOTION_MS,
                onComplete() {
                    if (closing) onCollapse();
                },
            }) as AnimeInstance;
        });
        return () => {
            rootAnimation?.cancel?.();
            rootAnimation?.pause?.();
            asideAnimation?.cancel?.();
            asideAnimation?.pause?.();
        };
    }, [closing, onCollapse, resizing, width]);

    const updateSession = (sessionId: string, updater: (session: CanvasAssistantSession) => CanvasAssistantSession) => {
        setLocalSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
    };

    const appendMessage = (sessionId: string, message: CanvasAssistantMessage) => {
        updateSession(sessionId, (session) => ({
            ...session,
            title: session.messages.length ? session.title : message.text.slice(0, 18) || "新对话",
            messages: [...session.messages, message],
            updatedAt: new Date().toISOString(),
        }));
    };

    const updateMessage = (sessionId: string, messageId: string, patch: Partial<CanvasAssistantMessage>) => {
        updateSession(sessionId, (session) => ({
            ...session,
            messages: session.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
            updatedAt: new Date().toISOString(),
        }));
    };

    const startChatSession = () => {
        if (activeSession && activeSession.messages.length === 0) {
            setLocalActiveSessionId(activeSession.id);
            return;
        }
        const session = createSession();
        setLocalSessions((prev) => [session, ...prev]);
        setLocalActiveSessionId(session.id);
    };

    const removeSessions = (ids: string[]) => {
        const next = safeSessions.filter((session) => !ids.includes(session.id));
        if (!next.length) {
            const session = createSession();
            setLocalSessions([session]);
            setLocalActiveSessionId(session.id);
        } else {
            setLocalSessions(next);
            setLocalActiveSessionId(localActiveSessionId && ids.includes(localActiveSessionId) ? next[0].id : localActiveSessionId);
        }
        cleanupImages({ sessions: next });
        setCheckedChatIds((prev) => prev.filter((id) => !ids.includes(id)));
        if (token) void batchDeleteCanvasAssistantSessions(token, workflowId, ids).catch((error) => message.error(error instanceof Error ? error.message : "删除历史失败"));
    };

    const clearSessions = () => {
        const ids = safeSessions.filter((session) => session.messages.length > 0).map((session) => session.id);
        const session = createSession();
        setLocalSessions([session]);
        setLocalActiveSessionId(session.id);
        setCheckedChatIds([]);
        cleanupImages({ sessions: [session] });
        if (token && ids.length) void batchDeleteCanvasAssistantSessions(token, workflowId, ids).catch((error) => message.error(error instanceof Error ? error.message : "清空历史失败"));
    };

    const sendMessage = async (text: string, nextMode: AssistantMode, history: CanvasAssistantMessage[], savedReferences?: CanvasAssistantReference[]) => {
        const requestConfig = { ...effectiveConfig, model: nextMode === "image" ? effectiveConfig.imageModel || effectiveConfig.model : effectiveConfig.textModel || effectiveConfig.model };
        if (nextMode === "image" && !isAiConfigReady(requestConfig, requestConfig.model)) {
            message.warning("管理员尚未配置可用模型");
            return;
        }
        if (nextMode === "ask" && !token) {
            message.warning("请先登录后使用画布助手");
            return;
        }

        const session = activeSession || createSession();
        if (!activeSession) {
            setLocalSessions([session]);
            setLocalActiveSessionId(session.id);
        }

        const refs = savedReferences || selectedReferences;
        const userMessage: CanvasAssistantMessage = { id: nanoid(), role: "user", mode: nextMode, text, references: refs };
        const assistantId = nanoid();
        appendMessage(session.id, userMessage);
        appendMessage(session.id, { id: assistantId, role: "assistant", mode: nextMode, text: nextMode === "image" ? "正在生成图片" : "正在规划画布修改", isLoading: true });
        setPrompt("");
        setIsRunning(true);

        try {
            if (nextMode === "image") {
                const referenceImages: ReferenceImage[] = await Promise.all(
                    refs.filter((item) => item.dataUrl).map(async (item) => ({ id: item.id, name: `${item.title}.png`, type: "image/png", dataUrl: await imageToDataUrl(item), storageKey: item.storageKey })),
                );
                const images = referenceImages.length ? await requestEdit(requestConfig, text, referenceImages) : await requestGeneration(requestConfig, text);
                const storedImages = await Promise.all(images.map((image) => storeGeneratedImage(image)));
                updateMessage(session.id, assistantId, {
                    text: `生成了 ${storedImages.length} 张图片`,
                    images: storedImages.map((image, index) => ({ id: images[index].id, dataUrl: image.url, storageKey: image.storageKey, prompt: text })),
                    isLoading: false,
                });
                return;
            }

            const currentSnapshot = snapshotRef.current;
            const result = await planCanvasAgent(token || "", workflowId, {
                sessionId: session.id,
                text,
                messages: sanitizeAgentMessages(history),
                references: sanitizeAgentReferences(refs),
                snapshot: sanitizeCanvasAgentSnapshot(currentSnapshot),
                preview: previewOps.length ? { ops: previewOps, snapshot: sanitizeCanvasAgentSnapshot(currentSnapshot) } : undefined,
            });
            setLocalSessions((prev) => {
                const next = prev.filter((item) => item.id !== result.session.id && item.id !== session.id);
                return [result.session, ...next];
            });
            setLocalActiveSessionId(result.session.id);
        } catch (error) {
            updateMessage(session.id, assistantId, { text: error instanceof Error ? error.message : "操作失败", isLoading: false });
        } finally {
            setIsRunning(false);
        }
    };

    const submit = async () => {
        const text = prompt.trim();
        if (!text || isRunning) return;
        await sendMessage(text, mode, messages);
    };

    const retryMessage = (message: CanvasAssistantMessage) => {
        const index = messages.findIndex((item) => item.id === message.id);
        const userIndex = messages.slice(0, index).findLastIndex((item) => item.role === "user");
        const user = messages[userIndex];
        if (user) void sendMessage(user.text, user.mode, messages.slice(0, userIndex), user.references);
    };

    const startResize = () => {
        const move = (event: MouseEvent) => setWidth(Math.min(760, Math.max(320, window.innerWidth - event.clientX)));
        const stop = () => {
            setResizing(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        };
        setResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
    };

    const collapse = () => {
        setClosing(true);
        onCollapseStart();
    };

    return (
        <div
            ref={rootRef}
            className="flex shrink-0"
            style={{ width: width + 1, opacity: 1, overflow: "clip", pointerEvents: closing ? "none" : undefined }}
        >
            <aside
                ref={asideRef}
                className="relative flex shrink-0 flex-col border-l"
                style={{ width, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            >
                <button type="button" className="absolute inset-y-0 left-0 z-40 w-4 -translate-x-1/2 cursor-col-resize" onMouseDown={startResize} aria-label="调整右侧面板宽度" />
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="size-4" />
                        {view === "history" ? "历史记录" : "画布助手"}
                    </div>
                    <div className="flex items-center gap-1">
                        {view === "history" ? (
                            <>
                                <Tooltip title="删除选中">
                                    <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<Trash2 className="size-4" />} disabled={!checkedChatIds.length} onClick={() => setDeleteChatIds(checkedChatIds)} />
                                </Tooltip>
                                <Tooltip title="删除全部">
                                    <Button
                                        type="text"
                                        shape="circle"
                                        className="!h-8 !w-8 !min-w-8"
                                        style={iconButtonStyle}
                                        icon={<X className="size-4" />}
                                        disabled={!historySessions.length}
                                        onClick={() => setDeleteChatIds(historySessions.map((session) => session.id))}
                                    />
                                </Tooltip>
                            </>
                        ) : null}
                        <Tooltip title={view === "history" ? "返回对话" : "历史记录"}>
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<History className="size-4" />} onClick={() => setView(view === "history" ? "chat" : "history")} />
                        </Tooltip>
                        <Tooltip title="新对话">
                            <Button
                                type="text"
                                shape="circle"
                                className="!h-8 !w-8 !min-w-8"
                                style={iconButtonStyle}
                                icon={<Plus className="size-4" />}
                                disabled={!hasMessages}
                                onClick={() => {
                                    startChatSession();
                                    setView("chat");
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="收起对话">
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<PanelRightClose className="size-4" />} onClick={collapse} />
                        </Tooltip>
                    </div>
                </div>

                <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    {view === "history" ? (
                        <AssistantHistory
                            sessions={historySessions}
                            activeSession={activeSession}
                            checkedIds={checkedChatIds.filter((id) => historySessions.some((session) => session.id === id))}
                            onToggleChecked={(id, checked) => setCheckedChatIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)))}
                            onOpen={(id) => {
                                setLocalActiveSessionId(id);
                                setView("chat");
                            }}
                            onDelete={(id) => setDeleteChatIds([id])}
                        />
                    ) : messages.length ? (
                        <AssistantMessages messages={messages} onRetry={retryMessage} onPreviewOps={onPreviewOps} onInsertImage={onInsertImage} onInsertText={onInsertText} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                            <div className="relative font-serif text-4xl font-bold italic tracking-normal" style={{ color: theme.node.text }}>
                                <span>Infinite Canvas</span>
                                <DiaTextReveal className="absolute inset-0" colors={["#A97CF8", "#F38CB8", "#FDCC92"]} textColor="transparent" duration={1.8} startOnView={false} text="Infinite Canvas" />
                            </div>
                            <div className="mt-3 font-serif text-base italic tracking-wide opacity-60">One canvas, infinite ideas</div>
                        </div>
                    )}
                </div>

                {view === "chat" ? (
                    <>
                    {previewOps.length ? (
                        <div className="mx-3 mb-2 rounded-xl border px-3 py-2 text-xs leading-5" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">正在预览：{summarizeCanvasAgentOps(previewOps)}</span>
                                <div className="flex shrink-0 gap-1">
                                    <Button size="small" onClick={onCancelPreview}>取消</Button>
                                    <Button size="small" type="primary" onClick={onConfirmPreview}>确认</Button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <AssistantComposer
                        mode={mode}
                        prompt={prompt}
                        isRunning={isRunning}
                        references={selectedReferences}
                        config={effectiveConfig}
                        onModeChange={setMode}
                        onPromptChange={setPrompt}
                        onSubmit={submit}
                        onConfigChange={updateConfig}
                        onMissingConfig={() => message.warning("管理员尚未配置可用模型")}
                        onRemoveReference={(id) => {
                            setRemovedReferenceIds((prev) => new Set(prev).add(id));
                            if (selectedNodeIds.has(id)) onSelectNodeIds(new Set(Array.from(selectedNodeIds).filter((nodeId) => nodeId !== id)));
                        }}
                        onPasteImage={onPasteImage}
                        previewing={previewOps.length > 0}
                        modelCosts={modelCosts}
                    />
                    </>
                ) : null}

                <Modal
                    title="删除对话记录？"
                    open={deleteChatIds.length > 0}
                    centered
                    onCancel={() => setDeleteChatIds([])}
                    footer={
                        <>
                            <Button onClick={() => setDeleteChatIds([])}>取消</Button>
                            <Button
                                danger
                                type="primary"
                                onClick={() => {
                                    deleteChatIds.length === historySessions.length ? clearSessions() : removeSessions(deleteChatIds);
                                    setDeleteChatIds([]);
                                }}
                            >
                                删除
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">将删除 {deleteChatIds.length} 条对话记录，此操作不可撤销。</p>
                </Modal>
            </aside>
        </div>
    );
}

function AssistantComposer({
    mode,
    prompt,
    isRunning,
    references,
    config,
    onModeChange,
    onPromptChange,
    onSubmit,
    onConfigChange,
    onMissingConfig,
    onRemoveReference,
    onPasteImage,
    previewing,
    modelCosts,
}: {
    mode: AssistantMode;
    prompt: string;
    isRunning: boolean;
    references: CanvasAssistantReference[];
    config: AiConfig;
    onModeChange: (mode: AssistantMode) => void;
    onPromptChange: (prompt: string) => void;
    onSubmit: () => void;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    onMissingConfig: () => void;
    onRemoveReference: (id: string) => void;
    onPasteImage: (file: File) => void;
    previewing?: boolean;
    modelCosts?: { model: string; credits: number }[];
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const activeModel = mode === "image" ? config.imageModel || config.model : "";
    const credits = requestCreditCost({ modelCosts, model: activeModel, count: mode === "image" ? config.count : 1 });

    return (
        <div className="px-2 pb-2" onWheelCapture={(event) => event.stopPropagation()}>
            {references.length ? (
                <div className="thin-scrollbar mb-1.5 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
                    {references.map((item) => (
                        <AssistantReferenceChip key={item.id} item={item} onRemove={() => onRemoveReference(item.id)} />
                    ))}
                </div>
            ) : null}
            <div className="rounded-[28px] border px-3 pb-3 pt-3 shadow-lg" style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}>
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    onPaste={(event) => {
                        const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
                        if (!file) return;
                        event.preventDefault();
                        onPasteImage(file);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey) return;
                        event.preventDefault();
                        void onSubmit();
                    }}
                    className="thin-scrollbar h-20 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:text-stone-400"
                    style={{ color: theme.node.text }}
                    placeholder={mode === "image" ? "描述你想生成或修改的图片" : previewing ? "告诉 AI 哪里需要调整" : "描述你想让 AI 如何操作画布"}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="canvas-composer-tools flex min-w-0 flex-1 items-center gap-1">
                        <CanvasPromptLibrary onSelect={onPromptChange} />
                        <AssistantModeSwitch mode={mode} theme={theme} onChange={onModeChange} />
                        {mode === "image" ? (
                            <>
                                <ModelPicker className="h-8 shrink-0" config={config} value={config.imageModel || config.model} onChange={(model) => onConfigChange("imageModel", model)} onMissingConfig={onMissingConfig} />
                                <CanvasImageSettingsPopover config={config} placement="topRight" getPopupContainer={() => document.body} buttonClassName="canvas-composer-settings canvas-composer-icon !h-8 !min-w-8 !rounded-full !px-2" onConfigChange={onConfigChange} onMissingConfig={onMissingConfig} />
                            </>
                        ) : null}
                    </div>
                    <Button
                        type="primary"
                        className="!h-10 !min-w-16 shrink-0 !rounded-full !px-3"
                        disabled={isRunning || !prompt.trim()}
                        onClick={() => void onSubmit()}
                        aria-label="发送"
                    >
                        <span className="flex items-center gap-1.5">
                            {mode === "image" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                                    <CreditSymbol />
                                    {credits.toLocaleString()}
                                </span>
                            ) : null}
                            {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                        </span>
                    </Button>
                </div>
            </div>
        </div>
    );
}

function AssistantModeSwitch({ mode, theme, onChange }: { mode: AssistantMode; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onChange: (mode: AssistantMode) => void }) {
    return (
        <div className="canvas-composer-mode-switch flex h-8 shrink-0 items-center rounded-full p-0.5" style={{ background: theme.node.fill }}>
            {[
                { value: "ask" as const, title: "画布助手", icon: <MessageSquare className="size-4" /> },
                { value: "image" as const, title: "生图", icon: <ImageIcon className="size-4" /> },
            ].map((item) => (
                <Tooltip key={item.value} title={item.title}>
                    <button
                        type="button"
                        className="canvas-composer-mode-button flex h-7 cursor-pointer items-center justify-center gap-1 rounded-full border-0 bg-transparent transition"
                        style={{ background: mode === item.value ? theme.node.activeStroke : "transparent", color: mode === item.value ? theme.node.panel : theme.node.text }}
                        onClick={() => onChange(item.value)}
                        aria-label={item.title}
                    >
                        {item.icon}
                        <span>{item.title}</span>
                    </button>
                </Tooltip>
            ))}
        </div>
    );
}

function SettingTitle({ children, color }: { children: string; color: string }) {
    return (
        <div className="text-xs font-medium" style={{ color }}>
            {children}
        </div>
    );
}

function qualityLabel(value: string) {
    return ({ auto: "自动", high: "高", medium: "中", low: "低" } as Record<string, string>)[value] || value;
}

function AssistantMessages({
    messages,
    onRetry,
    onPreviewOps,
    onInsertImage,
    onInsertText,
}: {
    messages: CanvasAssistantMessage[];
    onRetry: (message: CanvasAssistantMessage) => void;
    onPreviewOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot | null;
    onInsertImage: (image: CanvasAssistantImage) => void;
    onInsertText: (text: string) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            {messages.map((message) => (
                <div key={message.id} className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}>
                    <div
                        className="max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6"
                        style={message.role === "user" ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { background: theme.node.fill, color: theme.node.text }}
                    >
                        {message.role === "assistant" ? (
                            <div className="mb-1 flex items-center gap-1.5 text-xs opacity-60">
                                <MessageSquare className="size-3.5" />
                                回答
                            </div>
                        ) : null}
                        {message.text}
                    </div>
                    {message.references?.length ? <MessageReferences message={message} /> : null}
                    {message.isLoading ? <ImageGenerationPending compact label={message.mode === "image" ? "正在生成图片" : "正在规划画布修改"} className="w-[250px] rounded-2xl border" /> : null}
                    {message.role === "assistant" && !message.isLoading ? (
                        <div className="flex gap-1">
                            <Button shape="circle" size="small" style={{ borderColor: theme.node.stroke }} icon={<RotateCcw className="size-3.5" />} onClick={() => onRetry(message)} title="重试" />
                            {message.agentOps?.length ? <Button size="small" style={{ borderColor: theme.node.stroke }} icon={<Eye className="size-3.5" />} onClick={() => onPreviewOps(message.agentOps || [])}>预览修改</Button> : null}
                            {!message.images?.length && !message.agentOps?.length ? <Button shape="circle" size="small" style={{ borderColor: theme.node.stroke }} icon={<Plus className="size-3.5" />} onClick={() => onInsertText(message.text)} title="插入画布" /> : null}
                        </div>
                    ) : null}
                    {message.agentOps?.length ? (
                        <div className="max-w-[88%] rounded-xl border px-3 py-2 text-xs leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                            <div>{summarizeCanvasAgentOps(message.agentOps)}</div>
                            {message.agentUsage ? <div className="opacity-70">Token {message.agentUsage.totalTokens}，消耗 {message.agentUsage.credits} 算力点{message.agentUsage.estimated ? "（估算）" : ""}</div> : null}
                        </div>
                    ) : null}
                    {message.images?.map((image) => (
                        <div key={image.id} className="w-[250px] overflow-hidden rounded-2xl border" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                            <img src={image.dataUrl} alt="" className="aspect-square w-full object-cover" />
                            <Button
                                type="text"
                                className="!h-8 !w-full !rounded-none"
                                style={{ borderTop: `1px solid ${theme.node.stroke}`, color: theme.node.text }}
                                icon={<Plus className="size-3.5" />}
                                onClick={() => onInsertImage(image)}
                                title="插入画布"
                            />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function AssistantHistory({
    sessions,
    activeSession,
    checkedIds,
    onToggleChecked,
    onOpen,
    onDelete,
}: {
    sessions: CanvasAssistantSession[];
    activeSession: CanvasAssistantSession | null;
    checkedIds: string[];
    onToggleChecked: (id: string, checked: boolean) => void;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div className="space-y-1">
            {sessions.map((session) => (
                <div key={session.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-black/5 dark:hover:bg-white/10" style={session.id === activeSession?.id ? { background: theme.node.fill } : undefined}>
                    <input type="checkbox" className="size-4 accent-stone-950" checked={checkedIds.includes(session.id)} onChange={(event) => onToggleChecked(session.id, event.target.checked)} />
                    <button type="button" className="min-w-0 flex-1 text-left text-sm" onClick={() => onOpen(session.id)}>
                        <span className="block truncate">{session.title}</span>
                        <span className="text-xs opacity-50">{session.messages.length} 条消息</span>
                    </button>
                    <Button type="text" shape="circle" size="small" className="opacity-0 transition group-hover:opacity-100" icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(session.id)} title="删除" />
                </div>
            ))}
        </div>
    );
}

function MessageReferences({ message }: { message: CanvasAssistantMessage }) {
    return (
        <div className={cn("flex max-w-[88%] flex-wrap gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.references?.map((item) => (
                <AssistantReferenceChip key={item.id} item={item} />
            ))}
        </div>
    );
}

function AssistantReferenceChip({ item, onRemove }: { item: CanvasAssistantReference; onRemove?: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const text = (item.text || item.title).replace(/\s+/g, " ").trim().slice(0, 1) || "文";
    return (
        <div className="group/chip relative inline-flex h-8 max-w-[150px] shrink-0 items-center gap-1.5 rounded-lg text-sm" style={{ color: theme.node.text }}>
            {item.dataUrl ? (
                <img src={item.dataUrl} alt="" className="size-8 rounded-lg object-cover" />
            ) : (
                <span className="grid size-8 place-items-center rounded-lg border text-sm font-medium" style={{ background: theme.node.panel, borderColor: theme.node.activeStroke }}>
                    {text}
                </span>
            )}
            {onRemove ? (
                <button
                    type="button"
                    className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border opacity-0 shadow-sm transition group-hover/chip:opacity-100"
                    style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}
                    onClick={onRemove}
                    aria-label="移除引用"
                >
                    <X className="size-3" />
                </button>
            ) : null}
        </div>
    );
}

function nodeToReference(node: CanvasNodeData): CanvasAssistantReference | null {
    if (node.type === CanvasNodeType.Image && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
    }
    if (node.type === CanvasNodeType.Text && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, text: node.metadata.content };
    }
    return null;
}

function buildAssistantReferences(nodes: CanvasNodeData[], selectedNodeIds: Set<string>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(selectedNodeIds)
        .map((id) => nodeById.get(id))
        .filter((node): node is CanvasNodeData => Boolean(node))
        .map(nodeToReference)
        .filter((item): item is CanvasAssistantReference => Boolean(item));
}

function sanitizeAgentMessages(messages: CanvasAssistantMessage[]): CanvasAssistantMessage[] {
    return messages
        .filter((item) => !item.isLoading && item.text.trim())
        .slice(-20)
        .map((item) => ({
            id: item.id,
            role: item.role,
            mode: item.mode,
            text: limitText(item.text, 4000),
            references: sanitizeAgentReferences(item.references || []),
            agentOps: item.agentOps?.slice(-20),
        }));
}

function sanitizeAgentReferences(references: CanvasAssistantReference[]) {
    return references.slice(0, 8).map((item) => ({
        id: item.id,
        type: item.type,
        title: limitText(item.title, 80),
        text: limitText(item.text, 1000) || undefined,
    }));
}

function limitText(value: string | undefined, limit: number) {
    const text = (value || "").trim();
    return text.length > limit ? text.slice(0, limit) : text;
}

function createSession(): CanvasAssistantSession {
    const now = new Date().toISOString();
    return { id: nanoid(), title: "新对话", messages: [], createdAt: now, updatedAt: now };
}
