# 前后端接口响应约定

后端业务接口统一返回 JSON：

```json
{
  "code": 0,
  "data": {},
  "msg": "ok"
}
```

- `code`: 业务状态码，`0` 表示成功，非 `0` 表示失败。
- `data`: 业务数据。失败时通常为 `null`。
- `msg`: 响应消息。成功默认为 `ok`，失败时放错误原因。

前端请求逻辑以 `code` 判断业务是否成功。普通业务失败通常返回 HTTP 200；用户 API 密钥鉴权失败返回 HTTP 401，来源校验失败返回 HTTP 403，并保持相同 JSON 结构。前端同时检查 HTTP 状态与业务 code。

接口连接失败、服务不可达、返回体不是约定 JSON 时，前端按网络或接口异常处理。

`GET /api/auth/captcha-session` 返回用于验证弹窗展示的 `{ sessionId, clientIP, country }`，并设置 `Cache-Control: no-store`。IP 沿用服务端可信代理解析；国家/地区缺失时返回“未知”。展示编号不作为人机验证凭证，实际登录、注册等请求仍由服务端校验验证码服务的 token。

`POST /api/v1/profile/avatar` 要求登录，使用 multipart 的 `file` 字段上传裁剪后的 512 × 512 PNG，文件最大 5MB。后端重新解码并编码为 PNG 后保存，成功时 `data` 返回更新后的用户资料，前端同步头像；失败时沿用 `{ code, data, msg }`。普通 `/api/v1/profile` 只修改账户资料，不再接受头像 URL。

## 本轮安全与计费调整

- 业务模型必须在公开模型列表和对应功能范围中，并显式配置计费；未配置不再自动按 0 点放行。管理员显式配置 0 点仍允许免费调用。
- 图片/视频请求的 `n` 省略时为 1；提供时必须为 1–10 的整数，重复 multipart 字段、空值、负数、非整数和溢出计费均拒绝。
- `POST /api/v1/chat/completions` 与画布 Ask 接入统一预扣、用量结算和失败退款。对话 `n` 仅支持 1，输出上限默认为 4096，可设 1–32768；流式请求强制请求 usage。缺少 usage 时采用估算，估算扣费不超过预扣值。正常对话响应保留 OpenAI JSON/SSE 格式，流开始后的错误无法再改为业务 JSON。
- 视频创建返回本站任务 ID；状态和内容接口校验任务归属并使用创建时的原渠道，不接受上游任务 ID 直接查询。
- `POST /api/v1/asset-files` 接收 `{ "fileIds": ["file-id"] }`，创建当前账号的素材归属并返回 `data: "asset-id"`；`POST /api/v1/asset-files/:id` 更新属于自己的登记并返回相同 ID；`DELETE` 同路径释放登记与引用，返回 `data: true`。每条最多 100 个文件、每用户最多 1000 条；任务载荷不能被保留为素材。
- `/api/auth/*`、管理员登录和 webhook 的请求体上限为 1 MiB，其余 API 通用上限为 80 MiB；上传等接口仍使用各自更严格的限制。Stripe/Didit 签名前也限制读取为 1 MiB。
- 分享密码验证按分享与访问 IP 每分钟最多 10 次，超限阻止该维度 5 分钟；没有可信 IP 时使用登录用户 ID，匿名用户需要先登录。启用人机验证时同时需要 `captchaToken`。
- 3D 没有可用渠道或上游未返回真实模型文件时返回失败并走退款，不再返回收费占位结果。

当前模型请求通过本站 Go 后端渠道，密钥保存在后端私有设置；前端不再提供浏览器本地 API Key 直连路径。

## 生成期限与后台任务

