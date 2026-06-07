# Aivro SEO、国际化路由、登录交付与全站动画系统设计规格

- Status: approved（已批准）
- 批准日期：2026-06-07
- 项目目录：`D:\Github\Edge-Fast-Image-Queue`
- 目标站点：`https://aivro.org`
- 规格范围：继续剩余 SEO 开发、`/zh-CN` 与 `/en-US` 本地化 URL、多语言与多页面 SEO、Google 与 MetaMask 登录交付、登录页第三方按钮间距修正、基于 anime.js 的全站动画替换，并统一为 Aivro 空心描边视觉语言。

## 1. Goals

1. 建立稳定的公开本地化 URL 体系：所有可公开访问的前台页面以 `/zh-CN/...` 与 `/en-US/...` 作为唯一可索引规范 URL 家族，`https://aivro.org` 为唯一生产域名。
2. 在保留当前 middleware rewrite 架构的前提下完成 SEO 加固：统一 canonical、hreflang、Open Graph、Twitter metadata、sitemap、robots、页面标题与描述，消除未本地化 URL 与本地化 URL 之间的重复索引风险。
3. 对现有多页面进行 SEO 分级治理：明确哪些页面可索引、哪些页面仅本地化但不可索引、哪些路径完全不参与本地化与搜索收录。
4. 完成 Google 登录与 MetaMask 登录的前后台闭环：前台入口、服务端配置、授权回调、会话落库、首次登录资料补全、失败提示、安全校验与本地化跳转保持一致。
5. 修正 Google 与 MetaMask 等第三方登录按钮在登录页的视觉间距、图标对齐、层级分组与移动端可点击面积，保证中英文界面一致。
6. 使用 anime.js 替换现有全站动画实现，参考 `D:\Github\MX-Insight-Web` 的动效节奏与空间层次，但视觉上改造为 Aivro 的空心描边、线框、轻量网格与当前字体体系。
7. 形成可执行的设计系统契约：SEO 路由、认证入口、动画原语、可访问性、性能预算与验证门禁均有明确规则。

## 2. Non-goals

1. 本阶段不将应用整体迁移到 `app/[locale]` 目录结构。只有在验证证明 middleware rewrite 无法可靠满足 metadata、服务端渲染或部署平台行为时，才启动受控迁移评估。
2. 本阶段不重构后台管理站点的业务结构，不改变 `/admin`、`/api`、`/_next`、静态资源与文件类路径的未本地化策略。
3. 本阶段不新增未获批准的语言、区域或域名。语言范围固定为 `zh-CN` 与 `en-US`，域名固定为 `https://aivro.org`。
4. 本阶段不引入新的认证提供商。登录交付重点为 Google、MetaMask，并保持已有邮箱密码、注册、找回密码、Linux.do、GitHub 与自定义 OAuth 入口不被破坏。
5. 本阶段不改变 AI 生成、队列、计费、KYC、素材、画布数据模型等核心业务语义。
6. 本阶段不照搬 `MX-Insight-Web` 的品牌样式、色彩或代码实现；只借鉴动效组织方式、层级节奏与页面进入体验。
7. 本规格不包含实现代码。后续实现需在单独实施计划中拆分任务、确认文件级改动与验证命令。

## 3. Current context summary

