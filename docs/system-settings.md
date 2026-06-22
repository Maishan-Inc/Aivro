# 系统配置数据结构

系统配置保存在 `settings` 表中，目前只使用两行：

| key | 说明 |
| --- | --- |
| `public` | 公开配置，前端可以读取 |
| `private` | 私有配置，只给后端和管理员使用 |

## public.value

```json
{
  "modelChannel": {
    "availableModels": ["gpt-5.5", "gpt-image-2", "grok-imagine-video"],
    "modelCosts": [
      { "model": "gpt-5.5", "credits": 1 },
      { "model": "gpt-image-2", "credits": 10 }
    ],
    "defaultModel": "gpt-image-2",
    "defaultImageModel": "gpt-image-2",
    "defaultVideoModel": "grok-imagine-video",
    "defaultTextModel": "gpt-5.5",
    "systemPrompt": ""
  },
  "auth": {
    "allowRegister": true,
    "emailVerification": false,
    "captcha": { "enabled": false, "provider": "turnstile", "siteKey": "" },
    "linuxDo": { "id": "linux-do", "name": "Linux.do", "iconUrl": "/icons/linuxdo.svg", "enabled": false },
    "google": { "id": "google", "name": "Google", "iconUrl": "/icons/google.svg", "enabled": false },
    "github": { "id": "github", "name": "GitHub", "iconUrl": "/icons/github.svg", "enabled": false },
    "metamask": { "id": "metamask", "name": "MetaMask", "iconUrl": "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg", "enabled": false },
    "customProviders": [{ "id": "o2", "name": "O2", "iconUrl": "", "enabled": false }]
  },
  "pages": {
    "privacyTitle": "隐私政策",
    "privacyContent": "隐私政策正文",
    "termsTitle": "服务条款",
    "termsContent": "服务条款正文"
  },
  "pageAccess": {
    "canvasLoginRequired": false,
    "imageLoginRequired": false,
    "videoLoginRequired": false,
    "promptsLoginRequired": false,
    "assetsLoginRequired": false
  },
  "adSense": {
    "enabled": false,
    "code": "",
    "adsTxt": "",
    "pages": {
      "home": true,
      "pricing": true,
      "image": true,
      "video": true,
      "model3d": true,
      "canvas": true,
      "prompts": true,
      "assets": true,
      "assetLibrary": true,
      "privacy": true,
      "terms": true
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `modelChannel` | object | 模型渠道公开配置组 |
| `auth` | object | 认证相关公开配置 |
| `pages` | object | 前台公开页面内容配置 |
| `pageAccess` | object | 页面访问控制公开配置 |
| `adSense` | object | Google AdSense 广告公开配置 |

`modelChannel` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `availableModels` | string[] | 系统可用模型，由管理员手动选择；页面下拉选项可来自私有渠道模型 |
| `modelCosts` | object[] | 模型算力点配置，后端模型接口调用前按模型预扣，上游失败时返还；未配置默认不扣除 |
| `defaultModel` | string | 默认模型，从 `availableModels` 中选择 |
| `defaultImageModel` | string | 默认图片模型，从 `availableModels` 中选择 |
| `defaultVideoModel` | string | 默认视频模型，从 `availableModels` 中选择 |
| `defaultTextModel` | string | 默认文本模型，从 `availableModels` 中选择 |
| `systemPrompt` | string | 系统提示词 |

`modelCosts` 每项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | 模型名称 |
| `credits` | number | 每次后端模型接口调用前预扣的算力点 |

用户侧请求统一使用后端 `/api/v1/*` 代理接口，请求会按模型名匹配 `private.value.channels` 中启用且包含该模型的可用渠道。用户侧不提供 Base URL、API Key 或本地直连配置。

`auth` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `allowRegister` | boolean | 是否允许用户注册，默认允许；关闭后注册入口隐藏，注册接口拒绝新用户创建 |
| `emailVerification` | boolean | 是否开启注册邮箱验证码 |
| `captcha` | object | 人机验证公开配置，包含启用状态、`turnstile` / `hcaptcha` 提供方和前端 Site Key |
| `linuxDo` / `google` / `github` / `metamask` | object | 内置第三方登录公开配置 |
| `customProviders` | object[] | 自定义 OAuth 登录公开配置 |

`pages` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `privacyTitle` | string | 隐私政策页面标题，默认“隐私政策” |
| `privacyContent` | string | 隐私政策页面正文，后台页面设置可编辑 |
| `termsTitle` | string | 服务条款页面标题，默认“服务条款” |
| `termsContent` | string | 服务条款页面正文，后台页面设置可编辑 |

前台 `/privacy` 和 `/terms` 会读取该配置展示内容；登录/注册页会提示“登录/注册 Aivro，即代表同意隐私政策和服务条款”，并链接到这两个页面。

`pageAccess` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `canvasLoginRequired` | boolean | 工作流页面是否需要登录访问，默认关闭 |
| `imageLoginRequired` | boolean | 生图工作台页面是否需要登录访问，默认关闭 |
| `videoLoginRequired` | boolean | 视频创作台页面是否需要登录访问，默认关闭 |
| `promptsLoginRequired` | boolean | 提示词库页面是否需要登录访问，默认关闭 |
| `assetsLoginRequired` | boolean | 我的素材页面是否需要登录访问，默认关闭 |

这些开关位于管理后台系统设置的公开配置中；开启后，未登录用户访问对应页面会跳转到登录页，关闭时保持公开访问。

`adSense` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否全站启用 Google AdSense 脚本，默认关闭 |
| `code` | string | 从 AdSense 后台复制的 script 代码；前端只提取官方 AdSense 脚本地址加载 |
| `adsTxt` | string | 网站根路径 `/ads.txt` 输出内容，用于 Google AdSense 网站审核 |
| `pages` | object | 首页、套餐页、生图工作台、视频创作台、工作流、提示词库、我的素材、素材库、隐私政策和服务条款等页面的广告开关 |

该配置位于管理后台“谷歌广告”页面。当前只加载 AdSense Auto Ads 脚本，广告展示位置由 Google AdSense 后台配置决定。

## private.value

```json
{
  "channels": [
    {
      "protocol": "openai",
      "name": "默认渠道",
      "baseUrl": "https://api.example.com",
      "apiKey": "sk-xxx",
      "models": ["gpt-5.5", "gpt-image-2"],
      "weight": 1,
      "enabled": true,
      "remark": ""
    }
  ],
  "promptSync": {
    "enabled": true,
    "cron": "*/5 * * * *",
    "githubRawProxyEnabled": false
  },
  "captcha": {
    "enabled": false,
    "provider": "turnstile",
    "turnstile": { "siteKey": "", "secretKey": "" },
    "hcaptcha": { "siteKey": "", "secretKey": "" }
  },
  "auth": {
    "linuxDo": {},
    "google": {},
    "github": {},
    "metamask": { "enabled": false },
    "customProviders": []
  },
  "mail": {
    "enabled": false,
    "host": "",
    "port": 587,
    "username": "",
    "password": "",
    "fromEmail": "",
    "fromName": "",
    "codeExpireMin": 10,
    "templates": {}
  },
  "cloudStorage": {
    "enabled": false,
    "storageMode": "local_only",
    "provider": "r2",
    "endpoint": "",
    "region": "auto",
    "accessKeyId": "",
    "secretAccessKey": "",
    "bucket": "",
    "publicBaseUrl": "",
    "imagePathTemplate": "{username}/images/{yyyy}/{mm}/{dd}/{filename}",
    "videoPathTemplate": "{username}/videos/{yyyy}/{mm}/{dd}/{filename}",
    "model3dPathTemplate": "{username}/models/{yyyy}/{mm}/{dd}/{filename}",
    "imageExpireDays": 7,
    "videoExpireDays": 7,
    "model3dExpireDays": 7,
    "autoCleanupEnabled": true,
    "pathStyleEndpoint": true
  },
  "stripe": {
    "enabled": false,
    "secretKey": "",
    "webhookSecret": "",
    "successUrl": "",
    "cancelUrl": ""
  },
  "kyc": {
    "enabled": false,
    "provider": "didit",
    "diditApiKey": "",
    "diditWebhookSecret": "",
    "workflowId": "",
    "callbackUrl": "",
    "rewardCredits": 0,
    "rewardWorkflowCreateCredits": 0,
    "rewardOnce": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `channels` | object[] | 模型渠道列表 |
| `promptSync` | object | GitHub 远程提示词定时同步配置 |
| `captcha` | object | 人机验证私有配置，支持关闭、Turnstile 和 hCaptcha |
| `auth` | object | OAuth、MetaMask 和自定义登录私有配置 |
| `mail` | object | SMTP 验证码与邮件模板配置 |
| `cloudStorage` | object | Cloudflare R2 / S3 兼容云存储配置 |
| `stripe` | object | Stripe 支付私有配置 |
| `kyc` | object | Didit KYC 私有配置 |

`channels` 每项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `protocol` | string | 协议，当前为 `openai` |
| `name` | string | 渠道名称 |
| `baseUrl` | string | OpenAI 兼容接口地址 |
| `apiKey` | string | 渠道密钥 |
| `models` | string[] | 该渠道可用模型 |
| `weight` | number | 渠道权重；同一模型有多个可用渠道时按权重随机 |
| `enabled` | boolean | 是否启用 |
| `remark` | string | 备注 |

后端调用模型时，会从已启用、已配置 `baseUrl` 和 `apiKey`、且 `models` 包含目标模型的渠道中选择一个。

`cloudStorage` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否开启 S3/R2 云存储，旧字段会由 `storageMode` 同步 |
| `storageMode` | string | 存储策略：`local_only` 只写服务器本地、`s3_only` 只写 R2/S3、`s3_with_local_fallback` 优先写 R2/S3 失败后写本地 |
| `provider` | string | 服务商：`r2` 表示 Cloudflare R2，`s3` 表示兼容 S3 |
| `endpoint` | string | S3 兼容 Endpoint；Cloudflare R2 形如 `https://<accountid>.r2.cloudflarestorage.com` |
| `region` | string | Region；R2 默认使用 `auto` |
| `accessKeyId` | string | Access Key ID |
| `secretAccessKey` | string | Secret Access Key，后台返回时隐藏；编辑时留空表示沿用已保存密钥 |
| `bucket` | string | Bucket 名称 |
| `publicBaseUrl` | string | 自定义域名 / Public Base URL；配置后 `public_url` 使用该基地址拼接对象路径 |
| `imagePathTemplate` | string | 图片路径模板，默认 `{username}/images/{yyyy}/{mm}/{dd}/{filename}` |
| `videoPathTemplate` | string | 视频路径模板，默认 `{username}/videos/{yyyy}/{mm}/{dd}/{filename}` |
| `model3dPathTemplate` | string | 3D 模型路径模板，默认 `{username}/models/{yyyy}/{mm}/{dd}/{filename}` |
| `imageExpireDays` | number | 图片默认过期天数，默认 7 天 |
| `videoExpireDays` | number | 视频默认过期天数，默认 7 天 |
| `model3dExpireDays` | number | 3D 模型默认过期天数，默认 7 天 |
| `autoCleanupEnabled` | boolean | 是否启用自动清理，默认开启 |
| `pathStyleEndpoint` | boolean | 是否使用 Path Style Endpoint，R2 默认开启 |

路径模板支持 `{username}`、`{yyyy}`、`{mm}`、`{dd}`、`{filename}`。后端会把图片、视频和 3D 模型生成结果转存到当前策略对应的存储，写入 `cloud_files`，并把接口返回内容改为受控访问 `public_url`；图片、视频和 3D 模型过期时间按各自天数分别计算。自动清理只删除已到期且未标记删除的对象，删除失败只记录日志。

`stripe` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否启用 Stripe 支付 |
| `secretKey` | string | Stripe Secret Key，后台返回时隐藏；编辑留空表示沿用已保存密钥 |
| `webhookSecret` | string | Stripe Webhook Secret，后台返回时隐藏；编辑留空表示沿用已保存密钥 |
| `successUrl` | string | Checkout 支付成功跳转地址，可包含 `{CHECKOUT_SESSION_ID}` |
| `cancelUrl` | string | Checkout 取消支付跳转地址 |

Stripe Checkout Session 只能由后端创建。用户支付成功后，额度发放必须以 `/api/webhooks/stripe` 收到并校验通过的 `checkout.session.completed` webhook 为准；订单已标记 `paid` 时重复 webhook 不会重复发放额度。

`kyc` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否启用 KYC |
| `provider` | string | 当前固定为 `didit` |
| `diditApiKey` | string | Didit API Key，后台返回时隐藏；编辑留空表示沿用已保存密钥 |
| `diditWebhookSecret` | string | Didit Webhook Secret，后台返回时隐藏；编辑留空表示沿用已保存密钥 |
| `workflowId` | string | Didit Workflow ID |
| `callbackUrl` | string | Didit webhook 回调地址，默认可使用 `/api/webhooks/didit` |
| `rewardCredits` | number | 认证通过奖励算力点 |
| `rewardWorkflowCreateCredits` | number | 认证通过奖励工作流创建次数 |
| `rewardOnce` | boolean | 是否每个用户只奖励一次，默认开启 |

Didit session 只能由后端创建，API Key 不返回前端。Didit approved webhook 校验通过后会幂等发放奖励并写入 `entitlement_logs`；rejected / expired 只更新认证状态。

## 套餐配置

套餐数据保存在 `plans` 表中，默认初始化 GO、Plus、Pro、Max 四个套餐。管理员可在“套餐管理”页面编辑套餐名称、描述、价格、币种、算力点额度、工作流创建次数、启用状态、推荐状态和排序。

前台 `/pricing` 读取启用套餐；登录用户点击购买后调用后端 `/api/v1/checkout/stripe` 创建 Stripe Checkout Session，前端只负责跳转到 Stripe，不参与权益发放。

## 云端工作流与分享规则

工作流项目全面保存到后端 `workflows` 表。浏览器本地只允许保存临时 UI 状态，不再保存工作流项目列表或工作流内容。创建普通工作流、复制分享工作流都会消耗 1 次 `workflow_create_credits`，次数不足时后端返回：“当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。”

分享链接保存在 `workflow_shares`。同一工作流再次点击分享会更新原分享快照并递增版本，不生成新 token。分享密码只保存哈希；分享详情需要登录访问，未验证密码时不返回完整快照。

复制分享时会在复制者账号下创建新的云端工作流：

- `detached`：复制后独立，不再跟随原分享更新。
- `linked`：记录来源分享和版本；原作者更新分享时，系统按 `workflow_share_copies.workflow_id + user_id` 精确覆盖同步 linked 工作流内容。

`promptSync` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否开启定时同步，默认开启 |
| `cron` | string | Cron 表达式，默认每 5 分钟 |
| `githubRawProxyEnabled` | boolean | 是否在 `/zh-CN` 中文页面将 GitHub raw 图片通过 `https://gh-proxy.com/` 加速 |

`mail` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否开启 SMTP 邮件 |
| `host` | string | SMTP Host |
| `port` | number | SMTP 端口 |
| `username` | string | SMTP 用户名 |
| `password` | string | SMTP 密码，后台返回时隐藏 |
| `fromEmail` | string | 发件邮箱 |
| `fromName` | string | 发件名称 |
| `codeExpireMin` | number | 验证码有效分钟数 |
| `templates` | object | 注册、找回密码和 MetaMask 邮箱验证模板 |

邮件模板可用变量：`{{code}}`、`{{email}}`、`{{expireMinutes}}`、`{{siteName}}`、`{{ip}}`、`{{country}}`、`{{region}}`。
