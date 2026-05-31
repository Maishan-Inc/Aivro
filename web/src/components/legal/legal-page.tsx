"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "antd";

import { useConfigStore } from "@/stores/use-config-store";
import { useLocaleStore } from "@/stores/use-locale-store";

const fallbackPrivacyContent = `欢迎使用 Aivro（边缘幻星）。我们重视你的隐私，并尽量只处理提供服务所必需的信息。

一、我们处理的信息
当你注册、登录或使用 Aivro 时，我们可能会处理用户名、邮箱、第三方登录标识、登录状态、算力点记录、生成请求、提示词、参考图片、生成结果地址以及你主动保存到素材或画布中的内容。生成历史保存在数据库中，并跟随云存储文件有效期展示；如果管理员开启云存储，生成后的图片和视频会由后端转存到配置的 Cloudflare R2 或兼容 S3 存储，并在到期后按配置自动清理。

二、信息用途
这些信息用于完成账号登录、身份验证、生成服务、素材和历史记录管理、算力点扣减与返还、系统安全审计、故障排查以及必要的产品体验改进。

三、第三方服务
Aivro 可能接入 OpenAI 兼容模型渠道、Cloudflare R2 / S3 云存储、邮箱服务和第三方登录服务。你提交的生成内容可能会根据管理员配置发送给相应模型服务商处理。请不要提交你无权处理或不希望第三方服务处理的敏感内容。

四、本地存储与云端工作流
Aivro 会在浏览器本地保存语言偏好、界面状态等少量配置；工作流项目保存在云端数据库中。生成模型渠道由管理员统一配置，用户侧不会保存或填写 API Key。你可以通过浏览器设置清理本地偏好数据。

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

const fallbackPrivacyContentEn = `Welcome to Aivro. We respect your privacy and only process information needed to provide the service.

1. Information we process
When you register, sign in, or use Aivro, we may process your username, email address, third-party login identifier, login state, credit records, generation requests, prompts, reference images, generated result URLs, and content you actively save to assets or canvas projects. Generation history is stored in the database and displayed according to the retention period of cloud storage files. If cloud storage is enabled by the administrator, generated images and videos are stored by the backend in Cloudflare R2 or S3-compatible storage and cleaned up after expiration based on the configured policy.

2. How we use information
This information is used for account login, identity verification, generation services, asset and history management, credit deduction and refund, security auditing, troubleshooting, and necessary product experience improvements.

3. Third-party services
Aivro may integrate OpenAI-compatible model providers, Cloudflare R2 / S3 cloud storage, email services, and third-party login services. Your generation content may be sent to the configured model provider. Do not submit sensitive content that you are not authorized to process or do not want third-party services to process.

4. Local storage and cloud workflows
Aivro stores a small amount of preference data such as language and UI state in the browser. Workflow projects are stored in the cloud database. Model providers are configured centrally by the administrator, and users do not store or enter API keys on the client side. You can clear local preference data through your browser settings.

5. Your choices
You may stop using the service, clear local browser data, or contact the site administrator to request handling of account-related information. Administrators can adjust model providers, login methods, email configuration, and cloud storage settings in the admin console.

6. Policy updates
We may update this policy as features change. Updated content will be shown on this page. Continuing to use Aivro means you understand and agree to the updated policy.`;

const fallbackTermsContentEn = `Welcome to Aivro. By using, signing in to, or registering for Aivro, you agree to these Terms of Service.

1. Service description
Aivro provides AI creative tools for images, videos, text, prompts, assets, and canvas workflows. Available capabilities depend on the administrator's model provider, credit rules, login methods, email service, and cloud storage configuration.

2. Account and security
You are responsible for protecting your account, password, email verification codes, third-party login account, and wallet signature information. Actions initiated through your account are treated as your own. If you notice abnormal activity, stop using the service and contact the site administrator.

3. Content responsibility
You must ensure that content you input, upload, generate, save, and share is lawful and that you have the necessary rights. Do not use Aivro to generate, store, or distribute illegal, infringing, fraudulent, harassing, malicious, privacy-invasive, or model-policy-violating content.

4. Generated results
AI-generated results may be inaccurate, unstable, or different from expectations. You are responsible for deciding whether generated content is suitable for commercial use, public publishing, or other important scenarios.

5. Service changes
Administrators may adjust models, credits, login methods, cloud storage, automatic cleanup policies, or suspend some capabilities for operational reasons. Aivro will try to recover from third-party model, storage, email, or login service failures but does not guarantee uninterrupted availability.

6. Terms updates
We may update these terms for feature and compliance reasons. Updated content will be shown on this page. Continuing to use or sign in to Aivro means you accept the updated terms.`;

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
    const pages = useConfigStore((state) => state.publicSettings?.pages);
    const locale = useLocaleStore((state) => state.locale);
    const isPrivacy = type === "privacy";
    const title = isPrivacy ? pages?.privacyTitle || "隐私政策" : pages?.termsTitle || "服务条款";
    const fallbackContent = locale === "en-US" ? (isPrivacy ? fallbackPrivacyContentEn : fallbackTermsContentEn) : isPrivacy ? fallbackPrivacyContent : fallbackTermsContent;
    const content = isPrivacy ? pages?.privacyContent || fallbackContent : pages?.termsContent || fallbackContent;

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
