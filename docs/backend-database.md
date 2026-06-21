# 后端数据库说明

本文档只记录后端当前已经使用的主要数据表。

## 数据库

后端使用 GORM 管理数据库连接和表结构迁移。

支持的存储驱动：

- `sqlite`
- `mysql`
- `postgresql`

当前服务启动时会自动执行数据库更新并记录更新日志；重新部署或更新镜像后不需要再到后台手动点击更新。数据库状态页会显示当前实际使用的数据库驱动和脱敏连接地址，便于确认安装后连接的是 PostgreSQL、SQLite 还是 MySQL；除检查模型表是否存在外，也会按当前 `AutoMigrate` 模型检查全部数据库字段是否存在。安装更新会主动删除队列表旧的 `request_body`、`response_body` 大字段，并改用 `cloud_files` 对象引用。当前 `AutoMigrate` 自动维护以下表：

- `users`
- `email_verifications`
- `credit_logs`
- `prompts`
- `assets`
- `settings`
- `cloud_files`
- `generation_histories`
- `generation_tasks`
- `user_preferences`
- `workflows`
- `workflow_shares`
- `workflow_share_copies`
- `workflow_share_stars`
- `workflow_community_posts`
- `canvas_assistant_sessions`
- `plans`
- `plan_orders`
- `entitlement_logs`
- `kyc_verifications`
- `database_update_logs`

后续新增表时再同步补充本文档，未实际使用的规划表不提前写入。

### users

系统用户表。用户基础信息、角色、算力点余额和第三方登录标识放在该表中。

| 字段              | 类型     | 说明                       |
|-----------------|--------|--------------------------|
| `id`            | string | 主键                       |
| `username`      | string | 用户名，唯一索引                 |
| `password`      | string | 密码哈希                     |
| `email`         | string | 邮箱                       |
| `display_name`  | string | 昵称                       |
| `account_type`  | string | 账户类型：`personal`、`company`，默认 `personal` |
| `profile_completed` | bool | 是否已完成账户类型和名称资料 |
| `avatar_url`    | string | 头像地址                     |
| `role`          | string | 角色：`user`、`admin`        |
| `credits`       | number | 算力点余额                    |
| `workflow_create_credits` | number | 工作流创建次数余额，新注册用户默认 0 |
| `aff_code`      | string | 用户自己的邀请码，唯一索引            |
| `aff_count`     | number | 已邀请用户数量，冗余统计字段           |
| `inviter_id`    | string | 邀请人用户 ID                 |
| `github_id`     | string | GitHub 用户 ID               |
| `google_id`     | string | Google 用户 ID               |
| `linux_do_id`   | string | Linux.do 用户 ID            |
| `metamask_address` | string | MetaMask 钱包地址            |
| `wechat_id`     | string | 微信用户 ID                   |
| `auth_provider` | string | 主要登录来源：`password`、`google`、`github`、`linux-do`、`metamask` 等 |
| `email_verified` | bool | 邮箱是否已验证                 |
| `status`        | string | 用户状态：`active`、`ban`       |
| `token_version` | number | 登录令牌版本，改密码后递增并让旧 JWT 失效 |
| `last_login_at` | string | 最近登录时间                   |
| `extra`         | json   | 扩展信息，第三方资料按平台命名空间保存，如 `linuxDo` |
| `created_at`    | string | 创建时间                     |
| `updated_at`    | string | 更新时间                     |

### email_verifications

邮箱验证码表。用于注册绑定邮箱、找回密码和 MetaMask 首次登录绑定邮箱。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `purpose` | string | 用途：`register`、`reset`、`metamask` |
| `target` | string | 邮箱地址 |
| `code` | string | 验证码 |
| `attempts` | number | 验证失败次数，超过限制后需要重新获取 |
| `expires_at` | string | 过期时间 |
| `used_at` | string | 使用时间，未使用为空 |
| `created_at` | string | 创建时间 |

### database_update_logs

