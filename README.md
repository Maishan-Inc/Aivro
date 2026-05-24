# Edge-Fast-Image-Queue

基于 Cloudflare Workers 边缘运行时的图片生成排队系统，面向高并发、抗滥用、可后台配置、支持第三方登录和优先队列的图片生成站点。

> 核心目标：用 Cloudflare 边缘能力承载图片生成入口，用 Durable Objects 做强一致排队协调，用 D1 保存业务数据，用 R2 保存图片结果，用后台动态调整模型、队列和第三方配置。

## 功能范围

- Cloudflare Workers + Hono API 服务
- Cloudflare Static Assets 前端页面（首页 + 后台）
- Durable Object 全局队列协调器，支持优先级重排
- D1 SQLite 业务库，含审计日志、封禁、OAuth、密钥存储
- R2 图片结果存储
- OpenAI 兼容图像 API 封装
- Google OAuth / Linux.DO OAuth 登录
- Linux.DO 优先级 > Google > Guest（管理员后台可调）
- 前 50 名保护区严格 FIFO，超阈值后优先用户从第 51 位插入
- 同一登录用户、同一设备、同一 IP 同时只允许一个 active job
- Turnstile / hCaptcha 人机验证骨架
- AdSense 合规位接入骨架
- CSP / CORS / 基础安全头
- 管理后台 API（队列控制、用户管理、封禁、配置、密钥、审计日志）

## 技术栈

| 层 | 选型 |
|---|---|
| Runtime | Cloudflare Workers |
| API | Hono |
| Queue Coordinator | Durable Objects (SQLite-backed) |
| 数据库 | Cloudflare D1 |
| 对象存储 | Cloudflare R2 |
| 前端 | 原生 HTML/CSS/JS（设计规范见 `getdesign.md`） |
| Auth | OAuth2 / OIDC（Google、Linux.DO） |
| 图像服务 | OpenAI 兼容 Image API |
| 测试 | Vitest |

---

## 部署教程

> 这一节是从零部署到 Cloudflare 的完整流程。如果只是本地起开发服务器，跳到[本地开发](#本地开发)。

### 0. 前置条件

- Node.js ≥ 20
- npm（或 pnpm / yarn，下文以 npm 为例）
- 已注册 Cloudflare 账号
- 一个可用的图像 API Key（OpenAI 或兼容服务）
- 可选：Google Cloud / Linux.DO 的 OAuth 应用、Cloudflare Turnstile 站点密钥

### 1. 克隆项目并安装依赖

```bash
git clone https://github.com/YOUR_ORG/Edge-Fast-Image-Queue.git
cd Edge-Fast-Image-Queue
npm install
```

`wrangler` 会随 devDependencies 一起装上，无需单独全局安装。

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会打开一次授权页，授权后回到终端。

### 3. 创建 Cloudflare 资源

> 资源名称必须与 `wrangler.jsonc` 一致；如果你用了不一样的名字，在第 4 步同步修改。

#### 3.1 创建 D1 数据库

```bash
npx wrangler d1 create edge-fast-image-queue-db
```

输出末尾会得到一段：

```jsonc
{
  "binding": "DB",
  "database_name": "edge-fast-image-queue-db",
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

记下 `database_id`，第 4 步要用。

#### 3.2 创建 R2 存储桶

```bash
npx wrangler r2 bucket create edge-fast-image-queue-images
```

R2 不需要把 ID 填进 `wrangler.jsonc`，只用桶名。

#### 3.3 Durable Object

不需要手工创建。`wrangler.jsonc` 里已经声明了：

```jsonc
"durable_objects": {
  "bindings": [{ "name": "QUEUE_COORDINATOR", "class_name": "QueueCoordinator" }]
},
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["QueueCoordinator"] }]
```

`new_sqlite_classes` 是必须的——QueueCoordinator 用 SQLite-backed Durable Object 持久化队列状态。

### 4. 修改 `wrangler.jsonc`

把第 3.1 步的 `database_id` 写进 `d1_databases[0].database_id`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "edge-fast-image-queue-db",
    "database_id": "你的-d1-database-id"
  }
]
```

如果你换了项目名 / 桶名 / DB 名，把 `name`、`bucket_name`、`database_name` 一起改掉。`compatibility_date` 一般不动。

### 5. 准备本地环境变量

```bash
cp .dev.vars.example .dev.vars
```

打开 `.dev.vars` 填值。最少要有：

```env
APP_SESSION_SECRET=用 openssl rand -hex 32 生成
APP_CONFIG_ENCRYPTION_KEY=用 openssl rand -base64 32 生成（必须 32 字节 base64）
ADMIN_BOOTSTRAP_EMAILS=你的管理员邮箱,可填多个用逗号分隔
OPENAI_API_KEY=sk-...
```