1. 项目是 Next.js App Router 前端，前台主要位于 `D:\Github\Edge-Fast-Image-Queue\web\src\app\(user)`，根布局位于 `D:\Github\Edge-Fast-Image-Queue\web\src\app\layout.tsx`。
2. 当前已存在初版本地化路由能力：`D:\Github\Edge-Fast-Image-Queue\web\src\i18n\routing.ts` 定义 `zh-CN`、`en-US`、默认语言、路径语言识别、去语言前缀、加语言前缀与未本地化路径判断。
3. 当前 middleware 位于 `D:\Github\Edge-Fast-Image-Queue\web\src\middleware.ts`：未带语言前缀的公开路径会跳转到语言前缀路径；带语言前缀的路径会 rewrite 到内部无前缀路径，并写入 `x-aivro-locale` 与 `x-aivro-pathname` 请求头。
4. 当前 SEO 基础能力位于 `D:\Github\Edge-Fast-Image-Queue\web\src\lib\seo.ts` 与 `D:\Github\Edge-Fast-Image-Queue\web\src\lib\page-metadata.ts`，已具备站点域名、页面元信息、canonical、alternates、Open Graph、Twitter 与 robots metadata 的雏形。
5. 当前已存在 `D:\Github\Edge-Fast-Image-Queue\web\src\app\sitemap.ts` 与 `D:\Github\Edge-Fast-Image-Queue\web\src\app\robots.ts`，但其收录范围、robots 禁止规则与实际页面登录属性需要统一到一份路由分级规则。
6. 当前根布局通过客户端 provider 同步 `<html lang>`，并在 `D:\Github\Edge-Fast-Image-Queue\web\src\components\layout\locale-path-sync.tsx` 中根据路径同步客户端语言。服务端 HTML 初始 lang、metadata 语言与客户端语言需要保持一致，避免抓取与水合期间出现语言不一致。
7. 当前登录页位于 `D:\Github\Edge-Fast-Image-Queue\web\src\app\(user)\login\page.tsx`，支持邮箱密码、注册、找回密码、第三方 OAuth 入口与 MetaMask 入口。页面仍使用 `motion/react` 做局部转场，后续需要替换为 anime.js 统一动效。
8. 当前 MetaMask 首次邮箱绑定页位于 `D:\Github\Edge-Fast-Image-Queue\web\src\app\(user)\metamask-email\page.tsx`，需要纳入本地化跳转、安全载荷处理与统一认证体验。
9. 当前 `web\package.json` 已包含 `animejs` 依赖，同时仍包含 `motion`。后续全站动画替换应以 anime.js 为唯一新增动效基础，并逐步移除页面级对 motion 的依赖。
10. 当前工作区已有大量未提交改动。本规格仅新增目标设计文档，不对业务代码进行实现修改。

## 4. Architecture and route policy

### 4.1 Route architecture

1. 继续采用“公开 URL 带 locale 前缀，内部路由保持现有无 locale 文件结构”的 middleware rewrite 架构。
2. 浏览器地址栏、canonical、sitemap、分享链接与站内导航使用 `/zh-CN/...` 或 `/en-US/...`。内部 Next.js 页面继续由现有 `app/(user)`、`app/(admin)` 与 `app/api` 结构承载。
3. `x-aivro-locale` 是服务端 metadata 与布局语言判断的权威输入；客户端语言 store 只能同步服务端结果，不反向决定 canonical。
4. 未带 locale 的公开前台路径不作为规范 URL。生产环境中访问未本地化公开路径时，应跳转到带 locale 前缀的路径，并保留 search/query 参数。URL hash fragment 不会发送到服务器，middleware 不承诺保留 hash；需要保留 hash 的同页语言切换只由客户端导航处理。
5. locale 选择优先级固定为：已存在且有效的 URL locale > 显式语言切换目标 > 受信任的用户语言偏好/cookie > `/` 的 Accept-Language > 默认语言 `zh-CN`。为避免非首页产生搜索重复，`/pricing`、`/image` 等未本地化公开路径默认跳转到 `zh-CN` 对应路径；只有 `/` 使用浏览器语言偏好。
6. `/api`、`/admin`、`/_next`、`/icons`、`/logo.svg`、`/favicon.ico` 与包含文件扩展名的静态资源路径保持未本地化，且不进入 SEO 路由生成。
7. 登录、注册、找回密码、资料补全、支付成功、MetaMask 邮箱绑定等流程页允许带 locale 前缀以提供语言一致性，但默认不可索引。
8. 私有对象详情页、分享 token 页、用户工作区详情页和任何包含用户数据、临时凭据、签名或 token 的路径不得进入 sitemap，也不得生成可分享或可索引的 SEO metadata。流程型 noindex 页面可输出 self-canonical 或省略 canonical；token、签名、私有详情页一律不输出 hreflang、Open Graph URL 或可传播分享元信息。

### 4.2 Canonical policy