数据库更新记录表。服务启动时自动执行数据库更新后写入，用于查看每次更新实际执行来源。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `source_file` | string | 本次更新执行来源文件，当前为 GORM AutoMigrate 相关 Go 文件 |
| `models` | text | 本次 AutoMigrate 涉及的模型列表 |
| `status` | string | 执行状态：`success`、`error` |
| `error` | text | 失败原因，成功时为空 |
| `created_at` | string | 执行时间 |

### prompts

提示词表。用于保存公开提示词、内置 GitHub 系统提示词、分类和预览内容。

| 字段           | 类型     | 说明                           |
|--------------|--------|------------------------------|
| `id`         | string | 主键                           |
| `title`      | string | 标题                           |
| `cover_url`  | string | 封面图                          |
| `prompt`     | string | 提示词内容                        |
| `tags`       | json   | 标签列表                         |
| `category`   | string | 分类标识                         |
| `preview`    | text   | Markdown 展示内容，可包含文本、图片、视频链接等 |
| `created_at` | string | 创建时间                         |
| `updated_at` | string | 更新时间                         |

`github_url` 仅用于接口返回，不写入数据库。

### assets

素材表。当前用于后台素材库。

| 字段               | 类型     | 说明                            |
|------------------|--------|-------------------------------|
| `id`             | string | 主键                            |
| `title`          | string | 标题                            |
| `type`           | string | 素材类型：`text`、`image`、`video` 等 |
| `cover_url`      | string | 封面图                           |
| `tags`           | json   | 标签列表                          |
| `category`       | string | 分类标识                          |
| `description`    | string | 描述                            |
| `content`        | text   | 文本或 Markdown 内容               |
| `url`            | string | 图片、视频等媒体地址                    |
| `created_at`     | string | 创建时间                          |
| `updated_at`     | string | 更新时间                          |

### settings

系统配置表，只保存两行数据：`public` 放前端可读取的公开配置，`private` 放仅后端和管理员可读取的私有配置，配置值都用 JSON。

| 字段           | 类型     | 说明                    |
|--------------|--------|-----------------------|
| `key`        | string | 主键：`public`、`private` |
| `value`      | json   | 配置内容                  |
| `created_at` | string | 创建时间                  |
| `updated_at` | string | 更新时间                  |

`public.value` 常放前端展示和可公开读取的配置，例如模型列表、登录开关等。
`private.value` 常放渠道密钥、登录密钥、后台内部开关等。

当前系统设置接口会按后端结构体序列化和反序列化已知字段；数据库 JSON 中额外存在的旧字段会被忽略。

`public.value` 当前字段：

| 字段                | 类型       | 说明             |
|-------------------|----------|----------------|
| `modelChannel` | object | 模型渠道公开配置组 |
| `auth` | object | 公开登录配置 |
| `pages` | object | 隐私政策、服务条款等公开页面内容 |
| `pageAccess` | object | 页面访问控制公开配置 |
| `adSense` | object | Google AdSense 广告公开配置 |

`modelChannel` 当前字段：

| 字段                | 类型       | 说明             |
|-------------------|----------|----------------|
| `availableModels` | string[] | 系统可用模型列表       |
| `modelCosts` | object[] | 模型算力点配置       |
| `defaultModel`    | string   | 默认模型           |
| `defaultImageModel` | string | 默认图片模型         |
| `defaultVideoModel` | string | 默认视频模型         |
| `defaultTextModel` | string  | 默认文本模型         |
| `systemPrompt`    | string   | 系统提示词          |

`modelCosts` 每项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | 模型名称 |
| `credits` | number | 每次后端模型接口调用前预扣的算力点，未配置默认不扣除 |

`auth` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `allowRegister` | bool | 是否允许用户注册 |
| `emailVerification` | bool | 是否开启注册邮箱验证 |
| `turnstileSiteKey` | string | Cloudflare Turnstile 前端站点 Key，启用后由私有配置派生公开下发 |
| `linuxDo` | object | Linux.do 登录公开配置 |
| `google` | object | Google 登录公开配置 |
| `github` | object | GitHub 登录公开配置 |
| `metamask` | object | MetaMask 登录公开配置 |
| `customProviders` | object[] | 自定义 OAuth 登录公开配置 |

