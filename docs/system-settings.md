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
    "availableModels": ["gpt-5.5", "gpt-image-2"],
    "modelCosts": [
      { "model": "gpt-5.5", "credits": 1 },
      { "model": "gpt-image-2", "credits": 10 }
    ],
    "defaultModel": "gpt-image-2",
    "defaultImageModel": "gpt-image-2",
    "defaultTextModel": "gpt-5.5",
    "systemPrompt": "",
    "allowCustomChannel": true
  },
  "auth": {
    "allowRegister": true,
    "emailVerification": false,
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
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `modelChannel` | object | 模型渠道公开配置组 |
| `auth` | object | 认证相关公开配置 |
| `pages` | object | 前台公开页面内容配置 |
| `pageAccess` | object | 页面访问控制公开配置 |

`modelChannel` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `availableModels` | string[] | 系统可用模型，由管理员手动选择；页面下拉选项可来自私有渠道模型 |
| `modelCosts` | object[] | 模型算力点配置，后端模型接口调用前按模型预扣，上游失败时返还；未配置默认不扣除 |
| `defaultModel` | string | 默认模型，从 `availableModels` 中选择 |
| `defaultImageModel` | string | 默认图片模型，从 `availableModels` 中选择 |
| `defaultTextModel` | string | 默认文本模型，从 `availableModels` 中选择 |
| `systemPrompt` | string | 系统提示词 |
| `allowCustomChannel` | boolean | 是否允许用户在配置弹窗中切换为本地直连渠道，默认允许 |

`modelCosts` 每项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | 模型名称 |
| `credits` | number | 每次后端模型接口调用前预扣的算力点 |

用户侧请求模式：

| 模式 | 说明 |
| --- | --- |
| 云端渠道 | 使用后端 `/api/v1/*` 代理接口，请求会按模型名匹配 `private.value.channels` 中的可用渠道 |
| 本地直连 | 默认可选；`allowCustomChannel` 关闭后不可选，用户在浏览器本地配置 `baseUrl`、`apiKey` 和模型列表后直接请求模型接口 |

`auth` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `allowRegister` | boolean | 是否允许用户注册，默认允许；关闭后注册入口隐藏，注册接口拒绝新用户创建 |
| `emailVerification` | boolean | 是否开启注册邮箱验证码 |
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
    "cron": "*/5 * * * *"
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
    "provider": "r2",
    "endpoint": "",
    "region": "auto",
    "accessKeyId": "",
    "secretAccessKey": "",
    "bucket": "",
    "publicBaseUrl": "",
    "imagePathTemplate": "{username}/images/{yyyy}/{mm}/{dd}/{filename}",
    "videoPathTemplate": "{username}/videos/{yyyy}/{mm}/{dd}/{filename}",
    "imageExpireDays": 7,
    "videoExpireDays": 7,
    "autoCleanupEnabled": true,
    "pathStyleEndpoint": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `channels` | object[] | 模型渠道列表 |
| `promptSync` | object | GitHub 远程提示词定时同步配置 |
| `auth` | object | OAuth、MetaMask 和自定义登录私有配置 |
| `mail` | object | SMTP 验证码与邮件模板配置 |
| `cloudStorage` | object | Cloudflare R2 / S3 兼容云存储配置 |

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
| `enabled` | boolean | 是否开启云存储，默认关闭；关闭时图片、视频生成仍使用原本的浏览器本地存储流程 |
| `provider` | string | 服务商：`r2` 表示 Cloudflare R2，`s3` 表示兼容 S3 |
| `endpoint` | string | S3 兼容 Endpoint；Cloudflare R2 形如 `https://<accountid>.r2.cloudflarestorage.com` |
| `region` | string | Region；R2 默认使用 `auto` |
| `accessKeyId` | string | Access Key ID |
| `secretAccessKey` | string | Secret Access Key，后台返回时隐藏；编辑时留空表示沿用已保存密钥 |
| `bucket` | string | Bucket 名称 |
| `publicBaseUrl` | string | 自定义域名 / Public Base URL；配置后 `public_url` 使用该基地址拼接对象路径 |
| `imagePathTemplate` | string | 图片路径模板，默认 `{username}/images/{yyyy}/{mm}/{dd}/{filename}` |
| `videoPathTemplate` | string | 视频路径模板，默认 `{username}/videos/{yyyy}/{mm}/{dd}/{filename}` |
| `imageExpireDays` | number | 图片默认过期天数，默认 7 天 |
| `videoExpireDays` | number | 视频默认过期天数，默认 7 天 |
| `autoCleanupEnabled` | boolean | 是否启用自动清理，默认开启 |
| `pathStyleEndpoint` | boolean | 是否使用 Path Style Endpoint，R2 默认开启 |

路径模板支持 `{username}`、`{yyyy}`、`{mm}`、`{dd}`、`{filename}`。开启云存储后，后端会把图片和视频生成结果转存到云端，写入 `cloud_files`，并把接口返回内容改为云端 `public_url`；图片和视频过期时间按各自天数分别计算。自动清理只删除已到期且未标记删除的云端对象，删除失败只记录日志。

`promptSync` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | boolean | 是否开启定时同步，默认开启 |
| `cron` | string | Cron 表达式，默认每 5 分钟 |

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