1. 生产 canonical 固定使用 `https://aivro.org`，不依赖请求 Host、代理头或开发环境域名。
2. 每个可索引页面在每种语言下只生成一个 canonical：`https://aivro.org/zh-CN/...` 与 `https://aivro.org/en-US/...`。
3. `x-default` 指向默认语言 `zh-CN` 的对应路径。
4. 页面 metadata、Open Graph URL、sitemap URL 与站内 `<a>` 链接必须使用同一套本地化路径生成规则。
5. query 参数默认不进入 canonical。业务必要的 redirect、token、code、error、session、signature 等参数不得出现在 canonical、sitemap 或可索引分享元信息中。

### 4.3 Cache and rewrite policy

1. 在当前架构稳定前，locale redirect 与 rewrite 响应继续使用 no-store 策略，避免边缘缓存将语言偏好、RSC 状态或登录态错误复用给其他用户。
2. `_next/static`、图标、logo 与 favicon 可保持可缓存，不受 no-store 策略影响。
3. SEO metadata 的生成必须以路由注册表和 locale 为输入，不读取用户会话或客户端 store。
4. 如果后续验证发现 no-store 对公开 SEO 页面性能造成明显影响，应在确认 metadata 与语言稳定后，按“公开可索引页”和“认证流程页”分级调整缓存策略。

## 5. Route classification

### 5.1 Classification principles

1. “本地化”与“可索引”分开判断。一个页面可以有 `/zh-CN` 与 `/en-US` 访问路径，但仍然不可被搜索引擎收录。
2. 可索引页面必须满足：不依赖登录态展示核心内容、不暴露用户数据、不包含一次性 token 或签名、不根据个人配置改变页面主题内容、拥有中英文等价 SEO 文案。
3. 不可索引页面仍需保持语言前缀、可用的页面标题和清晰的 robots 指令，以便用户体验一致且避免重复收录。
4. 完全未本地化路径主要为系统、后台、接口与静态资源，不出现在 sitemap 与 hreflang 中。

### 5.2 Public indexable route family

| 页面 | 公开路径家族 | SEO 定位 | 收录策略 |
| --- | --- | --- | --- |
| 首页 | `/zh-CN`、`/en-US` | Aivro 品牌、AI 无限画布与多模态创作入口 | index, follow |
| 套餐页 | `/zh-CN/pricing`、`/en-US/pricing` | 订阅、算力点、工作流创建次数与购买决策 | index, follow |
| AI 生图入口 | `/zh-CN/image`、`/en-US/image` | AI 图片生成工作台与参考图能力 | index, follow；匿名首屏必须提供稳定介绍、核心 CTA 与隐私安全的能力说明 |
| AI 视频入口 | `/zh-CN/video`、`/en-US/video` | AI 视频生成工作台与参数能力 | index, follow；匿名首屏必须提供稳定介绍、核心 CTA 与隐私安全的能力说明 |
| AI 3D 入口 | `/zh-CN/model-3d`、`/en-US/model-3d` | AI 3D 创作探索入口 | index, follow；匿名首屏必须提供稳定介绍、核心 CTA 与隐私安全的能力说明 |
| 提示词库 | `/zh-CN/prompts`、`/en-US/prompts` | AI 提示词发现、收藏与复用 | index, follow；仅展示公开提示词或稳定营销内容，个人收藏与私有内容不进入首屏 SEO |
| 素材库 | `/zh-CN/asset-library`、`/en-US/asset-library` | 团队素材、创作参考与内容发现 | index, follow；仅展示公开素材库介绍或公开内容，用户个人素材继续放在 `/assets` 并 noindex |
| 隐私政策 | `/zh-CN/privacy`、`/en-US/privacy` | 法务透明度与数据处理说明 | index, follow |
| 服务条款 | `/zh-CN/terms`、`/en-US/terms` | 服务规则、账号安全与内容责任说明 | index, follow |

### 5.3 Localized but non-indexable route family

