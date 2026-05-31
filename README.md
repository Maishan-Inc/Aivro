# Aivro 

Aivro 是一个面向 AI 图片、视频和提示词工作流的创作系统。项目提供用户侧工作流画布、图片生成、视频生成、提示词库、素材管理、生成记录，以及管理后台的模型渠道、用户、认证、邮件和系统配置能力。

项目仍处于开发阶段，数据库结构和本地存储格式可能直接调整，不承诺旧数据兼容。当前更适合个人部署、内网部署和二次开发验证。

## 基于什么开发

Aivro 基于以下技术开发：

- 前端：Next.js App Router、React、TypeScript、Ant Design、Tailwind CSS、Zustand、TanStack Query。
- 后端：Go、Gin、GORM。
- 数据库：PostgreSQL，后端结构预留 MySQL 兼容。
- AI 接口：OpenAI 兼容 API，支持配置多个模型渠道。
- 存储：浏览器本地存储、本地数据目录，云存储能力支持 Cloudflare R2 / S3。
- 部署：Docker、Docker Compose。

## 核心功能

- 工作流画布：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- AI 图片创作：文生图、图生图、参考图编辑、生成记录和素材保存。
- AI 视频创作：提示词、参考图、视频参数、生成结果和生成记录。
- 提示词库：提示词分类、标签、预览、收藏和复用。
- 素材库：图片、视频、文本素材的本地保存、导入和导出。
- 管理后台：用户管理、模型渠道、模型算力点、公开配置、私有配置、邮件配置、第三方登录、数据库更新。
- 认证能力：账号密码、邮箱验证码、找回密码、Google、GitHub、Linux.do、自定义 OAuth、MetaMask。
- 云存储：开启后可将生成图片和视频转存到 Cloudflare R2 或兼容 S3。

## 快速开始

复制环境变量文件：

```bash
cp .env.example .env
```

使用 Docker Compose 启动：

```bash
docker compose up -d
```

本地源码镜像构建启动：

```bash
docker compose -f docker-compose.local.yml up -d --build
```

默认访问地址：

```text
http://localhost:3982
```

PostgreSQL 默认只在 Docker 内部网络中提供给应用容器访问，不会映射到宿主机端口。

## 常用入口

- 用户首页：`/`
- 工作流画布：`/canvas`
- 图片创作台：`/image`
- 视频创作台：`/video`
- 提示词库：`/prompts`
- 素材库：`/assets`
- 管理后台：`/admin`

## 文档

- [功能说明](docs/features.md)
- [部署说明](docs/deployment.md)
- [画布节点操作手册](docs/canvas-node-manual.md)
- [画布快捷键](docs/canvas-shortcuts.md)
- [后端数据库说明](docs/backend-database.md)
- [系统配置数据结构](docs/system-settings.md)
- [接口响应约定](docs/api-response.md)
- [待办事项](docs/todo.md)
- [待测试事项](docs/pending-test.md)

## 开源协议

本项目使用 GNU Affero General Public License v3.0，见 [LICENSE](LICENSE)。
