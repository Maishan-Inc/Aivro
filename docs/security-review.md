# 安全报告审阅与修复记录

本次对照用户提供的报告审阅 `main.go`、`router/`、`middleware/`、`handler/`、`service/`、`repository/`、`model/`、`web/src/`、`web/next.config.ts`、`Dockerfile`、`docker-entrypoint.mjs` 和 `render.yaml` 的相关请求链路。下文区分代码中确认的问题、已实现的修复和部署边界，不把静态阅读当作渗透测试结论。

按项目要求，本轮未运行语法检查、类型检查、测试、构建或部署。所有改动需要按 [待测试](pending-test.md) 和文末场景实际验证。

## 高危类别复核后的补充修复

此次继续检查用户列出的全部类别。确认并修复代码与依赖版本中的缺口；没有可确认的攻击链时，不把类别名或依赖告警直接当作已发生的高危漏洞。

| 补充发现 | 本轮改动 |
| --- | --- |
| Next 与原生图片处理依赖版本落后 | Next 升级至 16.4.5，锁定的 Sharp 为 0.35.5，覆盖本轮查到的 Windows RCE、图片解码 RCE、middleware 绕过及 nonce 相关修复；项目未使用 Next 图片优化，设置 `images.unoptimized` 关闭 `/_next/image`。Windows、glibc、解码器、缓存和 Server Actions 等公告前提不同，版本命中不代表每条攻击链均可利用 |
| 前端间接依赖告警 | Axios 1.21.0、Nanoid 5.1.16；为 baseline-browser-mapping、follow-redirects、PostCSS、source-map-js、Prism 指定修复版本并由 Bun 重建锁文件。移除只通过 CSS 引用的 shadcn CLI，保留实际用到的三个状态变体，移除其无关服务器工具和无修复版 deepmerge 依赖链 |
| Go 依赖与工具链告警 | Go 工具链 1.26.10；升级 Gin 1.12.0、go-ethereum 1.17.10、pgx 5.9.2、quic-go 0.59.1、compress 1.20.3、WebSocket、gRPC 及相关依赖；x/crypto 0.58.0、x/net 0.62.0、x/text 0.43.0。依赖图中 go-jose 与 Goldmark 也更新至修复版。数据库占位符、网络协议和签名相关行为仍须实际回归 |
| 修改分享密码后旧访问凭证仍有效 | 分享 JWT 增加版本、issuer、audience 与 subject 校验；新密码沿用账号密码强度规则。更新分享后旧凭证失效，预览及复制共用校验；复制事务再次锁定当前有效版本，避免状态变化后继续扣费复制 |
| 提示词、素材的登录限制仅在客户端生效 | service 在读数据和提示词缓存之前检查当前开关与中间件验证的用户。管理端列表保持独立鉴权入口。删除提示词公开缓存头和代理中强制公开缓存的分支，成功与失败响应均沿用 no-store |
| CSP nonce 与共享首页缓存 | 所有 nonce HTML（含首页）使用 no-store；保留构建资源和演示图的静态缓存。入口需清除旧 HTML/API 缓存并遵守响应头 |
| CAPTCHA 未绑定足够的站点信息 | hCaptcha Siteverify 提交配置的 sitekey；Turnstile 校验返回的 hostname 与可信站点。hCaptcha 文档明确 hostname 来自浏览器，故不把该字段用于认证。验证请求继承请求取消、15 秒超时、HTTP 状态与响应体长度限制，继续默认拒绝验证失败 |
| 公开管理员示例密码可直接使用 | 删除配置与环境示例中的可用密码；新数据库首次启动必须显式提供独立密码，两个公开默认密码不随用户名变更而放行。已有管理员重启不自动重置密码；后台设置和登录同样拒绝默认密码 |
| 素材 ZIP 与 JSON 缺少资源和结构边界 | 使用 fflate 流式解压、实际输出字节上限及路径/数量检查；Zod 校验清单和素材结构，在上传前检查引用、MIME、大小及重复项；上传最多并行三个。媒体只使用新上传的本站文件地址，封面限制为 HTTP/HTTPS 与位图 data 预览，错误提示覆盖六语言 |