| 页面 | 路径家族 | 原因 | 搜索策略 |
| --- | --- | --- | --- |
| 登录页 | `/zh-CN/login`、`/en-US/login` | 流程页，无搜索落地价值 | noindex, nofollow |
| 找回密码 | `/zh-CN/forgot-password`、`/en-US/forgot-password` | 账户恢复流程页 | noindex, nofollow |
| 资料补全 | `/zh-CN/profile/setup`、`/en-US/profile/setup` | 登录后个人流程页 | noindex, nofollow |
| 支付成功页 | `/zh-CN/pricing/success`、`/en-US/pricing/success` | 交易结果页，可能含会话状态 | noindex, nofollow |
| MetaMask 邮箱绑定 | `/zh-CN/metamask-email`、`/en-US/metamask-email` | 钱包签名与邮箱绑定流程页 | noindex, nofollow |
| 我的素材 | `/zh-CN/assets`、`/en-US/assets` | 用户本地或账号内素材管理 | noindex, nofollow，除非未来拆出公开素材营销页 |
| 工作流列表 | `/zh-CN/canvas`、`/en-US/canvas` | 当前实现为登录后云端工作流库 | noindex, nofollow，除非未来拆出公开画布营销页 |
| 工作流详情 | `/zh-CN/canvas/[id]`、`/en-US/canvas/[id]` | 私有或半私有工作流内容 | noindex, nofollow |
| 分享工作流 | `/zh-CN/share/workflows/[token]`、`/en-US/share/workflows/[token]` | token 化访问路径 | noindex, nofollow |

### 5.4 Unlocalized system route family

| 路径 | 策略 |
| --- | --- |
| `/api/...` | 保持未本地化，不进入 sitemap，不生成页面 metadata |
| `/admin/...` | 保持未本地化，通过 robots 禁止抓取，后台内部自行处理权限 |
| `/_next/...` | 保持未本地化，按 Next.js 静态资源规则处理 |
| `/icons/...`、`/logo.svg`、`/favicon.ico` | 保持未本地化，可缓存，可被页面引用 |
| 任何含文件扩展名的上传或静态文件路径 | 保持未本地化，不参与 locale redirect |

## 6. Multilingual SEO requirements

1. 所有可索引页面必须拥有中英文标题与描述，文案应表达同一页面意图，而不是简单逐字翻译。标题中保留 Aivro 品牌名，描述明确页面的核心能力与用户收益。
2. 每个可索引页面必须输出 canonical、`zh-CN` alternate、`en-US` alternate 与 `x-default`。同一页面的 alternate 必须互相闭环，不允许 A 指向 B 而 B 缺少回指。
3. `<html lang>` 的初始服务端值必须与 URL locale 一致。客户端语言同步只用于交互组件与 Ant Design locale，不应导致初始 HTML 与 metadata 语言不一致。
4. Open Graph 的 `locale` 使用当前语言，`alternateLocale` 包含另一种语言。Open Graph URL 与 canonical 保持一致。
5. Twitter metadata 与页面标题、描述保持一致，默认使用可被后续扩展的 summary large image 策略。缺少正式社交图时，仍要保证标题和描述准确。
6. sitemap 只包含可索引页面的本地化 canonical URL。不可索引流程页、私有页、token 页、后台页、接口页与静态资源不得进入 sitemap。
7. robots.txt 只用于阻止无需抓取的系统、后台、接口、私有详情、token/share pattern 与静态不可收录路径；页面级 noindex 用于登录、找回密码、资料补全、支付成功、MetaMask 邮箱绑定等需要允许抓取后读取 noindex 的流程页。robots 规则不得阻止这些流程页读取 noindex，也不得被当作敏感参数或私密数据的安全控制。
8. 首页、产品入口页、价格页、法律页应具备稳定的首屏文本内容。核心 SEO 文案不能只存在于客户端异步数据、图片或动画中。
9. 站内导航、顶部导航、移动抽屉、页脚、法律页链接、登录重定向参数与 CTA 链接必须通过同一套 localized path 规则生成，避免混入未本地化公开路径。
10. 未本地化公开路径的跳转状态应保持一致，并保留查询参数中业务需要保留的 redirect 目标；跳转目标必须经过安全校验，防止开放重定向。
11. 页面缺失时应提供与当前 locale 一致的 404 体验，并输出不可索引策略，避免错误页被当作正常页面收录。
12. 结构化数据可在首页与核心产品入口页按 Organization、WebSite、SoftwareApplication、Breadcrumb 的层级规划，但必须使用与页面可见内容一致的名称、描述和 URL。
13. SEO 注册表是标题、描述、路径、索引策略、sitemap 与 robots 的唯一来源。新增页面必须先进入路由分类，再进入 metadata 与 sitemap 输出。

