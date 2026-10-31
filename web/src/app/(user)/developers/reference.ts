type Parameter = [string, string, string, string];
type Endpoint = { id: string; title: string; method: string; path: string; description: string; params: Parameter[]; code: string; response?: string; note: string };
const jsonRequest = (path: string, body: unknown) => `curl "$AIVRO_BASE_URL${path}" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '${JSON.stringify(body, null, 2)}'`;
const getRequest = (path: string) => `curl "$AIVRO_BASE_URL${path}" \\
  -H "Authorization: Bearer $AIVRO_API_KEY"`;

export const endpoints: Endpoint[] = [
    {
        id: "models", title: "查询可用模型", method: "GET", path: "/models",
        description: "获取已开放并已配置计费的模型。返回的模型名称可直接填入生成请求的 model 字段。",
        params: [], code: getRequest("/models"),
        response: JSON.stringify({ code: 0, data: [{ id: "AVAILABLE_CHAT_MODEL", type: "text", credits: 2, billingType: "token" }, { id: "AVAILABLE_VIDEO_MODEL", type: "video", credits: 12, billingType: "fixed", videoPrices: { fixed: 12, second: 3 } }], msg: "ok" }, null, 2),
        note: "type 为 text（对话）、image（图片）、video（视频）或 model3d（3D）。credits 是 API 单价；billingType 为 fixed（按次）或 token（每千个词元）。示例价格仅用于解释字段，实际值以接口和模型定价表为准。" + " " + "视频模型的 videoPrices.fixed 为每次 API 价格，videoPrices.second 为每秒 API 价格；未提供 second 表示未开放按秒计费。",
    },
    {
        id: "chat", title: "生成对话", method: "POST", path: "/chat/completions",
        description: "发送消息并获取模型回复。普通响应直接返回对话 JSON；流式请求返回服务器发送事件。",
        params: [
            ["model", "字符串", "必填", "已开放的对话模型名称"],
            ["messages", "数组", "必填", "消息列表，每项包含 role（角色）和 content（内容）"],
            ["stream", "布尔值", "选填", "是否流式返回，默认 false"],
            ["max_tokens", "整数", "选填", "最大输出词元数，默认 4096，范围 1–32768"],
            ["max_completion_tokens", "整数", "选填", "部分模型使用此字段；同时提供时优先使用此字段"],
            ["n", "整数", "选填", "本站对话每次只支持一条回复，固定为 1"],
            ["temperature", "数字", "选填", "采样参数，支持范围由所选模型决定"],
        ],
        code: jsonRequest("/chat/completions", { model: "AVAILABLE_CHAT_MODEL", messages: [{ role: "user", content: "Introduce yourself briefly." }], max_tokens: 512, stream: false }),
        response: JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: "Hello! I can answer questions and help you create." }, finish_reason: "stop" }], usage: { prompt_tokens: 18, completion_tokens: 25, total_tokens: 43 } }, null, 2),
        note: "示例展示常用字段，具体模型可能包含其他字段。role 通常使用 system（系统指令）、user（用户消息）和 assistant（助手回复）。stream 为 true 时服务端会请求上游提供用量信息；流开始后的连接错误需要客户端自行处理。",
    },
    {
        id: "images", title: "生成图片", method: "POST", path: "/images/generations",
        description: "使用文字描述生成图片，请求体使用 JSON。繁忙时可能先返回排队任务信息。",
        params: [
            ["model", "字符串", "必填", "已开放的图片模型名称"],
            ["prompt", "字符串", "必填", "图片内容描述"],
            ["n", "整数", "选填", "生成张数，默认 1，范围 1–10；所选模型可能有更小限制"],
            ["size", "字符串", "选填", "图片尺寸，例如 1024x1024，支持值取决于模型"],
            ["quality", "字符串", "选填", "图片质量，支持值取决于模型"],
            ["response_format", "字符串", "选填", "部分模型支持 url 或 b64_json，本站可能转存为文件地址"],
        ],
        code: jsonRequest("/images/generations", { model: "AVAILABLE_IMAGE_MODEL", prompt: "A mountain cabin in morning light, realistic photography", n: 1, size: "1024x1024" }),
        response: JSON.stringify({ data: [{ url: "/api/files/FILE_ID/content?accessToken=ACCESS_TOKEN" }] }, null, 2),
        note: "直接成功时通常从 data 数组读取图片 url 或 b64_json。如果返回 code: 0 且 data.queued: true，请按异步任务说明轮询。文件地址、额外字段和输出形式依所选模型及存储配置而定。",
    },
    {
        id: "edits", title: "编辑图片", method: "POST", path: "/images/edits",
        description: "上传参考图片并描述修改要求，请求体使用 multipart/form-data。",
        params: [
            ["model", "文本字段", "必填", "支持图片编辑的已开放模型"],
            ["prompt", "文本字段", "必填", "图片修改要求"],
            ["image", "文件字段", "必填", "参考图片；模型支持多图时可重复提交此字段"],
            ["n", "文本字段", "选填", "整数 1–10，默认 1；同一请求只提交一次"],
            ["size / quality", "文本字段", "选填", "尺寸与质量，支持值取决于模型"],
        ],
        code: `curl "$AIVRO_BASE_URL/images/edits" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -F 'model=AVAILABLE_IMAGE_MODEL' \\
  -F 'prompt=Keep the subject and replace the background with a spring garden' \\
  -F 'n=1' \\
  -F 'image=@./reference.png'`,
        note: "让 HTTP 客户端自动生成 multipart 边界，不要手动设置 Content-Type。响应和排队处理与图片生成相同，文件格式与参考图数量依模型而定。",
    },
    {
        id: "videos", title: "创建视频", method: "POST", path: "/videos",
        description: "提交视频生成任务，支持 JSON 或 multipart/form-data，统一返回 data.taskId；后台完成生成、查询和文件转存。",
        params: [
            ["model", "文本字段", "必填", "已开放的视频模型名称"],
            ["prompt", "文本字段", "必填", "视频场景、动作与镜头描述"],
            ["billingType", "字符串", "选填", "fixed 按次，second 按秒；未传默认 fixed，单价由后台读取"],
            ["seconds", "整数或数字字符串", "条件必填", "按秒计费必须传入正整数秒数；按次省略时使用模型默认时长"],
            ["size", "文本字段", "选填", "画面比例，例如 16:9；支持值由模型能力决定"],
            ["resolution_name", "文本字段", "选填", "清晰度，例如 720p，实际支持值由模型决定"],
            ["input_reference[]", "文件字段", "选填", "multipart 参考图片，每张最大 10 MiB，数量由模型决定"],
            ["images", "数组", "选填", "JSON 参考图片，每项包含 url，可附带本站 storageKey"],
        ],
        code: `curl "$AIVRO_BASE_URL/videos" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -F 'model=AVAILABLE_VIDEO_MODEL' \\
  -F 'prompt=Slow camera push-in through a mountain forest in morning mist' \\
  -F 'billingType=fixed' \\
  -F 'seconds=6' \\
  -F 'resolution_name=720p'`,
        note: "使用 data.taskId 查询 /videos/{id} 或 /generation-tasks/{id}，成功后读取 /generation-tasks/{id}/result 或下载 /videos/{id}/content。费用、单价、计费方式和请求秒数随任务保存；不接受客户端单价或 duration、n、preset 等额外字段。" + " " + "通过 GET /api/settings 的 modelChannel.videoCapabilities 查询 durations、resolutions、aspectRatios、minImages 和 maxImages。部分图生视频比例跟随参考图；Veo 高清仅 8 秒，海螺 1080p 仅 6 秒。",
    },
    {
        id: "video-status", title: "查询视频进度", method: "GET", path: "/videos/{id}",
        description: "查询属于当前账号的视频生成状态。路径参数 id 使用创建响应的 data.taskId。",
        params: [["id", "路径参数", "必填", "本站视频编号"]],
        code: getRequest("/videos/VIDEO_ID"),
        note: "返回本站统一任务状态：queued、executing、succeeded、failed、canceled；同时返回 billingType、seconds、unitCredits 和 credits。succeeded 表示视频已经转存。",
    },
    {
        id: "video-content", title: "获取视频内容", method: "GET", path: "/videos/{id}/content",
        description: "在视频生成并转存完成后获取视频文件。成功返回文件流，失败返回业务错误 JSON。",
        params: [["id", "路径参数", "必填", "本站视频编号"]],
        code: `curl "$AIVRO_BASE_URL/videos/VIDEO_ID/content" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -D response-headers.txt -o video-response.bin`,
        note: "先检查 Content-Type 和业务错误，勿把错误 JSON 当成 MP4 文件。视频文件过期后无法下载。",
    },
    {
        id: "model3d", title: "生成 3D 模型", method: "POST", path: "/model-3d/generations",
        description: "通过文字或参考图片生成 3D 模型，请求体使用 JSON。接口返回模型文件结果或本站任务编号。" + " " + "模式、图片数量、质量和面数范围以 GET /api/settings 返回的 modelChannel.model3DCapabilities 为准；专用适配每次生成一个模型。" + " " + "选择 GPT.GE 单图适配的模型仅接受 mode=image、单张参考图、quantity=1、pbrEnabled=false；不支持自定义目标面数，prompt 仅用于记录。",
        params: [
            ["model", "字符串", "必填", "已开放的 3D 模型名称"],
            ["mode", "字符串", "必填", "text（文字）、image（单图）或 multi_image（多图）"],
            ["prompt", "字符串", "条件必填", "文字模式必须提供描述"],
            ["images", "数组", "条件必填", "图片模式必须提供参考图，每项包含 name、type、url，可带 storageKey"],
            ["quantity", "整数", "选填", "默认 1；专用适配仅支持 1，通用接口支持 1–4"],
            ["meshQuality", "字符串", "选填", "standard（标准）、high（高）或 ultra（超高）"],
            ["textureEnabled / pbrEnabled", "布尔值", "选填", "是否启用贴图与物理材质"],
            ["targetFaceCount", "整数", "选填", "目标面数，省略时采用当前模型默认值；范围由模型能力决定"],
        ],
        code: jsonRequest("/model-3d/generations", { model: "AVAILABLE_3D_MODEL", mode: "text", prompt: "A cute rounded ceramic kitten", quantity: 1, meshQuality: "standard", textureEnabled: false, pbrEnabled: false }),
        response: JSON.stringify({ code: 0, data: { id: "GENERATION_ID", status: "completed", energyCost: 10, results: [{ url: "/api/files/MODEL_FILE_ID/content?accessToken=ACCESS_TOKEN", mimeType: "model/gltf-binary" }] }, msg: "ok" }, null, 2),
        note: "从 data.results 读取模型文件地址，data.energyCost 为实际算力点。按次计费还会按数量、网格质量、贴图、物理材质和面数增加费用。若 data.queued 为 true，使用 data.taskId 查询本站生成队列，成功后读取任务结果；也可通过 GET /model-3d/generations/{id} 查询进度和结果。" + " " + "多视图按 referenceViews 顺序提交，只能省略末尾视图。TRELLIS.2 要求 textureEnabled=true、pbrEnabled=false；不支持目标面数。Meshy 的图片描述用于纹理，其余专用适配的图片描述仅用于记录。",
    },
    {
        id: "files", title: "上传参考文件", method: "POST", path: "/files",
        description: "上传当前账号的参考素材，请求体使用 multipart/form-data。返回文件地址和存储标识。",
        params: [["file", "文件字段", "必填", "单个文件，最大 50 MiB，支持类型由本站上传规则决定"]],
        code: `curl "$AIVRO_BASE_URL/files" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -F 'file=@./reference.png'`,
        response: JSON.stringify({ code: 0, data: { url: "/api/files/FILE_ID/content?accessToken=ACCESS_TOKEN", storageKey: "cloud:FILE_ID", cloudFileId: "FILE_ID", mimeType: "image/png" }, msg: "ok" }, null, 2),
        note: "参考 3D 图片时可将 data.url 和 data.storageKey 放入 images 数组。上传受账号容量和限流约束，临时文件可能过期，请及时下载或使用。",
    },
    {
        id: "tasks", title: "查询生成队列", method: "GET", path: "/generation-tasks/{id}",
        description: "查询当前账号的本站生成队列任务。路径中的 id 使用排队响应 data.taskId。",
        params: [["id", "路径参数", "必填", "本站生成队列任务编号"]],
        code: getRequest("/generation-tasks/TASK_ID"),
        response: JSON.stringify({ code: 0, data: { id: "TASK_ID", status: "succeeded", queuePosition: 0, aheadCount: 0, credits: 10, resultAvailable: true, error: "" }, msg: "ok" }, null, 2),
        note: "可使用 GET /generation-tasks 查看当前账号最近的任务。任务状态为 queued（排队中）、executing（执行中）、succeeded（成功）、failed（失败）或 canceled（已取消）。",
    },
    {
        id: "task-result", title: "获取队列结果", method: "GET", path: "/generation-tasks/{id}/result",
        description: "任务成功且 resultAvailable 为 true 后读取原始生成结果。响应形式沿用对应生成接口。",
        params: [["id", "路径参数", "必填", "本站生成队列任务编号"]], code: getRequest("/generation-tasks/TASK_ID/result"),
        note: "图片结果读取 data 数组；视频结果读取 file，并包含 id、billingType、seconds、unitCredits、energyCost。任务未完成、结果已过期或不属于当前账号时返回业务错误。",
    },
    {
        id: "task-cancel", title: "取消排队任务", method: "DELETE", path: "/generation-tasks/{id}",
        description: "取消尚未开始执行的本站排队任务，并返还预扣算力点。",
        params: [["id", "路径参数", "必填", "本站生成队列任务编号"]],
        code: `curl -X DELETE "$AIVRO_BASE_URL/generation-tasks/TASK_ID" \\
  -H "Authorization: Bearer $AIVRO_API_KEY"`,
        response: JSON.stringify({ code: 0, data: true, msg: "ok" }, null, 2),
        note: "执行中的任务无法通过此接口取消。撤销 API 密钥也不会取消已经提交的任务。",
    },
];