- 管理员使用 `POST /api/admin/settings/ai-timeouts` 保存 `{ imageMinutes, videoMinutes, model3DMinutes, textMinutes }`，单位为分钟，默认分别为 10、15、30、5，允许 1–120 的整数。响应 `data` 为保存后的四项设置；只更新该私有配置并记录审计流水，其他未保存设置不会被提交。无需重启，新开始执行的任务使用最新设置。
- 登录会话提交图片生成、图片编辑、视频、3D 生成后，返回 `{ code: 0, data: { queued: true, taskId, status, queuePosition, aheadCount, model, path }, msg: "ok" }`。`queued: true` 表示请求交由后台任务接管，`status` 可为 `queued` 或 `executing`；关闭限流队列时仍在后台执行。
- 使用 `GET /api/v1/generation-tasks/{id}` 查询状态，`succeeded` 后通过 `/result` 获取结果。图片保留 `data[]` 图片格式；站内视频结果为 `{ id, status: "completed", file }`，其中 `file` 包含云端/本地后端文件 URL、storageKey、cloudFileId 等，视频的上游轮询和转存已由后台完成；3D 结果保留 `{ code, data: { results, energyCost, ... }, msg }`。
- `GET /api/v1/model-3d/generations/{id}` 可查询本站 3D 任务；未完成时 `data.status` 为 `queued`、`executing`、`failed` 或 `canceled`，成功时返回 `status: "completed"` 及模型文件。接口校验当前用户和任务类型。
- API 密钥调用仍在容量充足时同步返回，在限流时返回任务编号；视频 API 保持“创建编号 → 查询状态 → 获取内容”的调用方式。同步调用仍受部署入口及客户端自身超时限制，后台配置无法调整 CDN 或上游网关的超时。
- 超时或上游 HTTP 408/504/524 不触发图片/视频创建请求自动重发。失败退款沿用本站任务结算规则，上游计费不会因此自动退还。运行中的后台任务不因浏览器离开而取消，结果保留时间沿用队列配置；各页面刷新后自动恢复任务列表仍待完善。

## 用户 API 密钥与外部调用

- 登录用户使用 `GET /api/v1/api-keys?page=1&pageSize=20` 查看自己的密钥列表，`data` 为 `{ items, total }`；列表只返回名称、脱敏标识、状态和时间。
- `POST /api/v1/api-keys` 接收 `{ "name": "我的应用" }`，成功的 `data` 为 `{ item, key }`，其中 `key` 是仅此一次返回的完整随机密钥。名称最多 50 个字符，同账号忽略首尾空格与大小写后不可重复，已撤销名称仍保留。重复创建保持 `{ code: 1, data: null, msg }`。
- `DELETE /api/v1/api-keys/:id` 永久撤销所属账号的密钥，成功返回 `data: true`；不能恢复，已提交任务继续执行。这三个管理接口只接受网站登录鉴权，用户 API 密钥不能管理密钥、账号、工作流或后台。
- 使用 `Authorization: Bearer sk-aivro-...` 调用模型、上传/文件内容和生成队列接口。已撤销密钥、无效密钥或所属账号被禁用/删除时返回 HTTP 401 与 `{ code: 1, data: null, msg: "API 密钥无效或已撤销" }`。不支持 URL 参数传密钥；服务端调用沿用现有来源校验，不带 Cookie 和浏览器来源的调用可以使用 Bearer。
- `GET /api/v1/models` 接受登录会话或用户密钥，`data` 为 `{ id, type, credits, billingType }` 数组，展示已开放且已计费的模型及 API 价格；类型为 `text`、`image`、`video`、`model3d`。
- API 密钥调用按 `apiCredits`（显式价格优先，否则标准价乘 `apiMultiplier`，默认 2 倍）及 `apiBilling` 扣所属账号算力点。对话按原有预扣/词元结算；图片、视频和 3D 的词元计费有上游用量则按每千词元向上取整，缺少用量则保留提交时预扣。队列的 API 单价和方式在提交时保存，成功结算与任务终态在同一事务中提交。
- 对话成功继续返回标准 JSON/SSE，图片和视频直接成功保留模型接口响应；图片/视频排队时返回 `{ code: 0, data: { queued: true, taskId, ... }, msg: "ok" }`。使用同一账号的有效密钥查询 `/generation-tasks/:id` 和 `/generation-tasks/:id/result`，任务仍在排队时可 DELETE 取消并退款。
- 静态中文开发文档入口为 `/developers`（中文路径 `/zh-CN/developers`），包含所有已开放的对外接口说明与 22 种语言示例。具体功能与联调结果记录在 `docs/pending-test.md`。

