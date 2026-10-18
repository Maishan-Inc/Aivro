"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "antd";

import { useLocalizedPath } from "@/hooks/use-localized-path";
import type { Locale } from "@/i18n/messages";
import { useConfigStore } from "@/stores/use-config-store";
import { useLocaleStore } from "@/stores/use-locale-store";

const privacyZh = `欢迎使用 Aivro。我们重视你的隐私，并尽量只处理提供服务所必需的信息。

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

const privacyEn = `Welcome to Aivro. We respect your privacy and only process information needed to provide the service.

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

const privacyJa = `Aivro をご利用いただきありがとうございます。私たちはお客様のプライバシーを尊重し、サービス提供に必要な情報のみを取り扱うよう努めます。

1. 取得する情報
Aivro への登録、ログイン、またはご利用の際、ユーザー名、メールアドレス、第三者ログインの識別子、ログイン状態、クレジット記録、生成リクエスト、プロンプト、参照画像、生成結果の URL、ならびに素材やキャンバスにご自身で保存したコンテンツを取り扱う場合があります。生成履歴はデータベースに保存され、クラウドストレージのファイル有効期限に沿って表示されます。管理者がクラウドストレージを有効にしている場合、生成された画像と動画はバックエンドにより Cloudflare R2 または互換の S3 ストレージへ転送され、設定された期限に従って自動で削除されます。

2. 情報の利用目的
これらの情報は、アカウントのログイン、本人確認、生成サービス、素材と履歴の管理、クレジットの減算と返還、セキュリティ監査、障害調査、ならびに必要な品質改善のために利用します。

3. 第三者サービス
Aivro は OpenAI 互換のモデル提供元、Cloudflare R2 / S3 クラウドストレージ、メール配信サービス、第三者ログインサービスを利用する場合があります。送信された生成内容は、管理者の設定に応じて該当するモデル提供元へ送られます。取り扱う権限のない内容や、第三者に処理されたくない機密情報は送信しないでください。

4. ローカルストレージとクラウドワークフロー
Aivro は言語設定や画面状態など、少量の設定をブラウザ内に保存します。ワークフロープロジェクトはクラウドのデータベースに保存されます。生成モデルの提供元は管理者が一括で設定するため、ユーザー側で API キーを保存したり入力したりすることはありません。ブラウザの設定からローカルの設定データを削除できます。

5. お客様の選択
サービスの利用を中止する、ブラウザのローカルデータを削除する、またはサイト管理者に連絡してアカウント関連情報の取り扱いを依頼することができます。管理者は管理画面からモデル提供元、ログイン方法、メール、クラウドストレージの設定を変更できます。

6. ポリシーの更新
機能の変更に応じて本ポリシーを更新する場合があります。更新後の内容は本ページに表示されます。Aivro の利用を継続することで、更新後のポリシーに同意したものとみなされます。`;

const privacyKo = `Aivro를 이용해 주셔서 감사합니다. 저희는 개인정보를 소중히 여기며 서비스 제공에 필요한 정보만 처리하려고 노력합니다.

1. 처리하는 정보
Aivro에 가입, 로그인 또는 이용할 때 사용자 이름, 이메일, 제3자 로그인 식별자, 로그인 상태, 크레딧 기록, 생성 요청, 프롬프트, 참조 이미지, 생성 결과 URL, 그리고 사용자가 에셋이나 캔버스에 직접 저장한 콘텐츠를 처리할 수 있습니다. 생성 기록은 데이터베이스에 저장되며 클라우드 저장소 파일의 유효 기간에 따라 표시됩니다. 관리자가 클라우드 저장소를 켜면 생성된 이미지와 영상은 백엔드에서 Cloudflare R2 또는 호환 S3 저장소로 전송되고, 설정된 기간이 지나면 자동으로 정리됩니다.

2. 정보 이용 목적
이 정보는 계정 로그인, 본인 확인, 생성 서비스, 에셋과 기록 관리, 크레딧 차감과 환급, 보안 감사, 장애 대응, 그리고 필요한 서비스 개선을 위해 사용됩니다.

3. 제3자 서비스
Aivro는 OpenAI 호환 모델 제공사, Cloudflare R2 / S3 클라우드 저장소, 이메일 서비스, 제3자 로그인 서비스를 연동할 수 있습니다. 제출한 생성 콘텐츠는 관리자 설정에 따라 해당 모델 제공사로 전송될 수 있습니다. 처리 권한이 없거나 제3자에게 처리되기를 원하지 않는 민감한 내용은 제출하지 마세요.

4. 로컬 저장소와 클라우드 워크플로
Aivro는 언어 설정과 화면 상태 등 소량의 설정을 브라우저에 저장합니다. 워크플로 프로젝트는 클라우드 데이터베이스에 저장됩니다. 생성 모델 제공사는 관리자가 일괄 설정하므로 사용자 쪽에서 API 키를 저장하거나 입력하지 않습니다. 브라우저 설정에서 로컬 설정 데이터를 삭제할 수 있습니다.

5. 이용자의 선택
서비스 이용을 중단하거나, 브라우저 로컬 데이터를 삭제하거나, 사이트 관리자에게 계정 관련 정보 처리를 요청할 수 있습니다. 관리자는 관리자 페이지에서 모델 제공사, 로그인 방식, 이메일, 클라우드 저장소 설정을 변경할 수 있습니다.

6. 정책 변경
기능 변경에 따라 본 정책을 갱신할 수 있습니다. 갱신된 내용은 이 페이지에 표시됩니다. Aivro를 계속 이용하면 갱신된 정책을 이해하고 동의한 것으로 간주됩니다.`;