> `APP_CONFIG_ENCRYPTION_KEY` 用来 AES-GCM 加密 `secret_settings` 表里的密钥；一旦上线后**不要更换**，否则后台密钥全部解不开。如果非要换，先用旧 key 把所有密钥导出，换 key 后再写回。
>
> `.dev.vars` 不要提交到仓库，已经加进 `.gitignore`。

### 6. 应用数据库迁移

#### 6.1 本地（用于 `wrangler dev`）

```bash
npm run db:local
```

这会把 `migrations/000{1..7}_*.sql` 顺序应用到本地 miniflare D1 实例。

#### 6.2 远程（生产用）

```bash
npm run db:remote
```

每次新增 migration 都要在远程再跑一次。

### 7. 验证

```bash
npm run typecheck
npm test
```

预期：typecheck 没有输出（成功），vitest 报告 19/19 通过。

### 8. 本地预览

```bash
npm run dev
```

打开 http://localhost:8787，能看到首页就 OK。后台在 http://localhost:8787/admin.html。

### 9. 设置生产 Secrets

`.dev.vars` 只对 `wrangler dev` 生效。生产部署需要单独写到 Cloudflare Secrets：

```bash
npx wrangler secret put APP_SESSION_SECRET
npx wrangler secret put APP_CONFIG_ENCRYPTION_KEY
npx wrangler secret put ADMIN_BOOTSTRAP_EMAILS
npx wrangler secret put OPENAI_API_KEY
# 按需追加
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put LINUXDO_OAUTH_CLIENT_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put HCAPTCHA_SECRET_KEY
```

每条命令执行后，wrangler 会要求粘贴值。

### 10. 部署到 Cloudflare

```bash
npm run deploy
```

成功后输出形如：

```
Published edge-fast-image-queue
  https://edge-fast-image-queue.<your-subdomain>.workers.dev
```

把这个 URL 填进 wrangler.jsonc 的 `vars.APP_URL`，再 `npm run deploy` 一次（OAuth 回调会用到）。

### 11. 绑定自定义域名（可选）

在 Cloudflare Dashboard → Workers & Pages → 你的 Worker → Settings → Domains & Routes，添加自己的域名。`APP_URL` 也要改成这个新域名。

### 12. 后台首次配置

部署完后用 `ADMIN_BOOTSTRAP_EMAILS` 里的邮箱登录任一 OAuth 渠道，就会自动获得 admin 角色。然后到后台填：

| 配置 | 写在哪里 | 是否敏感 |
|---|---|---|
| `OPENAI_API_KEY` | secret_settings（后台密钥） | ✅ 加密入库 |
| `OPENAI_BASE_URL` / `OPENAI_IMAGE_MODEL` | app_settings | ❌ |
| `GOOGLE_OAUTH_CLIENT_ID` | app_settings | ❌ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | secret_settings | ✅ |
| `LINUXDO_OAUTH_*` | 同上 | 同上 |
| `TURNSTILE_SITE_KEY` / `CAPTCHA_PROVIDER` | app_settings | ❌ |
| `TURNSTILE_SECRET_KEY` | secret_settings | ✅ |
| `ADSENSE_*` | app_settings | ❌ |
| `SECURITY_ALLOWED_ORIGINS` | app_settings | ❌（仅管理员可见） |
| `QUEUE_*` | app_settings | ❌ |

填完后台→刷新前台。

### 13. OAuth 回调地址

在各家 OAuth 控制台里登记的 Redirect URI 必须是：

```
https://你的域名/api/auth/google/callback
https://你的域名/api/auth/linuxdo/callback
```

本地开发用 `http://localhost:8787/api/auth/...` 即可。

### 14. 部署后自检

```bash
# 看日志
npx wrangler tail

# 健康检查
curl https://你的域名/api/health

# 公开配置
curl https://你的域名/api/config/public
```

健康检查应返回 `{"ok":true,"data":{...}}`。

---

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars      # 然后填值
npm run db:local
npm run dev
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | wrangler dev，本地 8787 |
| `npm run typecheck` | TypeScript 严格检查 |
| `npm test` | Vitest 单元测试 |
| `npm run lint` | ESLint（如有 eslint.config.js） |
| `npm run db:local` | 本地 D1 应用迁移 |
| `npm run db:remote` | 远程 D1 应用迁移 |
| `npm run tail` | 实时查看生产日志 |
| `npm run deploy` | 部署到 Cloudflare |

---

## 重要环境变量

复制 `.dev.vars.example` 后填写：

```env
APP_SESSION_SECRET=change-me
APP_CONFIG_ENCRYPTION_KEY=base64-32-byte-key
ADMIN_BOOTSTRAP_EMAILS=admin@example.com
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_IMAGE_MODEL=gpt-image-1
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
LINUXDO_OAUTH_CLIENT_ID=
LINUXDO_OAUTH_CLIENT_SECRET=
TURNSTILE_SECRET_KEY=
HCAPTCHA_SECRET_KEY=
```