export const queueExample = `import os
import time
import requests

base = os.environ["AIVRO_BASE_URL"].rstrip("/")
session = requests.Session()
session.headers["Authorization"] = "Bearer " + os.environ["AIVRO_API_KEY"]

def read_json(response):
    response.raise_for_status()
    result = response.json()
    if result.get("code", 0) != 0:
        raise RuntimeError(result.get("msg", response.text))
    return result

# {{注释:将 AIVRO_IMAGE_MODEL 设置为已开放的图片模型。}}
result = read_json(session.post(base + "/images/generations", json={
    "model": os.environ["AIVRO_IMAGE_MODEL"],
    "prompt": "A mountain cabin in morning light, realistic photography", "n": 1,
}, timeout=300))

data = result.get("data")
if isinstance(data, dict) and data.get("queued"):
    task_id = data["taskId"]
    print("taskId:", task_id)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        task = read_json(session.get(base + "/generation-tasks/" + task_id, timeout=30))["data"]
        if task["status"] == "succeeded" and task["resultAvailable"]:
            result = read_json(session.get(base + "/generation-tasks/" + task_id + "/result", timeout=300))
            break
        if task["status"] in ("failed", "canceled"):
            raise RuntimeError(task.get("error") or task["status"])
        time.sleep(3)
    else:
        # {{注释:超时仅停止本地等待，请保留编号继续查询，不要重新提交。}}
        raise TimeoutError(task_id)

print(result)
session.close()`;
