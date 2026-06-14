# AI 队列与限流系统部署指南

## 概述

Edge-Fast-Image-Queue 已集成按模型独立队列与每分钟限流功能，支持：
- **按模型限流**：每个 AI 模型独立配置每分钟请求数上限
- **排队机制**：超过限流的请求进入队列，前端显示排队位置
- **点数管理**：排队时先扣点，取消/失败自动返还
- **数据库兼容**：支持 SQLite（单实例）、PostgreSQL、MySQL
- **Redis 预留**：为后续高并发场景预留 Redis 加速支持

## 数据库支持矩阵

| 数据库 | 单实例 | 多实例 | 推荐场景 | 配置复杂度 |
|--------|--------|--------|----------|-----------|
| **SQLite** | ✅ | ❌ | 本地开发、轻量部署 | ⭐ 最简单 |
| **PostgreSQL** | ✅ | ✅ | 生产环境、团队使用 | ⭐⭐ 简单 |
| **MySQL** | ✅ | ✅ | 现有 MySQL 基础设施 | ⭐⭐ 简单 |

**多实例注意**：
- SQLite 不支持多实例（写锁冲突）
- PostgreSQL/MySQL 多实例需要分布式锁或 Redis 队列后端

## 快速开始

### 1. PostgreSQL 模式（推荐生产环境）

**默认配置**，开箱即用：

```bash
# 复制环境配置
cp .env.example .env

# 修改 .env 中的敏感配置
# - ADMIN_PASSWORD: 管理员密码
# - JWT_SECRET: JWT 密钥（至少 32 字节随机字符串）

# 启动服务（自动创建 PostgreSQL 容器）
docker compose up -d

# 查看日志
docker compose logs -f app
```

访问 `http://localhost:3982` 即可使用。

### 2. SQLite 模式（本地开发）

**适合单用户本地使用**，零依赖：

```bash
# 1. 编辑 .env
nano .env

# 2. 注释掉 PostgreSQL 配置
# STORAGE_DRIVER=postgres
# DATABASE_DSN=postgres://...

# 3. 启用 SQLite 配置
STORAGE_DRIVER=sqlite
DATABASE_DSN=data/aivro.db

# 4. 编辑 docker-compose.yml，注释掉 db 服务和 depends_on
# 或使用单容器启动
docker run -d \
  --name aivro \
  -p 127.0.0.1:3982:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  maishanhub/aivro:main
```

## 队列配置

### 管理后台配置

1. 访问 `http://localhost:3982/admin/settings`
2. 找到 **AI 队列/按模型限流** 区域
3. 配置参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **启用队列** | true | 关闭后所有请求立即执行，不限流 |
| **默认每分钟请求数** | 50 | 未单独配置的模型使用此值 |
| **单用户最大排队数** | 20 | 防止单用户提交大量任务占满队列 |
| **任务保留小时** | 24 | 超过此时间的已完成任务自动清理 |

### 按模型单独限流

点击 **新增模型限流**，设置特定模型的每分钟请求数：

```
模型: grok-beta
每分钟请求数: 10
```

这样 `grok-beta` 模型将独立限流为 10/min，其他模型仍使用默认 50/min。

### 队列行为说明

**立即执行场景**：
- 队列功能关闭时
- 聊天接口（`/chat/completions`）始终立即执行，保持流式输出
- 模型当前分钟配额未用完

**进入队列场景**：
- 模型当前分钟请求数达到上限
- 用户点数在排队时立即扣除
- 前端显示"排队中，前方 N 位"

**取消排队**：
- 仅排队中任务可撤销
- 点数自动返还
- 后续任务位置前移

## 性能优化

### 数据库索引

系统已自动创建以下复合索引：