## 安全响应与来源校验

- API 由 Go 中间件和 Next 同源代理统一添加 `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer` 和权限策略。
- AI 上游仅保留安全 Content-Type、`X-Request-Id`、`Retry-After`；不透传上游 Cookie、Location、CSP、Content-Disposition 或 CORS 策略。附件头由本站生成。
- JSON、SSE、JPEG/PNG/WebP/GIF、MP4/WebM/QuickTime、glTF 可按固定类型返回；其他类型强制 `application/octet-stream` 加下载附件头。任务请求原文和响应原文在对象存储中始终是 octet-stream，任务结果接口仍使用过滤后的业务 MIME。
- 带 Cookie 的修改请求必须有可信 Origin 或 Referer；来源来自 `APP_ORIGIN`、后台站点来源及允许来源配置。无浏览器来源且不带 Cookie 的服务调用可继续使用 Bearer。webhook 维持自己的签名验证。
- 上传文件、头像读取请求体前按用户限流（每分钟 30 次）；所有文件写入另受每分钟 60 次及账号总容量限制。

## 认证与分享接口变更

- `POST /api/auth/register/code` 与 `POST /api/auth/email-code` 接收可选 `locale`，前端自动携带当前界面语言；后者的 `purpose` 仍为 `register`、`reset` 或 `metamask`。语言按有效 `locale`、按权重匹配的 `Accept-Language`、邮件配置 `defaultLocale`、`zh-CN` 的顺序选择。支持简中、繁中、英文、日文、韩文、法文，并将 `en-GB`、`fr-CA` 等同语种标签匹配到对应邮件语言，`zh-HK` / `zh-Hant` 匹配繁中。不根据邮箱地址或请求地区推断语言，返回结构仍为 `{ code, data, msg }`。
- 管理员 `POST /api/admin/settings/mail-test` 接收 `{ setting, email, purpose, locale }`，使用当前表单的 SMTP 配置和指定语言、场景发送测试邮件；密码为空时沿用已保存密码。测试主题及正文包含对应语言的测试标记，示例验证码 `123456` 不写入验证记录，不能用于验证账号。
- 管理员 `POST /api/admin/settings/mail-preview` 接收 `{ template: { subject, body }, purpose, locale, codeExpireMin }`，返回 `data: { subject, text, html, locale }`。与实际发送复用同一渲染器，预览使用示例收件人、IP/地区和测试标记；不连接 SMTP、不发送邮件、不保存模板或验证码。后台保存的模板按 `private.mail.templates[locale][purpose]` 组织。

- 删除未使用的 `POST /api/auth/register/check`；注册与重置的发码接口对已注册/未注册邮箱返回相同成功结构，是否真正发送由服务端决定。验证码重新发送后旧码失效。
- `POST /api/auth/metamask/challenge` 增加 `captchaToken`。签名登录消费服务端的一次性挑战，不重复消费同一个第三方验证码 token。
- CAPTCHA 已启用但密钥不全时拒绝验证；后台也拒绝保存不完整的启用配置。
- `POST /api/auth/logout` 吊销当前账号全部会话并清 Cookie。生产 HTTPS 使用 `__Host-aivro_auth`（Secure、HttpOnly、Path=/、无 Domain）；本地 HTTP 使用开发 Cookie。
- 分享验证接口 `/api/v1/workflow-shares/:token/verify` 与 `/api/workflow-share-paths/:username/:slug/verify` 接收 `{ password, captchaToken }`；Fork 受保护的分享必须使用验证返回的 `shareAccessToken`，不能直接提交密码绕过验证。
- `POST /api/v1/workflow-shares/:token/revoke` 由分享所有者调用。撤销阻止后续预览和 Fork，并释放分享引用；已 Fork 的独立数据仍归复制者，不回收对方有效文件引用。
- 下线管理端算力流水的 POST/DELETE 接口；只保留列表读取和原有业务余额调整接口。
- 页面跳转前后端使用相同路由范围，拒绝跨站地址、反斜杠、控制字符、嵌套编码路径及 API/构建资源路径，非法值回退首页。
