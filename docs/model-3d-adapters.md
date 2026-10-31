# 3D API 适配配置

以下为已实现、待真实账号联调的接口范围。后台进入“系统设置 → 渠道可用模型”，先选 `3D` 类型，再选适配方式。留空使用现有通用 JSON 接口，不根据模型名自动识别。各家使用独立渠道地址与 API Key；前台模型名可自定义，上游模型名必须与下表一致，并在公开 3D 模型清单中开放、设置价格。

工作台仅选择已开放且渠道类型为 3D 的模型；没有可用模型时保持空选择，不使用其他类型的默认模型。

## 模型与地址

| 适配标识 | 渠道基础地址 | 支持的上游模型名 | 已接入的输入 |
| --- | --- | --- | --- |
| 空字符串（通用） | 管理员现有兼容渠道 | 渠道提供的名称 | 现有文字、单图、多图 JSON 协议 |
| `hunyuan3d` | `https://api.gpt.ge` | `Hunyuan3D-2`、`Hi3DGen`、`Step1X-3D` | 单图 |
| `meshy` | `https://api.meshy.ai` | `meshy-7.1`、`latest`、`meshy-6`、`meshy-6-lite` | 文字、单图、多图（最多 4 张） |
| `meshy` | 同上 | `meshy-t2`、`meshy-t2.5` | 文字、单图；Smart Topology |
| `tripo` | `https://api.tripo3d.ai` | `v3.1-20260211`、`v3.0-20250812`、`P1-20260311` | 文字、单图、多图（2–4 张） |
| `rodin` | `https://api.hyper3d.com` | `Gen-2.5-Extreme-Low`、`Gen-2.5-Low`、`Gen-2.5-Medium`、`Gen-2.5-High`、`Gen-2.5-Extreme-High` | 文字、单图、多图（最多 5 张） |
| `fal-hunyuan3d` | `https://queue.fal.run` | `fal-ai/hunyuan-3d/v3.1/pro` | 文字、单图、多视图（最多 8 张） |
| `fal-trellis` | `https://queue.fal.run` | `fal-ai/trellis-2` | 单图 |

这些是本次查阅官方文档确认的版本，不表示各平台全部模型与功能均已接入。Meshy 文档中 `latest` 当前指向 7.1，固定版本便于控制行为；新版本或高质量档位可能要求账号额外开通权限。Rodin 必须填写完整 Gen-2.5 档位，避免缺少 `tier` 时上游退回 Gen-1/1.5。Tripo 显式传所选版本，避免采用较旧的上游默认值。

没有 `/v1/models` 的供应商可在后台手动新增模型映射。后台现有“模型测试”只处理图片与对话，3D 需在工作台联调。fal 混元填写基础模型名，不附 `/text-to-3d` 或 `/image-to-3d`，后端按输入模式选择；鉴权使用 `Key`，其余专用适配使用 `Bearer`。此处混元 3.1 为 fal 托管接口，未接入腾讯云原生 TC3 签名接口或 Rapid 模型。

## 输入与参数

所有专用适配一次只生成一个模型，本站请求仍使用 `/api/v1/model-3d/generations` 的 JSON。图片先通过本站文件上传接口上传，`images` 使用当前账号可访问的 `url`、`storageKey` 引用；读取、转换及渠道鉴权均在后端完成。

| 适配/模型 | 网格质量映射 | 目标面数 | 纹理与 PBR |
| --- | --- | --- | --- |
| GPT.GE | 标准/高/超高：迭代 5/20/50，分辨率 128/256/400 | 不支持自定义 | 纹理可选；无独立 PBR 开关 |
| Meshy 7.1 / latest | 标准或高（`geometry_resolution=2k`） | 100–300000，默认 30000 | 可选；文本先生成形状，再按需创建 refine 纹理任务 |
| Meshy 6 / 6-lite | 标准 | 100–300000，默认 30000 | 可选 |
| Meshy t2 / t2.5 | 标准 | t2：100–15000，默认 4000；t2.5：100–30000，默认 15000 | 可选 |
| Tripo 3.1 / 3.0 | 标准/超高分别为 `standard` / `detailed` | 本站开放 1000–1000000，默认 500000 | 可选；PBR 只在纹理开启时启用 |
| Tripo P1 | 标准，不传 `geometry_quality` | 48–20000，本站默认 4000 | 可选 |
| Rodin Gen-2.5 | 标准；档位由上游模型名指定 | 500–1000000；High / Extreme-High 上限 2000000；默认 500000 | 关闭/纹理/PBR 分别映射 `None` / `Shaded` / `PBR` |
| fal 混元 3.1 Pro | 标准 | 40000–1500000，默认 500000 | 纹理可选，关闭时用 `generate_type=Geometry`；PBR 只在纹理开启时启用 |
| fal TRELLIS.2 | 标准/高/超高：`resolution=512/1024/1536` | 不支持；`decimation_target` 是顶点数，未作为面数使用 | 固定生成纹理，无独立纹理/PBR 开关 |