## 7. Login and auth requirements

### 7.1 Shared auth flow requirements

1. 所有登录方式成功后使用同一套会话落库与用户信息刷新流程，并根据用户资料完成状态进入目标 redirect 或资料补全页。
2. redirect 参数只能接受站内绝对路径，不接受协议相对 URL、外部域名、反斜杠变体或包含敏感凭据的目标。
3. redirect 目标在用户可见路径中保持 locale。用户从 `/en-US/login` 登录成功后，应回到英文路径或英文资料补全页；中文同理。
4. 登录失败、取消授权、配置缺失、验证码错误、钱包未安装、签名拒绝、OAuth 回调失败等状态必须有本地化提示，并且不泄露服务端密钥、原始 token 或签名内容。
5. 认证配置加载中时，按钮应明确禁用或显示加载状态，避免用户重复提交。
6. Turnstile 配置存在时，邮箱注册、密码登录、验证码发送、MetaMask 邮箱绑定等高风险动作继续经过人机验证。

### 7.2 Google login delivery

1. Google 登录入口在登录页作为标准第三方登录按钮展示，图标、文案、顺序与其他 OAuth 提供商一致。
2. 管理端公开配置控制前台是否显示 Google 入口，私有配置控制服务端是否允许 Google 授权与回调处理。公开显示与服务端启用状态不一致时，前台必须避免展示不可用入口，服务端必须拒绝未启用提供商。
3. Google OAuth 回调完成后，服务端将 Google 用户标识与 Aivro 用户账号关联。已有关联用户直接登录；首次 Google 登录按现有资料补全规则完成账号资料。
4. Google 登录必须保留并校验 locale redirect，不得把用户带回未本地化路径。
5. OAuth 错误回传到登录页时，错误提示以当前 locale 展示，URL 中不保留敏感授权码或长期 token。

### 7.3 MetaMask login delivery

1. MetaMask 登录入口在管理端公开配置启用时展示为标准第三方登录按钮。未检测到钱包时按钮保持可见但进入禁用/提示安装状态，清楚说明需要安装或启用钱包；不得因钱包缺失而打断邮箱、Google 或其他 OAuth 登录方式。
2. 钱包登录应使用服务端生成的短时 nonce 或等效一次性挑战，签名内容包含站点标识、钱包地址、nonce、签发时间与过期信息。不得仅依赖客户端当前时间生成可重放签名。
3. 服务端验证签名、地址归属、nonce 有效性、过期时间与重复使用状态。验证失败时拒绝登录，并返回本地化安全错误。
4. 已绑定钱包的用户在签名验证通过后直接登录。首次使用的钱包进入邮箱绑定流程，邮箱验证码通过后创建或绑定账号，再完成登录。
5. 钱包地址、签名消息和签名结果不应长期暴露在可复制、可收录或可分享的 URL 中。跨页面传递时应使用短期、安全、不可索引的载荷方式，并保证刷新或返回时能给出可恢复的用户提示。
6. MetaMask 邮箱绑定页必须纳入 `/zh-CN` 与 `/en-US` 路径体系，页面标题、说明、表单校验、发送验证码、完成登录、错误提示与按钮文案均支持中英文。
7. MetaMask 登录成功后的 redirect 与资料补全路径必须使用 localized path 规则，且不得将签名载荷带入最终 URL。

### 7.4 Login page spacing and visual hierarchy

1. 登录表单的主提交按钮、协议说明、找回密码、第三方登录按钮之间建立固定垂直节奏。Google、MetaMask、Linux.do、GitHub 与自定义 OAuth 按钮属于同一“第三方登录组”。
2. 第三方登录组与邮箱密码登录之间应通过分隔文案或视觉间距区分，避免按钮堆叠造成层级混乱。
3. Google 与 MetaMask 按钮高度、边框、图标尺寸、文字基线、左右内边距、暗色模式边框和 hover 状态保持一致。
4. 移动端按钮宽度为容器满宽，可点击高度满足触控要求，图标不挤压文案，长 provider 名称保持单行省略或合理换行。
5. 登录页动画不能改变表单可访问性顺序。键盘导航、屏幕阅读器标签、错误提示与按钮禁用状态必须保持准确。

