# Render 部署

点击下面按钮即可部署到 Render：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/basketikun/aivro)

## 部署步骤

1. 点击 `Deploy to Render`。
2. 登录 Render，并按页面提示连接 GitHub。
3. 填写 `ADMIN_PASSWORD` 和实际 HTTPS `APP_ORIGIN`，然后点击确认部署。Render 自动生成 `JWT_SECRET`；其他部署方式必须自行配置至少 32 字节的随机密钥。

部署完成后，打开 Render 分配的 `.onrender.com` 域名即可访问。

## 免费版说明

默认使用 Render 免费 Web Service：

- 空闲约 15 分钟后会休眠，下次访问会自动唤醒。
- 免费版本地文件不是持久化存储，SQLite 数据可能在重启、重新部署后丢失。
- 适合体验和演示，不适合长期保存正式数据。

如果要长期使用，建议升级 Render 付费实例并挂载 Persistent Disk，或改用 PostgreSQL。

## 管理员账号

默认管理员用户名：

```text
admin
```

管理员密码是在 Render 部署页面里填写的 `ADMIN_PASSWORD`。

## 代理 IP 与安全配置

Go 只信任 `TRUSTED_PROXY_CIDRS` 指定来源发送的内部 `X-Aivro-Client-IP`，默认仅允许回环地址，适用于 Next 和 Go 在同一容器的部署。分开部署时只填写实际代理地址或网段。

Next 默认删除客户端提交的转发 IP/地区头。只有入口反向代理会覆盖真实 IP 头，且无法绕过该代理直接访问 Next 时，才设置 `TRUSTED_CLIENT_IP_HEADER`。例如 Nginx 使用 `proxy_set_header X-Real-IP $remote_addr`，Next 设置 `TRUSTED_CLIENT_IP_HEADER=x-real-ip`。该头必须只有一个合法 IP，不接受客户端自行提供的列表。请求日志、登录邮件和人机验证弹窗共用这里解析的真实 IP。

可信 IP 头有效时，Next 会把入口提供的国家/地区通过内部头传给 Go。默认只采信 Cloudflare 的 `CF-IPCountry` / `CF-Region`、Vercel 的 `X-Vercel-IP-Country` / `X-Vercel-IP-Country-Region`、CloudFront 的 `CloudFront-Viewer-Country`，以及地区用的 `X-Region`。其他反向代理可用 `TRUSTED_CLIENT_COUNTRY_HEADERS` 和 `TRUSTED_CLIENT_REGION_HEADERS` 指定由入口覆盖的对应头名，多个头名用英文逗号分隔；国家建议提供 ISO 3166-1 两位代码。没有配置真实 IP 头时不会信任客户端自报的国家/地区。后台任务的退款和用量结算流水会沿用任务提交时的 IP 与国家/地区。

未配置可信 IP 头时，代理请求显示未知 IP，国家/地区也无法从 Next 链路推断；登录仍保留账号限流，不启用未知 IP 的共享入口桶，匿名分享密码验证需要先登录。务必设置实际 HTTPS `APP_ORIGIN`。本轮修复未执行构建或部署验证，Docker 静态资源路径仍需单独确认。

启动数据库更新包含 `cloud_file_references`、`video_tasks`、任务 worker/lease 字段及可空的 Stripe session ID。修改遵循当前新设计，未添加旧文件绑定关系或浏览器全局素材数据的迁移兼容逻辑。


## 本轮启动要求

- 缺失或过短的 JWT_SECRET 会拒绝启动；所有实例使用相同随机密钥。退出登录、改密和管理端更新账号会吊销该账号全部旧会话。
- Go 默认只监听 127.0.0.1，容器中由 Next 暴露页面与 API。单独部署 Go 时根据实际网络配置 LISTEN_HOST 和可信代理，避免绕过入口控制。
- 新增限流桶、容量预留和素材归属表，由当前模型自动创建；没有旧数据兼容/清理迁移。多实例限流要求共用同一持久化数据库，独立 SQLite 文件不能合并计数。
- MAX_USER_STORAGE_BYTES 默认 5368709120（5 GiB），包含未删除的上传、生成和任务文件。需要更高额度时显式调整。
- 生产 CSP 改用逐请求 nonce，API 添加 sandbox CSP。上线前验证 CAPTCHA、OAuth、广告、媒体上传及下载；具体场景见 [安全审阅记录](security-review.md)。

## 首页与公开资源缓存

带语言前缀的首页 HTML 使用公开缓存：浏览器 5 分钟、CDN 1 小时，并允许过期后台更新；`/api/settings` 使用短期公开缓存，`/showcase/` 图片使用长期缓存。其他页面、认证、工作流、账户和私有生成接口继续保持 `no-store`。CDN 必须按完整 URL 区分语言及演示素材的版本查询参数，并同时缓存响应头和正文，不能只缓存 HTML 而重新生成 CSP 头。发布新版首页或修改公开设置后，如需立即生效，应主动清理对应首页和公开设置缓存。

## PostgreSQL 验证码唯一索引创建失败

如果更新后应用反复重启，日志出现 `could not create unique index "idx_email_verification_target"` 和 `Key (purpose, target) ... is duplicated`，说明旧版 `email_verifications` 中同一用途、邮箱存在多条记录，新版启动时无法创建联合唯一索引。当前发码已通过 upsert 替换同一目标的验证码；按项目约定不添加启动时旧数据清理逻辑，需要对受影响的数据库执行一次性修复。

在部署的 Compose 目录，把下面整个代码块一次性粘贴到 Bash 执行；如果自定义了数据库用户或库名，把命令中的 `aivro` 改为实际值。SQL 通过标准输入传给 psql，无需进入交互界面；最后一行 `SQL` 必须单独一行且不缩进，命令末尾不要额外添加反斜杠。

事务只删除每组较旧的重复验证码，保留最新记录原有的使用状态、过期时间和尝试次数，用户及其他表不受影响。相同创建时间按 ID 排序选一条；创建索引失败时事务不会提交删除。

```sh
docker compose stop app
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U aivro -d aivro <<'SQL'
BEGIN;
LOCK TABLE email_verifications IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY purpose, target
        ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
    FROM email_verifications
)
DELETE FROM email_verifications AS verification
USING ranked
WHERE verification.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_target
    ON email_verifications (purpose, target);
COMMIT;
SQL
```

输出应包含 `DELETE n`、`CREATE INDEX` 和 `COMMIT`。看到 `COMMIT` 后再启动应用并查看最近日志：

```sh
docker compose start app
docker compose logs --since=2m --tail=100 app
```

确认应用启动成功，再重新获取验证码并测试验证和再次发码；同一 `purpose + target` 应始终只有一条记录，再次发码后旧码应失效。使用本地编排时，上述所有 Compose 命令加上 `-f docker-compose.local.yml`。