const privacyFr = `Bienvenue sur Aivro. Nous respectons votre vie privée et ne traitons que les informations nécessaires à la fourniture du service.

1. Informations traitées
Lorsque vous vous inscrivez, vous connectez ou utilisez Aivro, nous pouvons traiter votre nom d'utilisateur, votre adresse e-mail, l'identifiant de connexion tiers, l'état de connexion, les historiques de crédits, les requêtes de génération, les prompts, les images de référence, les URL des résultats générés et les contenus que vous enregistrez vous-même dans vos assets ou vos projets de canevas. L'historique de génération est stocké en base de données et affiché selon la durée de conservation des fichiers du stockage cloud. Si l'administrateur active le stockage cloud, les images et vidéos générées sont transférées par le backend vers Cloudflare R2 ou un stockage compatible S3, puis supprimées automatiquement à l'expiration selon la configuration.

2. Utilisation des informations
Ces informations servent à la connexion au compte, à la vérification d'identité, aux services de génération, à la gestion des assets et de l'historique, à la déduction et au remboursement des crédits, à l'audit de sécurité, au diagnostic des incidents et aux améliorations nécessaires de l'expérience produit.

3. Services tiers
Aivro peut intégrer des fournisseurs de modèles compatibles OpenAI, le stockage cloud Cloudflare R2 / S3, des services d'e-mail et des services de connexion tiers. Le contenu que vous soumettez peut être transmis au fournisseur de modèle concerné selon la configuration de l'administrateur. Ne soumettez pas de contenu sensible que vous n'êtes pas autorisé à traiter ou que vous ne souhaitez pas voir traiter par un tiers.

4. Stockage local et workflows cloud
Aivro conserve dans le navigateur un petit volume de préférences, comme la langue et l'état de l'interface. Les projets de workflow sont enregistrés dans la base de données cloud. Les fournisseurs de modèles sont configurés de manière centralisée par l'administrateur ; les utilisateurs ne stockent ni ne saisissent de clé API côté client. Vous pouvez effacer les préférences locales via les réglages de votre navigateur.

5. Vos choix
Vous pouvez cesser d'utiliser le service, effacer les données locales de votre navigateur ou contacter l'administrateur du site pour demander le traitement des informations liées à votre compte. L'administrateur peut modifier les fournisseurs de modèles, les méthodes de connexion, la configuration e-mail et le stockage cloud depuis la console d'administration.

6. Mises à jour de la politique
Nous pouvons mettre à jour cette politique selon l'évolution des fonctionnalités. Le contenu mis à jour est affiché sur cette page. Continuer à utiliser Aivro signifie que vous comprenez et acceptez la politique mise à jour.`;

const termsZh = `欢迎使用 Aivro。使用、登录或注册 Aivro，即表示你同意遵守本服务条款。

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

const termsEn = `Welcome to Aivro. By using, signing in to, or registering for Aivro, you agree to these Terms of Service.

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