登录公开配置字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 登录方式 ID |
| `name` | string | 前台按钮显示名称 |
| `iconUrl` | string | 前台按钮图标地址 |
| `enabled` | bool | 是否在前台开启 |
| `siteName` | string | MetaMask 签名网站名称，仅 `metamask` 使用 |
| `siteUrl` | string | MetaMask 签名网站 URL，仅 `metamask` 使用 |
| `signatureLogoUrl` | string | MetaMask 签名 Logo URL，仅 `metamask` 使用 |

`pages` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `privacyTitle` | string | 隐私政策页面标题 |
| `privacyContent` | text | 隐私政策页面正文 |
| `privacyTitleEn` | string | 隐私政策英文页面标题 |
| `privacyContentEn` | text | 隐私政策英文页面正文 |
| `termsTitle` | string | 服务条款页面标题 |
| `termsContent` | text | 服务条款页面正文 |
| `termsTitleEn` | string | 服务条款英文页面标题 |
| `termsContentEn` | text | 服务条款英文页面正文 |

`pageAccess` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `canvasLoginRequired` | bool | 工作流页面是否需要登录访问 |
| `imageLoginRequired` | bool | 生图工作台页面是否需要登录访问 |
| `videoLoginRequired` | bool | 视频创作台页面是否需要登录访问 |
| `promptsLoginRequired` | bool | 提示词库页面是否需要登录访问 |
| `assetsLoginRequired` | bool | 我的素材页面是否需要登录访问 |

`adSense` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | bool | 是否全站启用 Google AdSense 脚本 |
| `code` | string | 从 AdSense 后台复制的 script 代码，前端只提取官方脚本地址加载 |
| `adsTxt` | string | 网站根路径 `/ads.txt` 输出内容，用于 Google AdSense 网站审核 |
| `pages` | object | 页面级广告开关 |

`adSense.pages` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `home` | bool | 首页是否加载广告脚本 |
| `pricing` | bool | 套餐页是否加载广告脚本 |
| `image` | bool | 生图工作台是否加载广告脚本 |
| `video` | bool | 视频创作台是否加载广告脚本 |
| `model3d` | bool | 3D 模型页是否加载广告脚本 |
| `canvas` | bool | 工作流页面是否加载广告脚本 |
| `prompts` | bool | 提示词库是否加载广告脚本 |
| `assets` | bool | 我的素材是否加载广告脚本 |
| `assetLibrary` | bool | 素材库是否加载广告脚本 |
| `privacy` | bool | 隐私政策页是否加载广告脚本 |
| `terms` | bool | 服务条款页是否加载广告脚本 |

`private.value` 当前字段：

| 字段         | 类型       | 说明       |
|------------|----------|----------|
| `channels` | object[] | 模型渠道配置列表 |
| `promptSync` | object | GitHub 远程提示词定时同步配置 |
| `aiQueue` | object | AI 队列与限流配置 |
| `canvasAssist` | object | 画布助手配置 |
| `turnstile` | object | Cloudflare Turnstile 人机验证私有配置，包含启用状态、Site Key 和 Secret Key |
| `auth` | object | 私有登录配置 |
| `mail` | object | SMTP 邮件验证码配置 |
| `cloudStorage` | object | Cloudflare R2 / S3 兼容云存储配置 |

`channels` 每项字段：

| 字段       | 类型       | 说明       |
|----------|----------|----------|
| `protocol` | string | 协议，当前支持 `openai` |
| `name`   | string   | 渠道名称     |
| `baseUrl` | string  | 渠道接口地址   |
| `apiKey` | string   | 渠道密钥     |
| `models` | string[] | 渠道可用模型列表 |
| `weight` | number   | 渠道权重，同一模型命中多个渠道时按权重随机 |
| `enabled` | bool    | 是否启用     |
| `remark` | string   | 备注       |

`promptSync` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | bool | 是否开启定时同步，默认开启 |
| `cron` | string | Cron 表达式，默认每 5 分钟 |
| `githubRawProxyEnabled` | bool | 是否在 `/zh-CN` 中文页面将 GitHub raw 图片通过 `https://gh-proxy.com/` 加速 |

`canvasAssist` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `historyRetentionDays` | number | 画布助手对话历史保留天数，默认 7 天 |

