# 画布数据结构

本文档对应当前代码；本轮变更的人工验证项见 [待测试](pending-test.md)。

## 存储位置

| 数据 | 位置与入口 |
| --- | --- |
| 工作流内容 | 后端 `workflows`，通过 `/api/v1/workflows` 读取和保存；Zustand 只缓存当前列表 |
| 助手会话 | 后端 `canvas_assistant_sessions`，通过工作流的 `/assistant-sessions` 接口按用户和工作流读取 |
| 我的素材列表 | 浏览器 localforage：数据库 `aivro`、store `user_assets`、key `aivro:assets:<ownerId>`；游客 key 为 `aivro:assets:guest` |
| 素材归属登记 | 后端 `user_assets` 只登记 ID、所有者、创建时间；不保存素材内容，也不提供素材列表云同步 |
| 图片、视频、3D 与任务文件 | 本地服务器目录或 S3/R2，元数据在 `cloud_files` |
| 文件保留关系 | 后端 `cloud_file_references`，按工作流、分享、社区作品、生成历史和素材分别保留 |
| 选择、浮层、撤销历史 | 当前页面内存，不持久化 |

不再使用浏览器 `image_files` / `media_files` Blob 存储，也没有 `image:` 前缀和本地清理链路。data URL 与 Blob 仅用于上传、裁剪和请求格式转换，不能作为新的长期文件存储设计。

## 工作流

主要字段与 `CanvasProject` / `CloudWorkflow` 一致：

```ts
type CanvasProject = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  backgroundMode: "lines" | "dots" | "blank";
  showImageInfo: boolean;
  viewport: { x: number; y: number; k: number };
  sourceShareId: string;
  sourceWorkflowId: string;
  sourceSyncMode: "none" | "detached" | "linked";
  sourceVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};
```

工作流 ID 由服务端生成；节点和连线 ID 在前端使用 `nanoid`。`slug` 是公开分享路径中的工作流名称，`title` 是可编辑显示名称。

节点、连线、标题、背景和图片信息开关改变时，页面延迟 600ms 排队保存，并携带当时的视口。单独平移或缩放不触发自动保存，因此只浏览后退出不会记住新的视口。服务端重复保存相同内容不写库；只有视口不同则仅更新 `viewport`，不刷新 `updated_at` 或文件引用。社区的可同步提示比较内容更新时间与发布快照时间。

工作流不再包含 `chatSessions` / `activeChatId`，卡片也不显示虚假的会话数量。真实助手会话通过独立接口保存；分享、社区快照及 Fork 不包含原作者的私有对话。

## 节点与连线

节点保存 `id/type/title/position/width/height/metadata`。当前类型为 `image`、`text`、`config`、`video`。位置和尺寸使用画布世界坐标；图片默认保持原始比例，明确开启自由缩放时才允许变形。

媒体节点常用元数据：

```ts
type MediaMetadata = {
  content?: string;       // 文件展示 URL
  storageKey?: string;    // cloud:<fileId>
  mimeType?: string;
  bytes?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  generationPrompt?: string; // 视频重试使用的完整生成提示词，与编辑草稿分开
  queuePosition?: number;    // 视频当前排队位置，执行或结束后清除
  freeResize?: boolean;
  isBatchRoot?: boolean;
  batchRootId?: string;
  batchChildIds?: string[];
  primaryImageId?: string;
  imageBatchExpanded?: boolean;
};
```

图片组根节点切换主图、删除主图并选取替代图时，同步内容、文件标识、MIME、大小和尺寸，避免展示新图片却保留旧文件引用。原图若仍是组内子节点或被其他数据使用，仍应保留。

连线结构为 `{ id, fromNodeId, toNodeId }`；路径由节点位置和尺寸实时计算。删除节点同时删除相关连线。多选拖动用 Map 保存初始位置，在每帧通过节点 ID 查询。

## 文件读写与保留

1. `uploadImage` / `uploadMediaFile` 通过本站 `/api/v1/files` 上传，服务端检查类型、内容特征、单文件大小、频率和账号总容量。
2. 返回 `url/storageKey/cloudFileId/bytes/mimeType` 等信息，`storageKey` 为 `cloud:<fileId>`。
3. 图片与视频可通过 `/api/files/<fileId>/content` 读取；访问依赖所有权、有效引用或文件访问 token。带 token 的 URL 是访问凭证，不能视为无条件公开地址。
4. 工作流保存、发布和复制在事务内校验文件访问权，并写入各自的引用。任务原始载荷不能作为素材或工作流媒体被长期引用。
5. 我的素材首次保存先由后端分配归属 ID，已有 ID 必须属于当前用户；再写入当前账号的本地列表。失败时回滚已申请的引用。
6. 删除、撤销或到期释放对应引用。仍有其他有效引用的文件继续保留，无引用文件由对应删除流程或定时清理回收。未引用但尚未过期的临时文件不立即删除。

总容量默认每用户 5 GiB，可通过 `MAX_USER_STORAGE_BYTES` 调整；包含上传、生成、任务载荷及仍保留的文件。上传前预留容量，避免并发请求一起越过上限。配额预留与素材归属的表结构见 [数据库说明](backend-database.md)。

撤销范围见 [画布快捷键](canvas-shortcuts.md)。服务端文件引用不包含页面内存中的撤销历史，因此不能承诺文件已被后台回收后仍可通过撤销恢复。