```sql
-- 队列调度优化
CREATE INDEX idx_generation_tasks_queue_dispatch 
  ON generation_tasks(model, status, created_at, id);

-- 用户排队数统计
CREATE INDEX idx_generation_tasks_user_queue 
  ON generation_tasks(user_id, status);

-- 过期任务清理
CREATE INDEX idx_generation_tasks_cleanup 
  ON generation_tasks(status, finished_at);

-- 请求/响应对象引用
CREATE INDEX idx_generation_tasks_payload_files
  ON generation_tasks(request_file_id, response_file_id);
```

这些索引在首次启动时自动创建，无需手动干预。

### Redis 加速（第二阶段预留）

当前版本使用数据库队列，支持单实例高并发。如需多实例部署或进一步优化，可启用 Redis：

**限制**：
- ✅ 仅支持 PostgreSQL/MySQL
- ❌ 不支持 SQLite

**启用步骤**：

1. **编辑 docker-compose.yml**，取消注释 Redis 服务：
   ```yaml
   redis:
     image: redis:7-alpine
     container_name: aivro-redis
     command: redis-server --appendonly yes
     volumes:
       - redis_data:/data
     restart: unless-stopped
   
   volumes:
     redis_data:
   ```

2. **编辑 .env**，配置 Redis 连接：
   ```bash
   REDIS_URL=redis://redis:6379/0
   ```

3. **重启服务**：
   ```bash
   docker compose up -d
   ```

4. **管理后台配置**：
   - 访问 `http://localhost:3982/admin/settings`
   - 找到 **AI 队列/按模型限流**
   - 将 **队列后端** 改为 `redis`
   - 保存设置

**注意**：第一版 Redis 后端功能为预留状态，配置界面已存在但运行时仍使用数据库队列。完整 Redis 实现将在第二阶段完成。

## 数据清理

### 自动清理

系统约每 10 分钟自动清理超过保留时间的已完成任务：
- 状态为 `succeeded`、`failed`、`canceled`
- `finished_at` 超过配置的保留小时数（默认 24 小时）
- 先删除 `request_file_id`、`response_file_id` 对应的 `cloud_files.file_type=task` 对象，再删除任务行

### 手动清理

如需立即清理，优先通过应用内清理逻辑执行，避免只删除 `generation_tasks` 行导致请求/响应对象文件残留。

### 数据库维护

**SQLite**：
```bash
# 定期压缩数据库
sqlite3 data/aivro.db "VACUUM;"
```

**PostgreSQL**：
```bash
# 进入容器
docker exec -it aivro-db psql -U aivro

# 分析表统计
ANALYZE generation_tasks;

# 清理死元组
VACUUM generation_tasks;
```

## 监控与运维

### 队列状态查询

**查看当前排队任务**：
```sql
SELECT model, COUNT(*) as queued_count 
FROM generation_tasks 
WHERE status = 'queued' 
GROUP BY model;
```

**查看执行中任务**：
```sql
SELECT model, COUNT(*) as executing_count 
FROM generation_tasks 
WHERE status = 'executing' 
GROUP BY model;
```

**查看某分钟模型请求数**：
```sql
SELECT model, COUNT(*) as dispatched 
FROM generation_tasks 
WHERE started_at >= '2026-06-06T08:30:00Z' 
  AND started_at < '2026-06-06T08:31:00Z'
GROUP BY model;
```

### 日志监控

```bash
# 查看队列调度日志
docker compose logs -f app | grep "generation queue"

# 查看任务失败日志
docker compose logs -f app | grep "queued AI task failed"

# 查看返还日志
docker compose logs -f app | grep "refund"
```

### 故障恢复

**进程重启后**：
- 所有 `executing` 任务自动标记为 `failed`
- 点数自动返还
- `queued` 任务继续排队，不受影响

**手动恢复卡死任务**：
```sql
-- 标记长时间执行中的任务为失败
UPDATE generation_tasks 
SET status = 'failed', 
    error = '任务执行超时', 
    finished_at = CURRENT_TIMESTAMP 
WHERE status = 'executing' 
  AND started_at < datetime('now', '-10 minutes');
```