OAuth 私有配置字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 登录方式 ID |
| `name` | string | 管理后台显示名称 |
| `iconUrl` | string | 前台按钮图标地址 |
| `clientId` | string | OAuth Client ID |
| `clientSecret` | string | OAuth Client Secret，后台返回时隐藏 |
| `authorizeUrl` | string | OAuth 授权地址 |
| `tokenUrl` | string | OAuth Token 地址 |
| `userInfoUrl` | string | OAuth 用户信息地址 |
| `scope` | string | OAuth scope |
| `enabled` | bool | 服务端是否启用 |

MetaMask 私有配置字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | bool | 服务端是否启用 |
| `siteName` | string | 写入钱包签名消息的网站名称 |
| `siteUrl` | string | 写入钱包签名消息的网站 URL |
| `signatureLogoUrl` | string | 写入钱包签名消息的 Logo URL |

`mail` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | bool | 是否开启 SMTP 邮件 |
| `host` | string | SMTP Host |
| `port` | number | SMTP 端口 |
| `username` | string | SMTP 用户名 |
| `password` | string | SMTP 密码，后台返回时隐藏 |
| `fromEmail` | string | 发件邮箱 |
| `fromName` | string | 发件名称 |
| `codeExpireMin` | number | 验证码有效分钟数 |
| `templates` | object | 注册、找回密码和 MetaMask 邮箱验证模板 |

`cloudStorage` 当前字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | bool | 是否开启云存储，默认关闭 |
| `storageMode` | string | 存储策略：`local_only`、`s3_only`、`s3_with_local_fallback` |
| `provider` | string | 服务商：`r2`、`s3` |
| `endpoint` | string | S3 兼容 Endpoint，R2 使用账号级 endpoint |
| `region` | string | Region，R2 默认 `auto` |
| `accessKeyId` | string | Access Key ID |
| `secretAccessKey` | string | Secret Access Key，后台返回时隐藏，留空保存表示不修改 |
| `bucket` | string | Bucket 名称 |
| `publicBaseUrl` | string | 自定义域名 / Public Base URL |
| `imagePathTemplate` | string | 图片路径模板，默认 `{username}/images/{yyyy}/{mm}/{dd}/{filename}` |
| `videoPathTemplate` | string | 视频路径模板，默认 `{username}/videos/{yyyy}/{mm}/{dd}/{filename}` |
| `model3dPathTemplate` | string | 3D 模型路径模板，默认 `{username}/models/{yyyy}/{mm}/{dd}/{filename}` |
| `imageExpireDays` | number | 图片默认过期天数，默认 7 |
| `videoExpireDays` | number | 视频默认过期天数，默认 7 |
| `model3dExpireDays` | number | 3D 模型默认过期天数，默认 7 |
| `autoCleanupEnabled` | bool | 是否启用自动清理 |
| `pathStyleEndpoint` | bool | 是否使用 Path Style Endpoint |

邮件模板支持变量：`{{code}}`、`{{email}}`、`{{expireMinutes}}`、`{{siteName}}`、`{{ip}}`、`{{country}}`、`{{region}}`。

后端请求模型时，先按模型名筛选启用且包含该模型的渠道，再按 `weight` 加权随机选择一个渠道。

### cloud_files

用户文件表。后端把上传图片、剪贴板图片、参考图、生成图片、生成视频和 3D 模型写入统一文件记录；存储位置由 `cloudStorage.storageMode` 控制，可只写本地、只写 Cloudflare R2 / S3，或优先写 R2/S3 并在失败时自动写入服务器本地 `LOCAL_FILE_DIR` 目录。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `username` | string | 用户名，用于路径模板中的 `{username}` |
| `provider` | string | 服务商：`r2`、`s3`、`local` |
| `file_type` | string | 文件类型：`image`、`video`、`model3d`、`task` |
| `purpose` | string | 用途：`temp`、`workflow`、`generation` |
| `workflow_id` | string | 关联工作流 ID，用于删除工作流时同步删除文件 |
| `history_id` | string | 关联生成历史 ID，用于删除历史时同步删除文件 |
| `bucket` | string | Bucket 名称 |
| `object_key` | string | 云端对象 Key 或服务器本地相对路径 |
| `public_url` | string | 前端展示、预览、下载使用的受控访问地址 |
| `access_token` | string | 文件访问随机 token，不返回给普通 JSON 接口字段 |
| `content_type` | string | 文件 MIME 类型 |
| `size` | number | 文件字节数 |
| `source` | string | 来源接口，例如 `/images/generations`、`/videos/:id/content` |
| `expires_at` | string | 到期时间。生成历史和临时文件按图片、视频、3D 模型各自配置计算，工作流文件为空表示跟随工作流长期保留 |
| `deleted_at` | string | 对象删除成功后的标记时间，未删除为空 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