生产用 `wrangler secret put` 写入，不要走 `vars`。详见 `docs/ENV_AND_SECRETS.md`。

---

## 队列规则摘要

- 前 50 名是保护区，任何用户都不能插队进入。
- 等待人数 > `QUEUE_PRIORITY_TRIGGER_LENGTH` 时，Linux.DO / Google 用户从 `QUEUE_PRIORITY_INSERT_START` 开始插入。
- Linux.DO > Google > Guest（admin 始终为 100，最高）。
- 51 位已是优先用户则继续往后找合适位置。
- 被顺延的用户会收到 `delayed` 队列事件。
- 任务执行完成后自动离开队列。
- 同一登录用户在 `queued/running` 状态下只能存在一个任务；匿名用户按 device_id 与 IP 双重限制。

详见 `docs/QUEUE_RULES.md`。

---

## 安全要点

- Cookie：HttpOnly + Secure + SameSite=Lax。
- OAuth state：HMAC 签名 + 单次 nonce + 10 分钟有效期。
- CORS：默认仅同源；额外来源在后台 `SECURITY_ALLOWED_ORIGINS` 配置（逗号分隔）。
- CSP：默认禁用 inline `<script>` 和 `eval`；按需为 Turnstile / hCaptcha / AdSense 放行 host。
- 密钥：根密钥走 Cloudflare Secrets；业务密钥经 AES-GCM 加密落库，前端只看到 masked。
- Bans：可按 user_id / email / ip / device_id 拉黑。
- Audit log：所有后台写操作都会落审计表。

详见 `SECURITY.md`。

---

## 目录结构

```text
.
├── CLAUDE.md                   # AI/Agent 开发约束（强约束，必读）
├── getdesign.md                # 主题与 UI 规范（UI 改动必读）
├── README.md
├── SECURITY.md
├── wrangler.jsonc
├── package.json
├── migrations/                 # D1 SQL 迁移
│   ├── 0001_init.sql
│   ├── 0002_captcha.sql
│   ├── 0003_priority.sql
│   ├── 0004_active_job_indexes.sql
│   ├── 0005_adsense.sql
│   ├── 0006_oauth_raw.sql
│   └── 0007_security.sql
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── ENV_AND_SECRETS.md
│   └── QUEUE_RULES.md
├── public/                     # 前端静态资源
│   ├── index.html
│   ├── admin.html
│   └── assets/
├── src/
│   ├── index.ts                # Worker 入口
│   ├── types.ts
│   ├── durable/                # QueueCoordinator + 纯算法
│   ├── middleware/             # security / cors / requestId
│   ├── routes/                 # health / config / auth / generate / queue / admin / images
│   ├── services/               # config / crypto / oauth / openai / session / bans / auth
│   └── utils/
└── test/                       # Vitest 单元测试
```

---

## 故障排查

| 现象 | 原因 / 排查 |
|---|---|
| `wrangler dev` 启动后访问报 D1 错误 | 没跑 `npm run db:local`；或迁移文件命名顺序错 |
| 部署后 `/api/health` 500 | 大概率是 secret 没设；`npx wrangler tail` 看具体错误 |
| OAuth 回调报 `BAD_STATE` | 回调时跨域漏掉 cookie；确认 `APP_URL` 与回调地址同源、HTTPS |
| OAuth 回调报 `OAUTH_BAD_PROFILE` | provider 没返回 sub/id；查 `oauth_accounts.raw_profile` 看实际字段 |
| 提交生成报 `已有一个生成中的任务` | 同一用户/设备/IP 已有 queued/running，等结束或在后台手动取消 |
| 浏览器 CSP 控制台报错 | 该域名没在 CSP 白名单；改 `src/middleware/security.ts` 或停用 AdSense |
| 跨域 fetch 被拒 | 把来源加进后台 `SECURITY_ALLOWED_ORIGINS` |
| `APP_CONFIG_ENCRYPTION_KEY` 换了之后密钥读不出 | 不可逆；回滚到旧 key 或后台逐项重新填一遍 |

实时日志：

```bash
npx wrangler tail
```

---

## 开发注意

1. 修改 UI 前先读 `getdesign.md`。
2. 修改队列前先读 `docs/QUEUE_RULES.md`，并补/跑 `test/queue.test.ts`。
3. 修改密钥配置前先读 `docs/ENV_AND_SECRETS.md`。
4. 不要把完整密钥返回给前端；只能 masked（如 `sk-****abcd`）。
5. 不要绕开 Durable Object 直接在普通 Worker 里重排队列。
6. 提交前跑 `npm run typecheck && npm test`。

---

## License

私有 / 内部项目，按需补充。
