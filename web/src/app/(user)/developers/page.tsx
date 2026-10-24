import Link from "next/link";
import { ArrowUpRight, BookOpen, KeyRound, Terminal } from "lucide-react";

import { withLocalePath } from "@/i18n/routing";
import { translate } from "@/i18n/runtime-translations";
import { generateLocalizedMetadata, requestLocale } from "@/lib/page-metadata";
import { CodeBlock, CodeExamples } from "./code-examples";
import { endpoints, queueExample } from "./reference";
import { videoWorkflowExample } from "./video-example";

export const generateMetadata = () => generateLocalizedMetadata("developers");

const sections = [
    { id: "quick-start", title: "快速开始" },
    { id: "authentication", title: "密钥与鉴权" },
    { id: "languages", title: "多语言代码示例" },
    { id: "reference", title: "接口参考" },
    { id: "queue", title: "异步任务处理" },
    { id: "video-workflow", title: "从参考图到视频下载" },
    { id: "responses", title: "响应与错误处理" },
    { id: "billing", title: "计费与使用建议" },
];

export default async function DevelopersPage() {
    const locale = await requestLocale();
    const tr = (value: string) => translate(value, locale);
    return <main lang={locale} className="thin-scrollbar h-full overflow-y-auto scroll-smooth bg-background text-foreground">
        <div className="mx-auto w-full max-w-[1960px] px-6 pb-16 sm:px-8">
            <header className="border-b border-border pb-10 pt-12 text-center sm:pt-16">
                <div className="mb-6 flex items-center justify-center gap-2 text-xs tracking-wider text-muted-foreground"><BookOpen className="size-4" />{tr("开发文档")}<span className="mx-2 text-border">/</span>{tr("接口版本 v1")}</div>
                <h1 className="mx-auto max-w-4xl text-[clamp(32px,4vw,60px)] font-semibold leading-tight tracking-[-0.05em]">{tr("把创作能力，接入你的应用。")}</h1>
                <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted-foreground">{tr("从第一行请求开始，连接本站的对话、图片、视频与 3D 模型。")}<br className="hidden sm:block" />{tr("统一鉴权，按量使用。这里提供接入说明与 22 种编程语言的调用示例。")}</p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs text-muted-foreground"><span>{tr("API 接入指南")}</span><span>{tr("22 种编程语言示例")}</span><span>{tr("本站统一接口")}</span></div>
            </header>

            <div className="grid items-start gap-10 pt-9 lg:grid-cols-[190px_minmax(0,1fr)] min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,960px)_minmax(0,1fr)] min-[1440px]:gap-12">
                <aside className="lg:sticky lg:top-8 lg:col-start-1 lg:row-start-1 min-[1440px]:w-[190px] min-[1440px]:justify-self-end">
                    <Link href={withLocalePath("/console/api-keys", locale)} className="mb-8 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm text-background transition hover:opacity-80"><KeyRound className="size-4" />{tr("创建我的密钥")}<ArrowUpRight className="size-4" /></Link>
                    <nav aria-label={tr("开发文档目录")} className="thin-scrollbar max-h-[calc(100dvh-180px)] overflow-y-auto text-sm">
                        <p className="mb-4 text-[11px] text-muted-foreground">{tr("接入指南")}</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-3 lg:flex-col">{sections.map((item, index) => <a key={item.id} href={`#${item.id}`} className="inline-flex items-center gap-3 text-muted-foreground hover:text-foreground"><span className="font-mono text-[10px] opacity-50">{String(index + 1).padStart(2, "0")}</span>{tr(item.title)}</a>)}</div>
                        <div className="mt-7 hidden border-t border-border pt-5 lg:block"><p className="mb-3 text-[11px] text-muted-foreground">{tr("模型与任务接口")}</p><div className="space-y-3">{endpoints.map((item) => <a key={item.id} href={`#${item.id}`} className="block text-xs text-muted-foreground hover:text-foreground">{tr(item.title)}</a>)}</div></div>
                    </nav>
                </aside>

                <article className="min-w-0 space-y-14 text-sm leading-8 [&_section]:scroll-mt-8 [&_h2]:mb-5 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-medium [&_p]:text-muted-foreground lg:col-start-2 lg:row-start-1">
                    <section id="quick-start">
                        <h2>{tr("快速开始")}</h2>
                        <ol className="space-y-2 pl-5 marker:text-muted-foreground"><li className="list-decimal">{tr("登录本站，在")}<Link href={withLocalePath("/console/api-keys", locale)} className="mx-1 underline underline-offset-4">{tr("我的空间 → 密钥管理")}</Link>{tr("创建密钥，并保存仅展示一次的完整内容。")}</li><li className="list-decimal">{tr("设置接口地址与密钥，查询已开放模型，并选择对应功能的模型名称。")}</li><li className="list-decimal">{tr("复制下方任一语言示例，发送第一条请求。")}</li></ol>
                        <CodeBlock label={tr("终端 · 环境变量")} code={`# {{注释:保留 /api/v1 前缀，将域名替换为你的站点地址。}}
export AIVRO_BASE_URL='https://aivro.org/api/v1'
export AIVRO_API_KEY='YOUR_API_KEY'

# {{注释:先查询模型，再将示例中的模型占位值替换为对应类型的可用模型。}}
curl "$AIVRO_BASE_URL/models" -H "Authorization: Bearer $AIVRO_API_KEY"`} />
                        <details className="rounded-lg border border-border px-4 py-3"><summary className="cursor-pointer text-xs font-medium">{tr("Windows PowerShell 环境变量设置")}</summary><CodeBlock label={tr("PowerShell · 环境变量")} code={`$env:AIVRO_BASE_URL = 'https://aivro.org/api/v1'
$env:AIVRO_API_KEY = 'YOUR_API_KEY'`} /></details>
                        <p className="mt-4">{tr("接口基础地址为 ")}<code className="text-foreground">SITE_ORIGIN + /api/v1</code>{tr("。例如图片生成的完整地址是 ")}<code className="break-all text-foreground">https://aivro.org/api/v1/images/generations</code>{tr("。下方接口路径均相对于此基础地址。")}</p>
                    </section>

                    <section id="authentication">
                        <h2>{tr("密钥与鉴权")}</h2>
                        <p>{tr("每个请求通过请求头携带完整 API 密钥。密钥由本站后端随机生成并关联当前账号；本站仅保存摘要，列表只显示脱敏标识，没有再次查看完整密钥的接口。")}</p>
                        <CodeBlock label={tr("鉴权请求头")} code="Authorization: Bearer YOUR_API_KEY" />
                        <ul className="space-y-2 pl-5"><li className="list-disc">{tr("名称在同一账号内唯一，忽略首尾空格和字母大小写，最多 50 个字符；已撤销的名称也不可重复。")}</li><li className="list-disc">{tr("密钥可调用本文列出的模型、任务和文件接口。账号资料、钱包管理、工作流、密钥管理和管理后台仍使用网站登录鉴权。")}</li><li className="list-disc">{tr("撤销后无法恢复，后续请求立即失效。账号被禁用或删除后，其密钥也无法调用。")}</li><li className="list-disc">{tr("所有密钥共享所属账号的算力点余额；一个账号的密钥可以查询该账号的生成任务和文件。")}</li></ul>
                        <div className="mt-5 border-l-2 border-foreground bg-muted/30 px-5 py-3"><p>{tr("请在服务器环境变量或密钥管理工具中保存密钥。浏览器、移动端和桌面客户端应调用你自己的服务，由服务端携带密钥调用本站。请勿将密钥写入公开代码、请求地址或前端打包文件。")}</p></div>
                    </section>

                    <section id="languages">
                        <h2>{tr("多语言代码示例")}</h2>
                        <p>{tr("选择编程语言与调用场景，查看图片、对话、3D、视频、模型查询和任务管理示例。22 种语言提供 9 类调用；代码注释跟随当前界面语言，协议字段、命令和示例提示词保留原样。")}</p>
                        <CodeExamples />
                        <p>{tr("cURL、C 与 C++ 示例将完整响应直接写入终端，业务错误也会出现在输出中；正式接入时请解析 JSON 并检查 ")}<code>code</code>{tr("。其他示例展示常用的错误判断方式。调用图片等 JSON 接口时，可按接口参考替换路径与请求体；上传文件使用对应语言的 multipart 能力。")}</p>
                        <details className="mt-5 rounded-lg border border-border px-4 py-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-medium"><Terminal className="size-3.5" />{tr("查看流式对话示例")}</summary><CodeBlock label={tr("cURL · 流式对话")} code={`curl -N "$AIVRO_BASE_URL/chat/completions" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{
    "model": "AVAILABLE_CHAT_MODEL",
    "messages": [{"role": "user", "content": "Write a short poem about spring."}],
    "max_tokens": 512,
    "stream": true
  }'`} /><p>{tr("响应类型为 ")}<code>text/event-stream</code>{tr("，每个事件的数据部分为 JSON，常见回复片段位于 ")}<code>choices[0].delta.content</code>{tr("，结束标记为 ")}<code>[DONE]</code>{tr("。正式客户端请使用成熟的事件流解析库，保留用量事件并处理断线。")}</p></details>
                    </section>

                    <section id="reference">
                        <h2>{tr("接口参考")}</h2>
                        <p>{tr("所有接口使用同一套密钥鉴权。示例中的模型名称、任务编号、文件编号和价格均为说明占位值，请替换为实际接口返回的数据。不同模型支持的尺寸、质量、参考图和高级参数可能不同。")}</p>
                        <div className="mt-5 overflow-hidden rounded-lg border border-border">{endpoints.map((item) => <a key={item.id} href={`#${item.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/40"><span className="w-14 font-mono text-[10px] font-semibold text-muted-foreground">{item.method}</span><code className="min-w-0 break-all text-xs sm:flex-1">{item.path}</code><span className="ml-auto text-xs text-muted-foreground">{tr(item.title)}</span></a>)}</div>
                    </section>

                    {endpoints.map((item) => <section id={item.id} key={item.id} className="border-t border-border pt-8">
                        <div className="mb-4 flex flex-wrap items-center gap-3"><span className="rounded border border-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-semibold">{item.method}</span><code className="break-all text-xs text-muted-foreground">{item.path}</code></div>
                        <h2>{tr(item.title)}</h2><p>{tr(item.description)}</p>
                        {item.params.length ? <div className="thin-scrollbar my-5 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[580px] border-collapse text-left text-xs leading-6"><thead className="bg-muted/40"><tr>{["参数", "类型", "要求", "说明"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-medium">{tr(title)}</th>)}</tr></thead><tbody>{item.params.map(([name, type, required, description]) => <tr key={name} className="border-t border-border"><td className="px-4 py-3 align-top font-mono">{name}</td><td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">{tr(type)}</td><td className="whitespace-nowrap px-4 py-3 align-top">{tr(required)}</td><td className="px-4 py-3 text-muted-foreground">{tr(description)}</td></tr>)}</tbody></table></div> : null}
                        <CodeBlock code={item.code} />{item.response ? <CodeBlock code={item.response} label={tr("响应示例 · 字段说明")} /> : null}<p>{tr(item.note)}</p>
                    </section>)}

                    <section id="queue" className="border-t border-border pt-8">
                        <h2>{tr("异步任务处理")}</h2>
                        <p>{tr("图片和视频请求可能进入本站队列。排队响应仍为 HTTP 200，请检查 ")}<code>data.queued</code>{tr("，并保存 ")}<code>data.taskId</code>{tr("。排队后不要重复提交相同生成请求。")}</p>
                        <CodeBlock label={tr("排队响应示例")} code={JSON.stringify({ code: 0, data: { queued: true, taskId: "TASK_ID", status: "queued", queuePosition: 2, aheadCount: 1 }, msg: "ok" }, null, 2)} />
                        <ol className="space-y-2 pl-5"><li className="list-decimal">{tr("每隔约 3 秒请求 ")}<code>/generation-tasks/TASK_ID</code>{tr("。")}</li><li className="list-decimal">{tr("状态为 ")}<code>succeeded</code> {tr(" 且 ")}<code>resultAvailable</code> {tr(" 为 true 时，请求 ")}<code>/generation-tasks/TASK_ID/result</code>{tr("。")}</li><li className="list-decimal">{tr("状态为 ")}<code>failed</code> {tr(" 或 ")}<code>canceled</code> {tr(" 时停止轮询，展示错误并检查退款。")}</li><li className="list-decimal">{tr("视频队列结果是视频创建响应，再使用其中的本站视频编号查询视频进度；3D 当前由创建接口直接返回结果。")}</li></ol>
                        <CodeBlock label={tr("Python · 图片生成与队列轮询")} code={queueExample} />
                        <h3 id="video-workflow" className="mt-8 scroll-mt-8">{tr("从参考图到视频下载")}</h3>
                        <p>{tr("以下 Python 示例串联参考图上传、视频创建、本站队列、视频进度和文件下载。先执行 pip install requests，设置 AIVRO_VIDEO_MODEL，并准备 reference.png。状态字段以所选渠道为准。")}</p>
                        <CodeBlock label={tr("Python · 视频创建、轮询与下载")} code={videoWorkflowExample} />
                        <p>{tr("等待超时只表示客户端停止等待，请保留任务编号稍后查询。本站执行中的任务不能取消；仅排队任务支持取消并退款。生成结果与临时文件存在保留期限，请及时取回。")}</p>
                    </section>

                    <section id="responses" className="border-t border-border pt-8">
                        <h2>{tr("响应与错误处理")}</h2>
                        <p>{tr("模型查询、上传、3D、任务和密钥管理等业务接口统一返回 ")}<code>{"{ code, data, msg }"}</code>{tr("。")}<code>code</code> {tr(" 为 0 表示成功，非 0 表示失败。普通业务错误可能返回 HTTP 200，所以需要同时检查 HTTP 状态和业务状态。")}</p>
                        <CodeBlock label={tr("业务错误示例")} code={JSON.stringify({ code: 1, data: null, msg: "Invalid or revoked API key" }, null, 2)} />
                        <p>{tr("对话、图片和视频的直接成功响应通常保留模型接口的标准 JSON；对话流为事件流，视频内容也可能是文件。请根据 ")}<code>Content-Type</code> {tr(" 和响应中的 ")}<code>code</code> {tr(" 选择处理方式，勿假定所有 ")}<code>data</code> {tr(" 字段都是业务包装。")}</p>
                        <div className="thin-scrollbar my-5 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[520px] text-left text-xs leading-6"><thead className="bg-muted/40"><tr><th scope="col" className="px-4 py-3 font-medium">{tr("情况")}</th><th scope="col" className="px-4 py-3 font-medium">{tr("处理建议")}</th></tr></thead><tbody>{[
                            ["HTTP 401：密钥无效、已撤销或账号不可用", "检查完整密钥和 Bearer 请求头，必要时在密钥管理中创建新密钥。"],
                            ["HTTP 403：请求来源无效", "服务端调用通常不携带浏览器 Cookie；浏览器跨站调用应通过自己的后端。"],
                            ["HTTP 404：接口不存在", "检查域名、/api/v1 前缀、接口路径和请求方法。"],
                            ["HTTP 502 或网络连接失败", "检查站点服务是否可用；生成请求可能已经提交，请先确认任务状态再重试。"],
                            ["业务错误：模型未开放或未配置计费", "查询 /models，并选择与图片、对话、视频或 3D 功能对应的模型。"],
                            ["业务错误：算力点不足", "补充当前账号余额。词元计费需要先预扣额度，结算可能补扣差额。"],
                            ["业务错误：排队任务过多或请求频繁", "延长请求间隔，减少并发，并等待已有任务完成。"],
                            ["业务错误：任务或文件不存在、无访问权限", "使用本站返回的编号，确认所属账号和文件有效期。"],
                        ].map(([cause, action]) => <tr key={tr(cause)} className="border-t border-border"><td className="px-4 py-3 align-top">{tr(cause)}</td><td className="px-4 py-3 text-muted-foreground">{tr(action)}</td></tr>)}</tbody></table></div>
                        <p>{tr("接口没有通用的幂等键支持。对生成请求做自动重试可能产生重复任务与扣费；查询请求可以在有限次数内逐步延长间隔后重试。流式连接断开后，请按已收到的内容与错误状态处理。")}</p>
                    </section>

                    <section id="billing" className="border-t border-border pt-8">
                        <h2>{tr("计费与使用建议")}</h2>
                        <ul className="space-y-3 pl-5"><li className="list-disc">{tr("API 使用密钥所属账号的算力点，价格读取")}<Link href={withLocalePath("/models", locale)} className="mx-1 underline underline-offset-4">{tr("模型定价表 → API 价")}</Link>{tr("。显式 API 单价优先；未填写时按标准价乘以 API 倍数计算，默认 2 倍。")}</li><li className="list-disc">{tr("按次计费根据请求数量预扣。图片、视频的 ")}<code>n</code> {tr(" 默认为 1；3D 另按数量、网格质量、贴图、物理材质和面数计算。")}</li><li className="list-disc">{tr("词元计费按每千个词元的 API 单价结算，算力点向上取整。对话会先预扣输入估算与输出上限的额度，再按返回用量补扣或退回；未返回用量时采用估算，估算不超过预扣值。")}</li><li className="list-disc">{tr("图片、视频和 3D 配置为词元计费时，有上游用量就按用量结算；未返回用量时保留提交时的预扣额度。")}</li><li className="list-disc">{tr("排队任务保留提交时的计费配置。请求失败和排队取消沿用本站退款流程，实际明细以账号算力流水为准。")}</li><li className="list-disc">{tr("文件上传最大 50 MiB，通用模型请求上限为 80 MiB；仍受所选模型、本站容量和并发设置约束。建议为生成请求设置至少 300 秒超时，并及时下载生成文件。")}</li></ul>
                        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs"><p>{tr("这是一份静态接入文档。模型、价格和站点限额以实际接口返回为准。")}</p><Link href={withLocalePath("/console/api-keys", locale)} className="inline-flex items-center gap-2">{tr("前往密钥管理")}<ArrowUpRight className="size-3.5" /></Link></div>
                    </section>
                </article>
            </div>
        </div>
    </main>;
}