用户上传入口只接受安全白名单内的图片、视频或 3D 模型 MIME 类型，单文件最大 50MB。队列请求和响应使用内部 `task` 类型对象，不开放给用户直接上传。文件内容读取时会校验所属用户或访问 token，不能通过猜测文件 ID 读取其他用户文件。自动清理任务只处理 `expires_at <= now` 且 `deleted_at` 为空的记录；删除对象成功后写入 `deleted_at`，删除失败只记录后端日志，不影响其他请求。

### generation_tasks

AI 生成队列表。任务表只保存状态和对象引用，原始请求体与响应体保存为 `cloud_files.file_type=task`，避免大 BLOB 长期占用数据库。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `username` | string | 用户名 |
| `model` | string | 模型名称 |
| `path` | string | 后端代理路径，例如 `/images/generations` |
| `content_type` | string | 原始请求 Content-Type |
| `request_file_id` | string | 请求体对象 `cloud_files.id` |
| `credits` | number | 本任务预扣算力点 |
| `request_count` | number | 本次请求生成数量 |
| `status` | string | `queued`、`executing`、`succeeded`、`failed`、`canceled` |
| `queue_position` | number | 排队位置 |
| `response_status` | number | 上游响应状态码 |
| `response_header` | text | 上游响应头 JSON |
| `response_file_id` | string | 响应体对象 `cloud_files.id` |
| `error` | string | 失败原因 |
| `started_at` | string | 开始执行时间 |
| `finished_at` | string | 完成时间 |
| `canceled_at` | string | 取消时间 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

队列旧任务清理会先删除 `request_file_id` 和 `response_file_id` 指向的文件对象，再删除任务行。

### workflows

云端工作流表。工作流列表、详情、保存和删除均通过后端接口读取，不再以浏览器本地 IndexedDB / localForage 作为长期数据源。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 所属用户 ID，所有查询、更新、删除都必须带该条件 |
| `slug` | string | 工作流 URL 名称，仅限小写字母与数字，同一用户下未删除工作流不重复 |
| `title` | string | 工作流名称 |
| `nodes` | json | 节点数据 |
| `connections` | json | 连线数据 |
| `chat_sessions` | json | 旧版助手会话字段，新增画布助手历史保存到 `canvas_assistant_sessions` |
| `active_chat_id` | string | 旧版当前会话 ID |
| `background_mode` | string | 画布背景模式 |
| `show_image_info` | bool | 是否显示图片信息 |
| `viewport` | json | 画布视口 |
| `source_share_id` | string | 来源分享 ID，可为空 |
| `source_workflow_id` | string | 来源主工作流 ID，可为空 |
| `source_sync_mode` | string | `none`、`detached`、`linked` |
| `source_version` | number | 已同步到的分享版本 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |
| `deleted_at` | string | 软删除时间，未删除为空 |

创建普通工作流和复制分享工作流都会在事务中扣减 `users.workflow_create_credits` 1 次，并写入 `entitlement_logs`。

工作流保存时会把节点和参考图中引用的 `cloud_files` 绑定为 `purpose=workflow` 并清空过期时间；删除工作流时需要输入工作流名称并经过多次确认，删除后同步删除关联文件且不返还工作流创建次数。

### canvas_assistant_sessions

