"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "antd";

import { useConfigStore } from "@/stores/use-config-store";

const fallbackPrivacyContent = `欢迎使用 Aivro（边缘幻星）。我们重视你的隐私，并尽量只处理提供服务所必需的信息。

一、我们处理的信息
当你注册、登录或使用 Aivro 时，我们可能会处理用户名、邮箱、第三方登录标识、登录状态、算力点记录、生成请求、提示词、参考图片、生成结果地址以及你主动保存到素材或画布中的内容。当前个人素材、画布项目和生成历史主要保存在你的浏览器本地；如果管理员开启云存储，生成后的图片和视频会由后端转存到配置的 Cloudflare R2 或兼容 S3 存储，并在到期后按配置自动清理。

二、信息用途
这些信息用于完成账号登录、身份验证、生成服务、素材和历史记录管理、算力点扣减与返还、系统安全审计、故障排查以及必要的产品体验改进。

三、第三方服务
Aivro 可能接入 OpenAI 兼容模型渠道、Cloudflare R2 / S3 云存储、邮箱服务和第三方登录服务。你提交的生成内容可能会根据管理员配置发送给相应模型服务商处理。请不要提交你无权处理或不希望第三方服务处理的敏感内容。

四、本地存储
为提供连续创作体验，Aivro 会在浏览器本地保存用户配置、语言偏好、素材、画布项目和生成历史。你可以通过浏览器设置清理这些本地数据。

五、你的选择
你可以停止使用服务、清理浏览器本地数据，或联系站点管理员请求处理账号相关信息。管理员可在后台调整模型渠道、登录方式、邮件和云存储配置。

六、政策更新
我们可能根据功能变化更新本政策。更新后的内容会展示在本页面，继续使用 Aivro 表示你理解并同意更新后的政策。`;

const fallbackTermsContent = `欢迎使用 Aivro（边缘幻星）。使用、登录或注册 Aivro，即表示你同意遵守本服务条款。

一、服务说明
Aivro 提供图片、视频、文本、提示词、素材和画布相关的 AI 创作工具。具体能力取决于管理员配置的模型渠道、算力点规则、登录方式、邮件服务和云存储服务。

二、账号与安全
你应妥善保管账号、密码、邮箱验证码、第三方登录账号和钱包签名信息。通过你的账号发起的操作视为你本人行为；如发现异常，请及时停止使用并联系站点管理员。

三、内容责任
你应确保输入、上传、生成、保存和分享的内容合法合规，并拥有必要权利。请勿使用 Aivro 生成、保存或传播违法、侵权、欺诈、骚扰、恶意代码、侵犯隐私或违反模型服务商规则的内容。

四、生成结果
AI 生成结果可能存在不准确、不稳定或不符合预期的情况。你应自行判断生成内容是否适合用于商业、公开发布或其他重要场景，并承担相应责任。

五、服务变更
管理员可能根据运营需要调整模型、算力点、登录方式、云存储、自动清理策略或暂停部分能力。因第三方模型、存储、邮箱或登录服务异常导致的不可用，Aivro 会尽力恢复但不承诺绝对连续可用。

六、条款更新
我们可能根据功能和合规要求更新本条款。更新后的内容会展示在本页面，继续使用或登录 Aivro 表示你接受更新后的条款。`;

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
    const pages = useConfigStore((state) => state.publicSettings?.pages);
    const isPrivacy = type === "privacy";
    const title = isPrivacy ? pages?.privacyTitle || "隐私政策" : pages?.termsTitle || "服务条款";
    const content = isPrivacy ? pages?.privacyContent || fallbackPrivacyContent : pages?.termsContent || fallbackTermsContent;

    return (
        <main className="h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-10 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]">
            <section className="mx-auto max-w-4xl">
                <Button href="/login" icon={<ArrowLeft className="size-4" />} type="text" className="mb-8">
                    返回登录
                </Button>
                <div className="border-y border-stone-200 bg-background/80 py-10 backdrop-blur dark:border-stone-800">
                    <div className="mb-8 flex items-center gap-3">
                        <span
                            className="size-9 shrink-0 bg-stone-950 dark:bg-stone-100"
                            style={{
                                mask: "url(/logo.svg) center / contain no-repeat",
                                WebkitMask: "url(/logo.svg) center / contain no-repeat",
                            }}
                        />
                        <div>
                            <div className="text-sm text-stone-500 dark:text-stone-400">Aivro / 边缘幻星</div>
                            <h1 className="mt-1 text-4xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">{title}</h1>
                        </div>
                    </div>
                    <article className="whitespace-pre-line text-base leading-8 text-stone-700 dark:text-stone-300">{content}</article>
                </div>
            </section>
        </main>
    );
}
