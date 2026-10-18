# Render 部署

点击下面按钮即可部署到 Render：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/basketikun/aivro)

## 部署步骤

1. 点击 `Deploy to Render`。
2. 登录 Render，并按页面提示连接 GitHub。
3. 填写 `ADMIN_PASSWORD`，然后点击确认部署。

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

未配置可信 IP 头时，代理请求显示未知 IP，登录仍保留账号限流与共享入口限流。务必设置实际 HTTPS `APP_ORIGIN`。本轮修复未执行构建或部署验证，Docker 静态资源路径仍需单独确认。

启动数据库更新包含 `cloud_file_references`、`video_tasks`、任务 worker/lease 字段及可空的 Stripe session ID。修改遵循当前新设计，未添加旧文件绑定关系或浏览器全局素材数据的迁移兼容逻辑。