## 8. Animation system requirements

### 8.1 Design direction

1. 全站动效以 anime.js 为统一实现基础，逐步替换 `motion/react` 和分散的局部动画写法。
2. 动效参考 `D:\Github\MX-Insight-Web` 的页面入场、层级错位、线条绘制、元素 stagger 和视差节奏，但不复用其品牌视觉。Aivro 视觉应表现为：空心描边卡片、细线边框、轻量网格背景、克制高亮、技术感留白、清晰字体层级。
3. 字体体系延续当前根布局中的无衬线栈，强化标题字重、字距和大字号留白。中英文排版需在同一组件规格下保持稳定。
4. 动效服务于理解和反馈，不为了装饰牺牲速度。生成中、加载中、页面切换、按钮交互、卡片进入、抽屉打开、空状态和错误状态都应有统一节奏。

### 8.2 Animation primitives

1. 建立统一的动画原语概念：页面进入、区块 reveal、卡片 stagger、按钮 press、输入聚焦、描边扫描、线条绘制、加载描边、列表增删、弹层进入、导航展开。
2. 每个原语必须定义用途、持续时间范围、缓动风格、触发时机、可取消条件、降级行为与适用组件。
3. 默认动效优先使用 transform 与 opacity，避免频繁改变 layout、宽高、top、left 或触发布局回流的属性。
4. SVG 与线框元素可以使用描边绘制效果，但必须保证最终状态在无动画、低性能设备和禁用动画时仍完整可见。
5. 页面首屏内容不应因等待动画初始化而不可见。SEO 文本和关键 CTA 在服务端 HTML 与无脚本环境中仍可读。

### 8.3 Scope of replacement

1. 根布局、App provider、顶部导航、移动导航抽屉、用户状态操作区、页脚、法律页面和首页纳入第一批全局动效替换。
2. 登录、注册、找回密码、MetaMask 邮箱绑定与资料补全页面纳入认证动效批次，替换表单步骤切换和第三方登录按钮反馈。
3. 首页、价格页、图片、视频、3D、提示词、素材库等公开入口页采用统一的 hero 入场、描边卡片、网格背景与 CTA 动效。
4. 画布、素材、生成历史、项目卡片、设置面板等工作区页面采用低干扰动效，重点是状态反馈、列表变更、面板切换与加载指示，不影响拖拽、缩放、输入和生成流程性能。
5. 现有 `AivroDrawableLoader` 可作为线条描边风格参考，但应纳入统一动画生命周期和性能规则。

### 8.4 Accessibility and performance

1. 全站尊重 `prefers-reduced-motion`。用户偏好减少动态时，保留必要状态反馈，移除大幅位移、视差、循环和闪烁。
2. 动画组件必须在卸载、路由切换、弹层关闭和依赖变化时清理实例，避免内存泄漏、重复动画和控制台报错。
3. 动画不能阻塞输入、拖拽、画布缩放、文件上传、生成任务轮询、登录提交或验证码发送。
4. 循环动画只允许用于明确加载状态，并且在状态结束后立即停止。
5. 首屏动画总时长保持克制，页面主要内容应快速进入可读状态。移动端和低性能设备优先降低位移距离、模糊效果和并行动画数量。
6. 暗色模式与亮色模式下，描边、网格、阴影、发光和 hover 状态都需要满足可读性与对比度要求。

## 9. Rollout order

