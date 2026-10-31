# 视频 API 适配与计费

以下为已实现、待真实账号联调的范围。后台“系统设置 → 渠道可用模型”选择视频类型后，可选适配方式；留空使用通用 `/v1/videos` multipart 协议。前台模型名可自定义，上游名称须与下表一致。分别配置渠道地址、密钥、开放的视频模型与价格。

| 适配方式 | 渠道地址 | 上游名称 | 当前开放规格 |
| --- | --- | --- | --- |
| `gptge-kling` | `https://api.gpt.ge` | `kling-v1-5`、`kling-v1-6` | 文字或单图，5 秒，720p |
| `gptge-jimeng` | 同上 | `jimeng_t2v_v30`、`jimeng_i2v_first_v30`、`jimeng_i2v_first_tail_v30` | 分别为文字、首帧、首尾帧，5 秒，720p，121 帧 |
| `gptge-bailian` | 同上 | `happyhorse-1.1-t2v`、`happyhorse-1.1-i2v`、`happyhorse-1.1-r2v` | 分别为文字、单图、1–3 张参考图，5 秒，720p |
| `gptge-vidu` | 同上 | `vidu1.5`、`vidu2.0`、`viduq3-pro` | 1.5 文字 4 秒/720p；2.0 图生 4 秒/720p（1 张首帧、2 张首尾帧、3 张参考图）；Q3 Pro 单图 5 秒/1080p |
| `gptge-seedance` | 同上 | `doubao-seedance-1-5-pro-251215` | 文字、首帧或首尾帧，5 秒，720p |
| `gptge-hailuo` | 同上 | `MiniMax-Hailuo-02` | 文字、首帧或首尾帧，768p 的 6/10 秒，1080p 仅 6 秒 |
| `ark-seedance` | `https://ark.cn-beijing.volces.com` | `doubao-seedance-2-0-260128`、`doubao-seedance-2-0-fast-260128`、`doubao-seedance-2-0-mini-260615`、`doubao-seedance-2-5-260628` | 原生方舟文字、首帧或首尾帧；2.0 为 4–15 秒，2.5 为 4–30 秒；当前接入 720p |
| `fal-veo` | `https://queue.fal.run` | `fal-ai/veo3.1`、`fal-ai/veo3.1/fast` | 文字或单图，4/6/8 秒，720p/1080p/4k；高清仅 8 秒 |
| `fal-grok` | 同上 | `xai/grok-imagine-video` | 文字或单图，1–15 秒，480p/720p |
| `fal-wan` | 同上 | `wan/v2.6` | 文字或单图，5/10/15 秒，720p/1080p |
| `fal-kling` | 同上 | `fal-ai/kling-video/v3/pro` | 文字、首帧或首尾帧，3–15 秒，Pro 规格 |

GPT.GE 部分文档仅明确列出示例规格，因此当前适配采用表中范围，不等同于模型完整能力。Sora、Runway 等文档标注失效或缺货的旧接口未作为专用适配。不同托管方使用不同密钥和协议，方舟新型号不代表 GPT.GE 已提供同型号。音频沿用上游默认，当前未开放音频、视频参考、视频编辑、延长或多镜头参数。

通过 `GET /api/settings` 的 `modelChannel.videoAdapters`、`videoCapabilities` 获取当前优先渠道的适配与规格；能力包括 `minImages`、`maxImages`、`durations`、`resolutions`、`aspectRatios`。前端按当前型号限制选项。部分图生接口的比例由参考图决定，海螺不提供显式比例字段；本站不会发送不支持的比例参数。首尾帧按图片顺序提交。

## 双计费配置

模型定价表主行保留按次价，展开视频行开启“同时开放按秒计费”，填写独立的标准价、套餐展示价、API 价。设置保存在原 `modelCosts` 中：

```json
{
  "model": "my-video-model",
  "credits": 12,
  "billingType": "fixed",
  "apiCredits": 0,
  "apiMultiplier": 2,
  "videoSecondPrice": { "credits": 2, "apiCredits": 3, "planCredits": {} }
}
```

`videoSecondPrice` 缺省表示不开放按秒；视频不使用词元计费。API 显式单价大于 0 时优先，否则对应标准单价乘以 `apiMultiplier`，默认 2。套餐价目前仍用于展示，站内扣费使用标准价。