依赖公告复查结果：当前 `web/bun.lock` 的 498 个包版本条目在 OSV 查询中没有命中已公开告警。Go 模块图连同所选标准库查询仍命中 `GO-2026-5932` 与 `GO-2026-5781`：前者针对未维护的 `x/crypto/openpgp`，当前业务仅使用同模块的 bcrypt 等维护包；后者为 `rsc.io/pdf`，`go mod why -m` 确认主模块无需该包。没有把未调用的模块改报成可利用漏洞，也没有通过不稳定版本或手写底层实现隐藏告警。模块版本查询不证明符号可达性，公告库也可能滞后；未来新增这些包的调用必须重新审阅。

公告参考：[Next Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)、[图片优化解码 RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)、[nonce 与共享缓存](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q)、[OpenPGP 包告警](https://osv.dev/vulnerability/GO-2026-5932)、[未使用的 PDF 包告警](https://osv.dev/vulnerability/GO-2026-5781)。验证码行为依据 [Turnstile 服务端校验](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) 与 [hCaptcha 文档](https://docs.hcaptcha.com/)。

| 用户要求覆盖的类别 | 本轮复核状态 |
| --- | --- |
| Brute Force | 保留数据库共享限流、账号归一和 bcrypt；分享密码增加强度与版本绑定 |
| Command Injection | 未确认应用执行用户输入的 shell 路径；受影响的框架与解码依赖已升级，不能将框架 RCE 与应用 shell 注入混为一类 |
| CSRF | 保留 Cookie 修改请求的可信 Origin/Referer 校验及独立 webhook 签名 |
| File Inclusion | 未确认用户可控 include；沿用本地文件最终路径、归属与访问凭证校验 |
| File Upload | 保留 MIME 检查与账号配额；补齐导入包资源边界，关闭未使用的图片优化入口 |
| Insecure CAPTCHA | 补齐供应商站点绑定、状态与超时校验；有效票据仍不能代替账号和资源权限 |
| SQL Injection / SQL Injection (Blind) | 已审阅查询仍用参数绑定；升级存在占位符处理公告的 pgx，未证实业务查询存在经典或盲注攻击链 |
| Weak Session IDs | 沿用登录 JWT 的算法、过期、密钥与版本吊销；分享凭证新增独立用途和版本约束 |
| XSS (DOM) / XSS (Reflected) / XSS (Stored) | 保留 JSX 转义、API 输出头/MIME 约束与 nonce CSP；导入 JSON 不能保留可执行媒体地址，升级相关依赖。未运行浏览器攻击验证 |
| CSP Bypass | 修复 nonce HTML 共享缓存，升级已公布的框架修复；生产仍保留界面必要的样式权限 |
| Java Script | 按不可信脚本执行、URL 与前端依赖风险处理；JavaScript 本身不是独立漏洞名称 |
| Authorisation Bypass | 提示词与素材登录开关落实到 service，分享复制受当前版本和状态约束；沿用角色与资源所有者校验 |
| Open HTTP Redirect | 沿用前后端一致的本站路径白名单、解码与协议检查，未新增任意外站回跳 |

## 风险与处理

| 报告项 | 审阅结论与处理 |
| --- | --- |
| 上游 Set-Cookie / 任意响应头 | 确认风险。所有 AI 转发、任务回放和文件响应使用固定头白名单；上游 Cookie、跳转及策略头不能覆盖本站会话或安全策略。Next 仅允许本站认证路径设置 Cookie |
| 任务载荷 / 视频同源 HTML | 确认风险。未知 MIME 改为 octet-stream 附件；任务对象统一保存为二进制，任务结果再次过滤 MIME。视频落库前校验内容特征，API CSP 额外禁止脚本和沙箱逃逸 |
| 页面 CSP 与 API 安全头 | 生产脚本策略采用逐请求 nonce 与 strict-dynamic，移除生产 unsafe-inline / unsafe-eval；API 加独立 CSP、nosniff、DENY、no-referrer 和权限策略，HTTPS 页面加 HSTS |
| 共享 IP 桶与内存限流 | 改为数据库事务计数，没有未知 IP 共用桶。用户名/邮箱归一到用户 ID，管理登录与普通登录共用基础限额。登录、发码、验证与存储计数跨共用数据库的实例生效 |
| CAPTCHA fail-open | 确认并修复。启用但配置缺失直接拒绝，保存配置时也校验；MetaMask challenge 和分享密码增加验证，删除未使用的注册邮箱探测接口 |
| 分享密码全局 DoS | 改为分享 ID + IP；缺少可信 IP 时使用登录用户 ID，匿名访问须登录。Fork 必须使用验证产生的访问 token；签名算法显式限定 HS256 |
| asset-files 任意 ID 引用 | 增加服务端分配的素材归属 ID，更新时验证所有者；单条文件数、素材条数、请求频率和账号总文件容量均受限。任务载荷不得被素材或工作流长期引用 |
| 上传资源滥用 | 读取上传请求体前按用户限流；实际写文件另限流。总容量计算包含仍保留的文件及并发预留，默认 5 GiB。文件名限制 UTF-8 字节长度，实际落盘路径校验 IsLocal |
| 管理端直接篡改算力流水 | 下线原始保存/删除接口及前端封装。仍允许已授权的业务余额调整，由原有事务同时修改余额并追加流水 |
| 登出不能吊销 token | 登出递增 token_version，旧 Cookie/Bearer JWT 均失效；改密与管理员更新账号同样吊销。当前登出语义是该账号所有设备退出 |
| 管理模型渠道 SSRF | 保存和测试拒绝非公网地址；模型转发连接时重新校验 DNS 解析出的 IP，关闭环境 HTTP 代理和自动重定向，非 2xx 视为失败。禁止环回、私网、链路本地及保留网段 |
| 弱密钥 / 多实例随机密钥 | 不再每次启动生成临时密钥；JWT_SECRET 缺失或不足 32 字节拒绝启动。所有实例必须使用同一随机密钥。会话校验 issuer/audience/HS256/exp，增加 jti |
| CSRF | Cookie 修改请求校验 Origin/Referer，按站点与允许来源放行。无 Origin 且无 Cookie 的 Bearer 服务调用保留，webhook 使用独立签名验证 |
| 日志泄露 | AI 错误不再打印响应正文，相关失败仅记录状态码/错误类型；GORM 日志启用参数隐藏，减少 SQL 参数中的提示词、验证码和密钥泄露 |
| 跳转与账号枚举 | 前后端共享一致的路由范围与解码策略，拒绝控制字符、反斜杠、嵌套编码路径和 API 资源路径。发码不返回邮箱存在性，登录不存在账号也执行 bcrypt 比较 |
| LIKE 通配符放大 | 搜索参数仍使用 GORM 参数绑定，并转义 `%`、`_` 与转义符；OAuth JSON 查找同步采用明确的 ESCAPE 字符 |

## 对原报告的校正

| 类别 | 判断 |
| --- | --- |
| Command Injection | 报告列出的 Go 路径未发现 shell 拼接执行；容器入口启动固定程序和参数，也不通过 shell 执行用户输入 |
| SQL Injection / Blind SQL Injection | 已审阅路径使用绑定参数，未确认注入；LIKE 通配符是查询行为及资源问题，邮箱枚举属于信息泄露，不能等同 SQL 注入 |
| File Inclusion | 没有确认用户控制的动态 include；本轮同时加强本地文件最终路径检查。S3 对象键与本地文件系统路径应分别评估 |
| DOM / Reflected XSS | 已审阅 UI 的文本仍通过 JSX 转义，未确认报告列出的经典 DOM 执行入口；这不能推导任意依赖或未来新增代码都无 XSS |
| Stored XSS | 重点是同源 API 输出上游 HTML 的路径，而不是 React 文本渲染；此次分别限制输出 MIME、响应头和 API 文档能力 |
| Weak Session IDs | HS256 JWT 是签名令牌，并不是“强随机会话 ID”。核心问题是密钥质量、签发约束与吊销，已分别处理 |
| OAuth state | nonce 与 HttpOnly Cookie 绑定（本轮 HTTPS state Cookie 也改为 __Host 前缀），加上服务端一次性 authorization code 交换，不等于天然缺少 CSRF 防护；无需仅因回调使用 GET 就重写协议。回跳继续经过服务端白名单 |
| File Upload | 先前视频声明类型没有像位图那样严格核对内容特征；本轮补齐视频检测及 GLB 标识、glTF JSON 校验。内容嗅探不是完整媒体解码或恶意文件扫描 |
| CSP “完全失效” | 原策略仍有限制 framing/object/base 等作用，但放行内联脚本和 eval 严重削弱脚本注入防线。改为 nonce 后仍需审阅所有被信任脚本和依赖 |
| 客户端权限绕过 | 页面访问开关只是界面控制；数据资源继续依靠服务端身份、角色和资源归属校验。今后新增 SSR 数据读取也必须做服务端鉴权 |

## 部署与保留边界

- JWT_SECRET 至少 32 字节且应由安全随机源生成；长度检查不能证明密钥有足够熵。HTTPS 使用 `__Host-aivro_auth`，本地 HTTP 开发保留普通 Cookie。没有为非标准 Cookie Priority 单独扩展协议代码。
- 配置真实 HTTPS APP_ORIGIN；允许来源只填受信站点。Go 默认监听 127.0.0.1，容器入口固定内部监听。TRUSTED_CLIENT_IP_HEADER 只能取由可信代理覆盖的单个 IP 头，并在网络层禁止绕过该代理直连 Next；仅配置一个头名不会自动使它可信。
- 共享数据库负责应用限流；大规模流量仍需要入口代理限额。独立 SQLite 和 Render 临时磁盘不提供多实例共享或数据持久化保证。此次没有宣称 Docker / Render 生产部署已经验证。
- 生产 CSP 保留 Ant Design 所需的内联样式；connect-src 保留本站、Blob/data 和 CAPTCHA/广告所需域名，图片/视频仍可展示 HTTPS 素材。没有强开 Trusted Types、COOP 或 CORP，以免未经验证就破坏 OAuth 弹窗、广告或媒体流程；这些不能替代本次已加的 XSS 主防线。
- 当前模型 API Key 由服务端私有设置保存。浏览器“我的素材”列表仍是 localforage；后端素材登记不是完整素材云同步，清空本地列表不会自动释放登记，容量上限仍生效。
- 文件访问 URL 中的 accessToken 是持有者凭证。保留现有接口形式，应用访问日志脱敏且响应 no-referrer；反向代理、浏览器历史和用户主动分享仍需按凭证管理。
- 撤销分享阻止后续访问和复制；已取得的文件链接、已下载文件和已 Fork 内容不能被追溯收回，其他有效引用会继续保留文件。
- 退出登录使全账号 token_version 改变，不提供按设备逐个撤销的会话管理。仅生成 jti 并不等于实现 jti 黑名单。
- 发码接口统一文案，SMTP 成功、失败及发送耗时仍可能不同；本轮没有实现异步邮件队列或保证网络层恒定时间。
- 管理员仍是受信高权限主体，可以调整余额、角色和模型渠道；此次关闭的是直接编辑账本和渠道内网访问，不新增多级管理员治理系统。

## 人工验证场景

1. 恶意上游返回 Set-Cookie、Location、CSP、CORS 和 text/html：直接响应、排队结果和文件链接均不改变登录态、不执行脚本；合法 JSON/SSE、位图、视频仍正常。
2. 生产模式确认 HTML 脚本 nonce 与 CSP 一致，登录、CAPTCHA、广告、图片上传/crop、工作台与多语言路由可用；API 返回 sandbox CSP。
3. 相同账号交替使用用户名/邮箱及普通/管理登录，计数共享；不同 IP 访问同一密码分享不互相封禁；两实例连接同一数据库后计数一致。
4. 缺 CAPTCHA 密钥、错误/过期/重复 token、MetaMask challenge 重放、分享 Fork 绕过验证均被拒绝；有效流程可完成。
5. 连续重发邮件使旧码失效，并发试码仍遵守单码和目标限额；发码回复不直接暴露账号是否存在。
6. 第三方站点带 Cookie 修改请求被拒绝，本站和已配置来源可操作；真实 OAuth 与支付/KYC webhook 回调正常。
7. 任意素材 ID、其他账号 ID、无权文件、任务载荷引用被拒绝；并发接近配额上传不超限，失败后预留释放；删除一个用途不破坏另一用途。
8. 改密、封号、登出后重放旧 JWT 失败；合法余额调整追加流水，原始流水 POST/DELETE 不再可用。
9. 渠道指向环回、内网、元数据地址、DNS 私网解析或跳转目标均失败；合法公网渠道、失败回退及退款仍工作。
10. 代码边界改动应在 SQLite、MySQL、PostgreSQL 分别验证事务、唯一约束、时间字段和 LIKE 转义。未通过实际验证前不将此记录视为上线安全认证。