不支持目标面数的适配使用站内中性值 500000，不向上游传此参数，不产生面数加价；TRELLIS.2 请求要求 `textureEnabled=true`、`pbrEnabled=false`。费用仍按站内模型价格与已有参数倍率计算，不代表供应商实际账单。各家纹理、视图、高质量等上游收费不同，需由管理员据此配置站内单价。

新适配接受 PNG/JPEG/WebP，本站上限为每张 10 MiB；fal 混元通过 data URI 提交，上限为每张 6 MiB。GPT.GE 沿用本站原有图片上传限制。文字描述 Meshy 最多 800 字符，其余支持文本的适配最多 1024 字符。图片模式仅 Meshy 在开启纹理时将描述作为 `texture_prompt`；其他专用适配的描述仅保留到记录。

Tripo 的多图顺序固定为“正面、左侧、背面、右侧”，后端将缺少的末尾视图补为空对象；至少上传前两张。fal 混元顺序为“正面、左侧、背面、右侧、顶部、底部、左前方、右前方”。当前界面只能省略末尾视图，不支持中间视角留空；删图后后续图片的视角会顺次前移，请按缩略图标签核对。

## 提交、查询与结果

| 适配 | 提交 | 查询与结果 |
| --- | --- | --- |
| GPT.GE | multipart `POST /task/gi/image-to-3d` | `GET /task/{task_id}` → `output.file_url` |
| Meshy | JSON `/openapi/v2/text-to-3d`、`/openapi/v1/image-to-3d`、`/openapi/v1/multi-image-to-3d` | 相同路径 `GET /{id}` → `model_urls.glb`；文本开启纹理时继续创建并查询 refine 任务 |
| Tripo | multipart `/v2/openapi/upload/sts` 获取图片 token；JSON `POST /v2/openapi/task` | `GET /v2/openapi/task/{task_id}` → `output.model` / `pbr_model` / `base_model` |
| Rodin | multipart `POST /api/v2/rodin` | 用 `jobs.subscription_key` POST `/api/v2/status`；非空 jobs 全部 Done 后，用创建响应的 `uuid` POST `/api/v2/download`，选择 GLB |
| fal | JSON `POST /{完整模型端点}` | 用模型前两段路径 `/fal-ai/{模型}/requests/{request_id}/status` 查询；完成后 GET 不带 `/status` 的路径取 `model_glb.url` |

后端始终使用创建任务的原渠道和密钥查询。新适配的只读查询遇到网络错误、429 或 5xx 会在后台期限内重试并遵守 `Retry-After`；不自动重发创建请求，避免重复扣费。Rodin 即使 HTTP 201 也检查业务 `error`，等待所有子任务完成；fal 的 COMPLETED 若包含错误不会判为成功。

成功文件立即下载并转存到本站文件系统后，本站任务才完成，沿用现有单模型文件 100 MiB 的转存上限。渠道短时签名地址不作为长期结果；下载不附带上游 API Key。提交、轮询与转存共用后台配置的 3D 期限。刷新恢复、超时后的上游结果核实与计费对账仍见 [待办](todo.md)；待联调路径见 [待测试](pending-test.md)。

`GET /api/settings` 公开派生 `modelChannel.model3DAdapters` 和 `modelChannel.model3DCapabilities`，按前台模型名索引，只包含适配标识及模式、数量、图片大小、质量、纹理、PBR、面数、视角顺序等能力，不含渠道地址与密钥。通用模型无专用条目。非法模式和参数在扣费前拒绝；文件权限、大小及格式在实际读取时检查，失败沿用退款流程。

## 接口依据

- GPT.GE：[图片转 3D](https://api-gpt-ge.apifox.cn/283324667e0)、[查询结果](https://api-gpt-ge.apifox.cn/283376526e0)。[腾讯 Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) 另有多视图模型，不能把该渠道的单图限制推广为整个混元系列的限制。
- Meshy：[官方文档索引](https://docs.meshy.ai/llms.txt)、[OpenAPI](https://docs.meshy.ai/openapi.json)。
- Tripo：[生成](https://platform.tripo3d.ai/docs/generation)、[上传](https://platform.tripo3d.ai/docs/upload)、[任务查询](https://platform.tripo3d.ai/docs/task)。
- Rodin：[Gen-2.5](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5)、[状态](https://docs.hyper3d.ai/en/api-specification/check-status)、[下载](https://docs.hyper3d.ai/en/api-specification/download-results)。
- fal：[队列](https://fal.ai/docs/documentation/model-apis/inference/queue)、[混元 3.1 Pro 单图/多视图](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d/api)、[混元文字](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/text-to-3d/api)、[TRELLIS.2](https://fal.ai/models/fal-ai/trellis-2/api)。