然后手动执行点数返还（需通过管理后台或 API）。

## 前端集成

### 图片生成排队 UI

前端已自动支持队列，无需额外配置：
- 立即执行：显示生成动画
- 排队中：显示"排队中，前方 N 位"，每 2 秒轮询更新
- 执行中：显示生成动画
- 完成/失败：显示结果或错误

### 视频生成排队 UI

**注意**：视频页面队列 UI 尚未完全接入，当前版本视频请求排队后前端会一直显示"生成中"，直到队列执行完成。

完整集成计划在后续版本完成。

### 聊天接口特殊处理

聊天接口始终绕过队列，保持流式输出：
- 不受限流配置影响
- 立即扣点并执行
- 失败时自动返还点数

## 常见问题

### Q1：为什么聊天不排队？
**A**：聊天需要实时流式输出，排队会影响用户体验。第一版设计为聊天立即执行，图片/视频支持排队。

### Q2：队列禁用后还会创建任务记录吗？
**A**：不会。队列禁用时完全绕过队列逻辑，保持旧版直连行为。

### Q3：如何查看用户的排队任务？
**A**：用户可访问 `/api/v1/generation-tasks` 查看自己的最近 50 个任务。管理员可通过数据库查询。

### Q4：多实例部署需要注意什么？
**A**：
- 必须使用 PostgreSQL 或 MySQL（不能用 SQLite）
- 第一版只支持单实例，多实例会导致任务重复调度
- 多实例支持需实现 Redis 队列后端或分布式锁（第二阶段）

### Q5：任务保留时间改为 0 会怎样？
**A**：清理逻辑要求保留时间 ≥ 1 小时，配置 0 会被自动标准化为 24 小时。

## 升级说明

### 从旧版本升级

首次启动队列版本时：
1. 自动创建 `generation_tasks` 表
2. 自动创建优化索引
3. 无需手动迁移数据
4. 旧版行为保持兼容（队列默认启用但不影响现有功能）

### 数据库迁移验证

```bash
# 查看数据库状态
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3982/api/v1/admin/database-status

# 检查 generation_tasks 表是否存在
docker exec -it aivro-db psql -U aivro -c "\d generation_tasks"
```

## 技术架构

### 队列流程

```
用户请求
  ↓
读取配置（每分钟限流 N）
  ↓
检查当前分钟已 dispatch 数
  ├─ < N：立即执行，返回结果
  └─ ≥ N：创建 queued 任务，返回 taskId
       ↓
    调度器每秒扫描
       ↓
    标记 executing，异步执行
       ↓
    成功：保存结果
    失败：返还点数
```

### 数据库设计要点

- **状态机**：`queued` → `executing` → `succeeded/failed/canceled`
- **队列位置**：按 `(model, status, created_at, id)` 排序
- **限流窗口**：按分钟截断的 `started_at` 计数
- **点数账务**：`queued` 时扣除，`failed/canceled` 时返还

### 并发安全

- **单进程调度**：`sync.Mutex` 保护调度器
- **乐观锁**：`MarkQueuedTaskExecuting` 使用 `WHERE status = 'queued'` 条件更新
- **幂等返还**：返还失败只记录日志，不阻塞后续流程

## 贡献指南

队列系统涉及以下关键文件：

**后端**：
- `model/generation_task.go` - 数据模型
- `repository/generation_task.go` - 数据库操作
- `repository/db_indexes.go` - 索引创建
- `service/generation_queue.go` - 队列核心逻辑
- `handler/generation_task.go` - API 接口

**前端**：
- `web/src/services/api/image.ts` - 图片 API（已完成）
- `web/src/app/(user)/image/page.tsx` - 图片 UI（已完成）
- `web/src/services/api/video.ts` - 视频 API（已完成）
- `web/src/app/(user)/video/page.tsx` - 视频 UI（待完成）

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目遵循与主项目相同的许可证。