画布助手对话表。每条记录属于一个用户和一个工作流，列表、发送消息和删除接口都会按 `user_id + workflow_id` 校验，用户不能访问其他人的对话。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 所属用户 ID |
| `workflow_id` | string | 所属工作流 ID |
| `title` | string | 会话标题，默认取首条用户消息前缀 |
| `messages` | json | 对话消息数组 |
| `last_message_at` | string | 最近消息时间 |
| `expires_at` | string | 到期时间，按 `private.canvasAssist.historyRetentionDays` 计算 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |
| `deleted_at` | string | 软删除时间，未删除为空 |

画布助手调用后台配置的默认文本模型，按模型算力点配置预扣，调用失败时返还。过期历史会在读取助手列表时软删除。

### workflow_shares

工作流分享快照表。分享 token 为后端生成的不可猜测随机字符串；分享密码只保存哈希。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `owner_id` | string | 分享所有者用户 ID |
| `source_workflow_id` | string | 原工作流 ID |
| `token` | string | 分享链接 token，唯一索引 |
| `title` | string | 分享标题 |
| `snapshot` | json | 分享时的工作流快照 |
| `version` | number | 分享版本，从 1 开始，每次更新分享递增 |
| `password_enabled` | bool | 是否需要密码 |
| `password_hash` | string | 分享密码哈希 |
| `status` | string | `active`、`revoked` |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

同一工作流再次分享时更新当前 active 分享快照并递增版本，不生成新链接。

### workflow_share_copies

分享复制关系表。用于记录复制者的云端工作流和同步模式。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `share_id` | string | 分享 ID |
| `source_workflow_id` | string | 原工作流 ID |
| `source_owner_id` | string | 原作者用户 ID |
| `user_id` | string | 复制者用户 ID |
| `workflow_id` | string | 复制后生成的工作流 ID |
| `mode` | string | `detached`、`linked` |
| `source_version` | number | 复制或同步到的分享版本 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

原作者更新分享时，只会查找 `share_id` 相同且 `mode=linked` 的记录，并按 `workflow_id + user_id` 精确更新复制者工作流。

### workflow_share_stars

工作流分享 Star 表。登录用户可以对公开分享页执行 Star / 取消 Star。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `share_id` | string | 分享 ID |
| `user_id` | string | Star 用户 ID |
| `created_at` | string | 创建时间 |

`share_id + user_id` 有唯一索引，同一用户对同一个分享只能保留一条 Star 记录。

### workflow_community_posts

社区工作流发布表。用户把自己的云端工作流发布为社区作品时保存一份快照；后续编辑原工作流不会自动更新社区作品，需要用户在“我的作品”中手动同步。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 发布者用户 ID，用户侧修改、同步、删除都必须带该条件 |
| `source_workflow_id` | string | 来源工作流 ID |
| `token` | string | 社区公开访问 token，唯一索引 |
| `title` | string | 社区作品名称，独立于来源工作流名称 |
| `source_workflow_title` | string | 发布或同步时的来源工作流名称 |
| `locale` | string | 发布语言：`zh-CN`、`en-US` |
| `tags` | json | 社区标签数组 |
| `snapshot` | json | 发布快照 |
| `snapshot_workflow_at` | string | 快照对应的来源工作流更新时间，用于判断是否可同步 |
| `status` | string | `active`、`banned` |
| `ban_reason` | string | 管理员封禁原因 |
| `banned_at` | string | 封禁时间 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |
| `deleted_at` | string | 软删除时间 |

社区列表只展示 `status=active` 且未删除的记录。管理员只能封禁并填写原因；封禁后作品不再公开展示，作者在“我的作品”中可看到原因，封禁超过 7 天会在查询时自动软删除。

### plans

套餐表。启动迁移时会初始化 GO、Plus、Pro、Max 四个默认套餐，管理员可在后台编辑。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `code` | string | `go`、`plus`、`pro`、`max` |
| `name` | string | 套餐名称 |
| `description` | text | 描述 |
| `price_cents` | number | 价格，单位为分 |
| `currency` | string | 币种，默认 USD |
| `credits` | number | 购买后发放的算力点 |
| `workflow_create_credits` | number | 购买后发放的工作流创建次数 |
| `enabled` | bool | 是否启用 |
| `recommended` | bool | 是否推荐 |
| `sort` | number | 排序 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