1. **Route and SEO hardening first**：统一路由分类表、SEO 注册表、canonical、hreflang、robots、sitemap、metadata 生成与本地化链接规则。先解决可索引 URL 与重复收录风险，再处理视觉替换。
2. **Layout language consistency**：确保服务端初始 `<html lang>`、metadata locale、客户端 locale store、Ant Design locale 与 middleware header 一致。
3. **Public page SEO pass**：逐页补齐首页、价格页、图片、视频、3D、提示词、素材库、隐私政策、服务条款的中英文标题、描述、首屏文案、社交 metadata 与索引策略。
4. **Private and flow page noindex pass**：登录、找回密码、资料补全、支付成功、MetaMask 邮箱绑定、我的素材、画布、分享 token 与详情页统一 noindex，并从 sitemap 中排除。
5. **Google auth delivery**：校验管理端配置、前台显示、OAuth 授权、回调、用户绑定、会话刷新、本地化 redirect 与错误提示。
6. **MetaMask auth delivery**：引入一次性挑战、签名验证、首次邮箱绑定、已绑定钱包直接登录、安全载荷传递、本地化流程页与错误提示。
7. **Login page spacing fix**：在认证功能闭环后统一第三方登录按钮组、分隔节奏、图标尺寸、移动端布局与暗色模式视觉。
8. **Animation design-system contract**：定义 anime.js 原语、设计 token、生命周期、降级策略、性能预算和组件适用范围。
9. **Global animation replacement milestone 1**：替换布局、导航、首页、法律页与公共入口页动画；完成后不得再在这些已迁移页面新增页面级 `motion/react` 动画。
10. **Auth and workspace animation replacement milestone 2**：替换登录流程、资料页、素材、画布、生成工作台、项目卡片、抽屉、弹层和加载状态动画；完成后清理对应旧 keyframes 与无用 motion import。
11. **Motion dependency removal milestone**：只有当代码库中不再存在运行时必须依赖 `motion/react` 的页面、组件或交互，并且 reduced-motion、卸载清理、画布性能验证通过后，才移除 `motion` 依赖。
12. **Final validation and release readiness**：执行构建、格式检查、路由矩阵、metadata 抽检、sitemap 与 robots 检查、登录手工验证、动画可访问性验证和浏览器回归。

## 10. Validation gates

### 10.1 Route and SEO gates

1. 访问 `/` 会进入带 locale 的首页；访问未本地化公开路径会进入默认语言的带 locale 路径；访问 `/api`、`/admin`、静态资源不会被错误加 locale。
2. `/zh-CN/...` 与 `/en-US/...` 页面在浏览器地址栏保持 locale 前缀，内部页面能正常渲染，不出现 404、重复重定向或循环 rewrite。
3. 每个可索引页面输出正确 title、description、canonical、hreflang、Open Graph URL、Open Graph locale、Twitter title 与 robots index 指令。
4. 每个不可索引流程页输出页面级 noindex 策略，不进入 sitemap，但不一定由 robots.txt Disallow；需要让搜索引擎读取 noindex 的流程页应允许抓取页面本身。私有详情、后台、接口、token/share pattern 等无需读取页面级 noindex 的路径可由 robots.txt 阻止抓取。
5. sitemap 只包含批准的可索引本地化 URL，且每条记录包含中英文 alternate。
6. robots 与页面级 metadata 分工一致：robots 不阻止应该索引的公开页面；不依赖 robots 保护敏感 query、签名、token 或私有数据；需要 noindex 生效的流程页不被 robots 阻断；后台、接口、私有详情与 token pattern 可直接 Disallow。
7. 搜索参数不会污染 canonical。带 redirect、error、token、signature、code 的认证 URL 不会进入 canonical、hreflang、Open Graph URL、sitemap 或可传播分享元信息。
8. 中英文页面互相切换后，路径、页面语言、metadata 语言、导航链接与表单文案保持一致。

### 10.2 Auth gates

1. 邮箱密码登录、注册、找回密码的既有能力保持可用。
2. Google 登录在启用配置下可完成授权、回调、会话创建、用户信息刷新、资料补全判断和 localized redirect；禁用配置下前台不展示入口，服务端拒绝调用。
3. MetaMask 未安装、用户拒绝连接、用户拒绝签名、签名无效、nonce 过期、验证码错误、邮箱绑定失败、服务端禁用等场景均有明确提示。
4. 已绑定 MetaMask 钱包能直接签名登录；首次钱包登录能完成邮箱验证码绑定并登录。
5. 登录成功后的最终 URL 不包含授权码、签名、nonce、验证码或长期 token。
6. 登录页第三方按钮在中文、英文、亮色、暗色、桌面和移动端下间距一致，Google 与 MetaMask 图标和文字对齐。