const termsJa = `Aivro をご利用いただきありがとうございます。Aivro を利用、ログイン、または登録することにより、本利用規約に同意したものとみなされます。

1. サービスの内容
Aivro は、画像・動画・テキスト・プロンプト・素材・キャンバスに関する AI 創作ツールを提供します。利用可能な機能は、管理者が設定するモデル提供元、クレジットのルール、ログイン方法、メール配信サービス、クラウドストレージによって異なります。

2. アカウントとセキュリティ
アカウント、パスワード、メール認証コード、第三者ログインアカウント、ウォレット署名情報は適切に管理してください。ご自身のアカウントから行われた操作はご本人の行為とみなされます。異常を確認した場合は、利用を中止し、速やかにサイト管理者へご連絡ください。

3. コンテンツの責任
入力、アップロード、生成、保存、共有するコンテンツが法令に適合し、必要な権利を有していることを確認してください。違法、権利侵害、詐欺、嫌がらせ、悪意のあるコード、プライバシー侵害、またはモデル提供元の規則に違反するコンテンツの生成・保存・配布に Aivro を使用しないでください。

4. 生成結果
AI による生成結果は、不正確、不安定、またはご期待に沿わない場合があります。生成内容が商用利用、公開、その他の重要な用途に適しているかはご自身で判断し、責任を負っていただきます。

5. サービスの変更
管理者は運営上の必要に応じて、モデル、クレジット、ログイン方法、クラウドストレージ、自動削除の方針を変更したり、一部機能を停止したりする場合があります。第三者のモデル、ストレージ、メール、ログインサービスの障害による停止については、Aivro は復旧に努めますが、常時利用可能であることを保証するものではありません。

6. 規約の更新
機能やコンプライアンスの要請に応じて本規約を更新する場合があります。更新後の内容は本ページに表示されます。Aivro の利用またはログインを継続することで、更新後の規約に同意したものとみなされます。`;

const termsKo = `Aivro를 이용해 주셔서 감사합니다. Aivro를 이용, 로그인 또는 가입하면 본 서비스 약관에 동의한 것으로 간주됩니다.

1. 서비스 설명
Aivro는 이미지, 영상, 텍스트, 프롬프트, 에셋, 캔버스와 관련된 AI 창작 도구를 제공합니다. 제공되는 기능은 관리자가 설정한 모델 제공사, 크레딧 규칙, 로그인 방식, 이메일 서비스, 클라우드 저장소에 따라 달라집니다.

2. 계정과 보안
계정, 비밀번호, 이메일 인증 코드, 제3자 로그인 계정, 지갑 서명 정보를 안전하게 관리하세요. 사용자의 계정으로 시작된 작업은 본인의 행위로 간주됩니다. 이상 징후를 발견하면 즉시 이용을 중단하고 사이트 관리자에게 문의하세요.

3. 콘텐츠 책임
입력, 업로드, 생성, 저장, 공유하는 콘텐츠가 법령을 준수하고 필요한 권리를 보유하도록 해야 합니다. 불법, 권리 침해, 사기, 괴롭힘, 악성 코드, 개인정보 침해 또는 모델 제공사 규칙을 위반하는 콘텐츠를 생성, 저장, 유포하는 데 Aivro를 사용하지 마세요.

4. 생성 결과
AI 생성 결과는 부정확하거나 불안정하거나 기대와 다를 수 있습니다. 생성된 콘텐츠가 상업적 이용, 공개 게시 또는 그 밖의 중요한 상황에 적합한지 스스로 판단하고 그에 대한 책임을 지셔야 합니다.

5. 서비스 변경
관리자는 운영상 필요에 따라 모델, 크레딧, 로그인 방식, 클라우드 저장소, 자동 정리 정책을 조정하거나 일부 기능을 중단할 수 있습니다. 제3자 모델, 저장소, 이메일, 로그인 서비스의 장애로 인한 중단에 대해 Aivro는 복구를 위해 노력하지만 항상 연속적으로 이용할 수 있음을 보장하지는 않습니다.

6. 약관 변경
기능과 규정 준수 요구에 따라 본 약관을 갱신할 수 있습니다. 갱신된 내용은 이 페이지에 표시됩니다. Aivro 이용이나 로그인을 계속하면 갱신된 약관을 수락한 것으로 간주됩니다.`;

