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

Next 默认删除客户端提交的转发 IP/地区头。只有入口反向代理会覆盖真实 IP 头，且无法绕过该代理直接访问 Next 时，才设置 `TRUSTED_CLIENT_IP_HEADER`。例如 Nginx 使用 `proxy_set_header X-Real-IP $remote_addr`，Next 设置 `TRUSTED_CLIENT_IP_HEADER=x-real-ip`。该头必须只有一个合法 IP，不接受客户端自行提供的列表。

未配置可信 IP 头时，代理请求显示未知 IP，登录仍保留账号限流，不启用未知 IP 的共享入口桶；匿名分享密码验证需要先登录。务必设置实际 HTTPS `APP_ORIGIN`。本轮修复未执行构建或部署验证，Docker 静态资源路径仍需单独确认。

启动数据库更新包含 `cloud_file_references`、`video_tasks`、任务 worker/lease 字段及可空的 Stripe session ID。修改遵循当前新设计，未添加旧文件绑定关系或浏览器全局素材数据的迁移兼容逻辑。


## 本轮启动要求

- 缺失或过短的 JWT_SECRET 会拒绝启动；所有实例使用相同随机密钥。退出登录、改密和管理端更新账号会吊销该账号全部旧会话。
- Go 默认只监听 127.0.0.1，容器中由 Next 暴露页面与 API。单独部署 Go 时根据实际网络配置 LISTEN_HOST 和可信代理，避免绕过入口控制。
- 新增限流桶、容量预留和素材归属表，由当前模型自动创建；没有旧数据兼容/清理迁移。多实例限流要求共用同一持久化数据库，独立 SQLite 文件不能合并计数。
- MAX_USER_STORAGE_BYTES 默认 5368709120（5 GiB），包含未删除的上传、生成和任务文件。需要更高额度时显式调整。
- 生产 CSP 改用逐请求 nonce，API 添加 sandbox CSP。上线前验证 CAPTCHA、OAuth、广告、媒体上传及下载；具体场景见 [安全审阅记录](security-review.md)。