### plan_orders

套餐订单表。Stripe Checkout 在后端创建，支付成功以 Stripe webhook 为准。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `plan_id` | string | 套餐 ID |
| `status` | string | `pending`、`paid`、`failed`、`canceled` |
| `amount_cents` | number | 订单金额 |
| `currency` | string | 币种 |
| `stripe_checkout_session_id` | string | Stripe Checkout Session ID |
| `stripe_payment_intent_id` | string | Stripe Payment Intent ID |
| `paid_at` | string | 支付完成时间 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

### entitlement_logs

权益变更流水表。记录套餐购买、KYC 奖励、工作流创建扣减和后台调整等权益变化。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `source` | string | `plan_purchase`、`kyc_reward`、`workflow_create`、`admin_adjust` |
| `source_id` | string | 关联业务 ID |
| `credits_delta` | number | 算力点变动 |
| `workflow_create_credits_delta` | number | 工作流创建次数变动 |
| `credits_after` | number | 变动后的算力点 |
| `workflow_create_credits_after` | number | 变动后的工作流创建次数 |
| `remark` | string | 备注 |
| `created_at` | string | 创建时间 |

### kyc_verifications

KYC 认证记录表。当前服务商为 Didit。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `provider` | string | 服务商，当前为 `didit` |
| `provider_session_id` | string | Didit session ID |
| `status` | string | `pending`、`approved`、`rejected`、`expired` |
| `rewarded` | bool | 是否已发放奖励 |
| `raw_payload` | json | Didit 会话或 webhook 原始数据 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

### generation_histories

用户图片、视频生成历史表。历史记录只保存已转存到 `cloud_files` 的参考图、图片或视频，默认保存 7 天；如果关联媒体不存在、已删除或已过期，列表接口会自动移除该历史记录。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `user_id` | string | 用户 ID |
| `type` | string | 历史类型：`image`、`video` |
| `title` | string | 标题，默认取提示词前缀或模型名 |
| `prompt` | text | 本次生成提示词 |
| `model` | string | 本次使用模型 |
| `config` | json | 本次生成参数，例如尺寸、质量、张数、秒数、清晰度 |
| `references` | json | 参考图片记录，保存名称、类型、URL 和 `storageKey` |
| `media` | json | 生成结果媒体，保存 `cloudFileId`、`storageKey`、URL、类型、大小和过期时间 |
| `status` | string | 生成状态：`成功`、`失败` |
| `error` | text | 失败信息，成功时为空 |
| `duration_ms` | number | 本次生成耗时毫秒数 |
| `expires_at` | string | 历史到期时间，取关联媒体中最早的 `expires_at` |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

删除生成历史或历史到期清理时，会同步删除关联的生成媒体和参考图文件，R2/S3 与服务器本地存储使用同一套删除逻辑。

### user_preferences

用户偏好表。用于保存用户侧主题、语言和 AI 参数偏好，不再依赖浏览器本地缓存作为长期偏好来源。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | string | 用户 ID，主键 |
| `value` | json | 偏好 JSON，例如 `theme`、`locale`、`config` |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

### credit_logs

用户算力点变更流水表。当前记录后台手动调整、模型调用预扣和模型调用失败返还。

| 字段           | 类型     | 说明                       |
|--------------|--------|--------------------------|
| `id`         | string | 主键                       |
| `user_id`    | string | 关联用户 ID                  |
| `type`       | string | 类型：`admin_adjust`、`ai_consume`、`ai_refund` |
| `amount`     | number | 本次变动数量，增加为正，扣减为负         |
| `balance`    | number | 变动后的用户算力点余额              |
| `related_id` | string | 关联业务 ID，可为空                |
| `remark`     | string | 备注                       |
| `extra`      | json   | 扩展信息                     |
| `created_at` | string | 创建时间                     |

`type` 当前取值：

| 值 | 说明 |
| --- | --- |
| `admin_adjust` | 后台手动调整 |
| `ai_consume` | 调用后端模型接口消费 |
| `ai_refund` | 后端模型接口调用失败返还 |
