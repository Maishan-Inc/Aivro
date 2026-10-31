export const exampleRequests = [
    { id: "images", title: "商品图片", method: "POST", path: "/images/generations", body: { model: "AVAILABLE_IMAGE_MODEL", prompt: "An amber perfume bottle with an ivory cap on travertine, soft sunlight, product photography", n: 1, size: "1024x1024" } },
    { id: "chat", title: "对话生成", method: "POST", path: "/chat/completions", body: { model: "AVAILABLE_CHAT_MODEL", messages: [{ role: "user", content: "Write three cinematic shot descriptions for a lunar outpost." }], max_tokens: 512, stream: false } },
    { id: "model3d", title: "游戏道具", method: "POST", path: "/model-3d/generations", body: { model: "AVAILABLE_3D_MODEL", mode: "text", prompt: "A bronze celestial lantern with a turquoise crystal, game prop", quantity: 1, meshQuality: "standard", textureEnabled: true, pbrEnabled: true } },
    { id: "videos", title: "视频生成", method: "POST", path: "/videos", body: { model: "AVAILABLE_VIDEO_MODEL", prompt: "Slow camera push-in towards a lunar observatory in a red canyon, drifting dust, cinematic light", seconds: "6", resolution_name: "720p", billingType: "fixed" } },
    { id: "models", title: "查询模型", method: "GET", path: "/models" },
    { id: "video-status", title: "视频进度", method: "GET", path: "/videos/VIDEO_ID" },
    { id: "tasks", title: "任务进度", method: "GET", path: "/generation-tasks/TASK_ID" },
    { id: "task-result", title: "任务结果", method: "GET", path: "/generation-tasks/TASK_ID/result" },
    { id: "task-cancel", title: "取消任务", method: "DELETE", path: "/generation-tasks/TASK_ID" },
] as const;

export type ExampleRequest = (typeof exampleRequests)[number];

// 只翻译明确标记的注释，保留请求值和代码语法。
export function localizeExampleCode(code: string, tr: (value: string) => string) {
    return code.replace(/\{\{注释:([^{}]+)\}\}/g, (_, source: string) => tr(source));
}