const termsFr = `Bienvenue sur Aivro. En utilisant, en vous connectant à ou en vous inscrivant sur Aivro, vous acceptez les présentes conditions d'utilisation.

1. Description du service
Aivro fournit des outils de création IA pour les images, les vidéos, le texte, les prompts, les assets et les workflows de canevas. Les fonctionnalités disponibles dépendent du fournisseur de modèles, des règles de crédits, des méthodes de connexion, du service d'e-mail et de la configuration du stockage cloud définis par l'administrateur.

2. Compte et sécurité
Vous êtes responsable de la protection de votre compte, de votre mot de passe, des codes de vérification par e-mail, de votre compte de connexion tiers et des informations de signature de portefeuille. Les actions effectuées depuis votre compte sont considérées comme les vôtres. Si vous constatez une activité anormale, cessez d'utiliser le service et contactez l'administrateur du site.

3. Responsabilité des contenus
Vous devez vous assurer que les contenus que vous saisissez, importez, générez, enregistrez et partagez sont licites et que vous disposez des droits nécessaires. N'utilisez pas Aivro pour générer, stocker ou diffuser des contenus illicites, contrefaisants, frauduleux, harcelants, malveillants, portant atteinte à la vie privée ou contraires aux règles des fournisseurs de modèles.

4. Résultats générés
Les résultats générés par IA peuvent être inexacts, instables ou différents de vos attentes. Il vous appartient de juger si les contenus générés conviennent à un usage commercial, à une publication publique ou à tout autre usage important, et d'en assumer la responsabilité.

5. Évolutions du service
L'administrateur peut, pour des raisons d'exploitation, ajuster les modèles, les crédits, les méthodes de connexion, le stockage cloud, les politiques de nettoyage automatique ou suspendre certaines fonctionnalités. En cas d'indisponibilité due à un fournisseur de modèles, de stockage, d'e-mail ou de connexion tiers, Aivro s'efforce de rétablir le service mais ne garantit pas une disponibilité ininterrompue.

6. Mises à jour des conditions
Nous pouvons mettre à jour ces conditions pour des raisons fonctionnelles ou de conformité. Le contenu mis à jour est affiché sur cette page. Continuer à utiliser ou à vous connecter à Aivro signifie que vous acceptez les conditions mises à jour.`;

const fallbackContent: Record<Locale, { privacy: string; terms: string }> = {
    "zh-CN": { privacy: privacyZh, terms: termsZh },
    "en-US": { privacy: privacyEn, terms: termsEn },
    "ja-JP": { privacy: privacyJa, terms: termsJa },
    "ko-KR": { privacy: privacyKo, terms: termsKo },
    "fr-FR": { privacy: privacyFr, terms: termsFr },
};

const titles: Record<Locale, { privacy: string; terms: string; back: string }> = {
    "zh-CN": { privacy: "隐私政策", terms: "服务条款", back: "返回登录" },
    "en-US": { privacy: "Privacy Policy", terms: "Terms of Service", back: "Back to sign in" },
    "ja-JP": { privacy: "プライバシーポリシー", terms: "利用規約", back: "ログインに戻る" },
    "ko-KR": { privacy: "개인정보 처리방침", terms: "서비스 약관", back: "로그인으로 돌아가기" },
    "fr-FR": { privacy: "Politique de confidentialité", terms: "Conditions d'utilisation", back: "Retour à la connexion" },
};

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
    const pages = useConfigStore((state) => state.publicSettings?.pages);
    const locale = useLocaleStore((state) => state.locale);
    const localizedPath = useLocalizedPath();
    const isPrivacy = type === "privacy";
    // Admin overrides exist for Chinese and English only; other locales use the built-in copy.
    const chinese = locale === "zh-CN";
    const english = locale === "en-US";
    const title = isPrivacy ? (chinese ? pages?.privacyTitle || titles[locale].privacy : english ? pages?.privacyTitleEn || titles[locale].privacy : titles[locale].privacy) : chinese ? pages?.termsTitle || titles[locale].terms : english ? pages?.termsTitleEn || titles[locale].terms : titles[locale].terms;
    const content = isPrivacy
        ? chinese
            ? pages?.privacyContent || fallbackContent[locale].privacy
            : english
              ? pages?.privacyContentEn || fallbackContent[locale].privacy
              : fallbackContent[locale].privacy
        : chinese
          ? pages?.termsContent || fallbackContent[locale].terms
          : english
            ? pages?.termsContentEn || fallbackContent[locale].terms
            : fallbackContent[locale].terms;

    return (
        <main className="h-full overflow-y-auto bg-background px-6 py-10 text-foreground">
            <section className="mx-auto max-w-3xl">
                <Button href={localizedPath("/login")} icon={<ArrowLeft className="size-4" />} type="text" className="mb-8 !text-muted-foreground hover:!bg-muted hover:!text-foreground">
                    {titles[locale].back}
                </Button>
                <div className="py-8">
                    <div className="mb-9">
                        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h1>
                    </div>
                    <article className="whitespace-pre-line text-base leading-8 text-muted-foreground">{content}</article>
                </div>
            </section>
        </main>
    );
}