请求 `billingType="fixed"` 按次，`"second"` 按秒；缺省默认 `fixed`。按秒必须提供受模型支持的正整数 `seconds`，费用为后台每秒价格乘以请求秒数，与成片实测时长无关。例如上述配置请求 6 秒，站内按秒扣 12 点，API 按秒扣 18 点，API 不传计费方式扣按次价 24 点。示例需选择支持 6 秒的模型。

单价不接受客户端传入。任务保存计费方式、单价和请求秒数快照，排队期间改价不改变已扣费用；失败、执行超时或排队撤销沿用精确退款流程。本站退款不代表上游已经退款，执行超时后仍需核实上游结果。

## 提交与查询

`POST /api/v1/videos` 接受 JSON 或 multipart。JSON 示例：

```json
{
  "model": "my-video-model",
  "prompt": "镜头缓慢推进，晨雾中的森林，树叶轻轻摇动",
  "seconds": 6,
  "size": "16:9",
  "resolution_name": "720p",
  "billingType": "second",
  "images": [{ "url": "/api/files/FILE_ID/content", "storageKey": "cloud:FILE_ID" }]
}
```

文字模式省略 `images`。multipart 使用相同文本字段，参考图使用重复的 `input_reference[]` 文件字段（也可单独使用 `input_reference`，不能混用）。每张图片上限 10 MiB；图片数量由模型限制。请求一次只生成一个视频，不接受 `n`、`preset`、`duration`、客户端价格或其他透传参数；Seedance 描述不接受旧 `--` 参数，时长仅从 `seconds` 产生。通用适配把比例转为对应像素尺寸后提交。

专用图生适配使用图片公网 URL。本站文件先校验当前账号权限，再为提供方生成带访问 token 的链接；需将站点来源配置为提供方可访问的公网地址。向上游不发送本站用户 API 密钥。外部参考 URL 必须是公网 HTTP(S) 地址，图像解码及提供方额外限制仍由上游校验。

网站与 API 密钥调用均立即返回 `{code:0,data:{queued:true,taskId,status,billingType,seconds,unitCredits,energyCost,...},msg:"ok"}`，即使关闭限流队列，也由后台完成创建、查询和视频转存。

- `GET /api/v1/videos/{taskId}`：本站统一任务状态及计费快照，与 `/generation-tasks/{taskId}` 一致；只允许读取当前账号的视频任务。
- `GET /api/v1/generation-tasks/{taskId}/result`：成功后返回 `{id,status:"completed",file,billingType,seconds,unitCredits,energyCost}`。`file` 为本站文件信息。
- `GET /api/v1/videos/{taskId}/content`：成功后返回已转存文件流，业务错误返回 JSON。
- `DELETE /api/v1/generation-tasks/{taskId}`：仅可撤销尚未执行的排队任务并退款。

各专用适配创建不自动重发；查询在同一执行期限内重试网络错误、429 和 5xx。fal 使用 `Key` 鉴权，按完整端点创建、两段模型根路径查询；GPT.GE/方舟使用 Bearer。提供方返回的文件 URL 下载不携带渠道密钥。

## 文档来源

- [GPT.GE 视频接口目录](https://api-gpt-ge.apifox.cn/5225294m0)：[可灵](https://api-gpt-ge.apifox.cn/218907798e0)、[即梦](https://api-gpt-ge.apifox.cn/482320855e0)、[HappyHorse](https://api-gpt-ge.apifox.cn/434533271e0)、[Vidu Q3](https://api-gpt-ge.apifox.cn/487644819e0)、[Seedance](https://api-gpt-ge.apifox.cn/286337873e0)、[海螺](https://api-gpt-ge.apifox.cn/352441157e0)。
- [方舟视频生成教程](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)、[Seedance 2.0](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh)、[Seedance 2.5](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)。
- fal 端点文档：[Veo 3.1](https://fal.ai/models/fal-ai/veo3.1/llms.txt)、[Fast 单图](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video/llms.txt)、[Grok](https://fal.ai/models/xai/grok-imagine-video/text-to-video/llms.txt)、[Wan 2.6](https://fal.ai/models/wan/v2.6/text-to-video/llms.txt)、[Kling 3.0 Pro](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/llms.txt)。

尚未发起付费生成，真实渠道账号、可用额度和最终模型能力以联调结果为准；验收项见 [待测试](pending-test.md)。