### 10.3 Animation gates

1. 已迁移页面与组件不再依赖页面级 `motion/react` 动画实现；新增或替换动效统一使用 anime.js 契约。只有所有运行时 motion 使用点完成迁移、验证通过且无必要保留项后，才允许移除 `motion` 包依赖。
2. `prefers-reduced-motion` 下页面可读、可操作，不出现大幅移动、循环闪烁或必须等待动画才能访问内容的情况。
3. 页面切换、弹层关闭、列表刷新和组件卸载后没有残留动画、内存泄漏或控制台错误。
4. 首屏内容快速可见，核心 CTA 不被动画遮挡或延迟到不可接受的时间。
5. 画布拖拽、缩放、输入框输入、生成状态更新、文件上传和登录提交过程中没有明显卡顿。
6. 亮色和暗色主题下空心描边、网格、发光和 hover 状态均清晰可读。

### 10.4 Engineering gates

1. Next.js build 通过。
2. TypeScript 类型检查通过。
3. 格式检查通过。
4. 关键路径浏览器手工验证通过：`/zh-CN`、`/en-US`、`/zh-CN/pricing`、`/en-US/login`、Google 登录、MetaMask 登录、隐私政策、服务条款、至少一个工作区页面。
5. 生产部署前以 `https://aivro.org` 抽检 metadata、sitemap、robots 和登录 redirect。

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Middleware rewrite 与 Next.js metadata 行为不完全一致 | canonical、lang 或页面 metadata 可能使用默认语言 | 以 `x-aivro-locale` 作为服务端唯一语言输入，建立路由矩阵抽检；仅在验证失败且无法修正时评估 `app/[locale]` 迁移 |
| 可索引页面与私有页面分类冲突 | 私有数据被收录，或公开页面被 robots 阻止 | 使用单一路由分类表驱动 metadata、sitemap 与 robots；每次新增页面必须先归类 |
| 当前 `/canvas` 与 `/assets` 具有产品价值但承载用户数据 | SEO 目标与隐私目标冲突 | 当前私有实现保持 noindex；如需要 SEO 落地页，后续单独设计公开营销页或拆分公开介绍内容 |
| Google 公开配置与私有服务端配置不一致 | 用户看到不可用入口或授权失败 | 前台显示与服务端启用均做校验，管理端配置增加一致性提示，失败时返回清晰错误 |
| MetaMask 签名可重放或签名载荷暴露在 URL | 账号安全风险与日志泄露风险 | 使用短时一次性挑战、服务端验证、签名过期和一次性消费；避免将签名和长期凭据放入最终 URL |
| 认证 redirect 被构造成外部跳转 | 开放重定向与钓鱼风险 | redirect 只接受站内绝对路径，拒绝协议相对 URL、反斜杠变体和外部域名，并在跳转前统一本地化 |
| 全站动画替换引发性能下降 | 首屏慢、画布卡顿、移动端掉帧 | 优先 transform 与 opacity，分批替换，工作区减少装饰动画，低性能和 reduced motion 自动降级 |
| anime.js 客户端动画与 SSR 内容不一致 | 水合警告、闪烁或 SEO 文本不可见 | 服务端输出最终可读内容，动画只增强已存在 DOM 状态，不让 SEO 内容依赖客户端初始化 |
| 中英文文案不等价或漏翻 | hreflang 页面质量下降，用户体验不一致 | SEO 注册表与运行时翻译表分工明确；核心页面文案在同一审查流程中成对更新 |
| 现有未提交改动较多 | 实现时容易覆盖或误判他人改动 | 每个阶段先检查当前 diff，只改本阶段文件；提交前列出受影响文件并保留用户已有改动 |

## 12. Completion definition

本设计完成后的交付标准是：`https://aivro.org` 的公开页面拥有稳定的 `/zh-CN` 与 `/en-US` SEO URL 家族；搜索引擎只看到应收录页面；Google 与 MetaMask 登录在启用配置下完成可用、安全、本地化的登录闭环；登录页第三方按钮视觉一致；全站动效由 anime.js 统一承载，并呈现 Aivro 空心描边设计语言，同时满足可访问性、性能与回归验证门禁。
