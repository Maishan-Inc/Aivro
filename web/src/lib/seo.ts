import type { Metadata } from "next";

import type { Locale } from "@/i18n/messages";
import { defaultLocale, locales, withLocalePath } from "@/i18n/routing";

export const siteUrl = "https://aivro.org";

export type SeoPageKey =
    | "home"
    | "pricing"
    | "models"
    | "developers"
    | "image"
    | "video"
    | "model3d"
    | "canvas"
    | "prompts"
    | "assets"
    | "assetLibrary"
    | "privacy"
    | "terms"
    | "login"
    | "forgotPassword"
    | "profileSetup"
    | "pricingSuccess"
    | "metamaskEmail"
    | "workflowShare";

export type SeoPage = {
    path: string;
    index: boolean;
    private?: boolean;
    title: Record<Locale, string>;
    description: Record<Locale, string>;
};

export const seoPages: Record<SeoPageKey, SeoPage> = {
    developers: {
        path: "/developers",
        index: true,
        title: {
            "zh-CN": "开发文档 · API 接入指南 - Aivro",
            "zh-TW": "開發文件 · API 串接指南 - Aivro",
            "en-US": "Developer Documentation · API Integration Guide - Aivro",
            "ja-JP": "開発ドキュメント · API 連携ガイド - Aivro",
            "ko-KR": "개발 문서 · API 연동 가이드 - Aivro",
            "fr-FR": "Documentation développeur · Guide d’intégration API - Aivro",
        },
        description: {
            "zh-CN": "Aivro API 开发文档，包含密钥鉴权、模型查询、图片、对话、视频、3D 生成、异步任务、计费与 22 种编程语言的代码示例。",
            "zh-TW": "Aivro API 開發文件，涵蓋金鑰驗證、模型查詢、圖片、對話、影片、3D 生成、非同步任務、計費與 22 種程式語言範例。",
            "en-US": "Aivro API documentation covering API keys, models, images, chat, video, 3D generation, asynchronous tasks, billing, and examples in 22 programming languages.",
            "ja-JP": "API キー認証、モデル検索、画像・対話・動画・3D 生成、非同期タスク、料金、22 言語のコード例を解説する Aivro API ドキュメント。",
            "ko-KR": "API 키 인증, 모델 조회, 이미지·대화·영상·3D 생성, 비동기 작업, 요금 및 22개 프로그래밍 언어 예제를 다루는 Aivro API 문서입니다.",
            "fr-FR": "Documentation API Aivro : clés API, modèles, images, conversations, vidéos, génération 3D, tâches asynchrones, facturation et exemples dans 22 langages.",
        },
    },
    home: {
        path: "/",
        index: true,
        title: {
            "zh-CN": "Aivro - AI 无限画布创作工具",
            "zh-TW": "Aivro - AI 無限畫布創作工具",
            "en-US": "Aivro - AI Infinite Canvas Creation Tool",
            "ja-JP": "Aivro - AI インフィニットキャンバス創作ツール",
            "ko-KR": "Aivro - AI 무한 캔버스 창작 도구",
            "fr-FR": "Aivro - Outil de création IA sur canevas infini",
        },
        description: {
            "zh-CN": "Aivro 支持图片、视频、文本、提示词和工作流创作，让每次生成都沉淀为连续可复用的 AI 创作流程。",
            "zh-TW": "Aivro 支持圖片、影片、文本、提示詞和工作流創作，讓每次生成都沉澱為連續可複用的 AI 創作流程。",
            "en-US": "Aivro helps you create images, videos, text, prompts, and workflows so every generation becomes a reusable AI creation process.",
            "ja-JP": "Aivro は画像・動画・テキスト・プロンプト・ワークフローの作成に対応し、生成のたびに再利用できる AI 創作フローを築きます。",
            "ko-KR": "Aivro는 이미지, 영상, 텍스트, 프롬프트, 워크플로 제작을 지원하며 모든 생성이 재사용 가능한 AI 창작 흐름으로 이어집니다.",
            "fr-FR": "Aivro permet de créer images, vidéos, textes, prompts et workflows pour que chaque génération devienne un processus créatif IA réutilisable.",
        },
    },
    pricing: {
        path: "/pricing",
        index: true,
        title: { "zh-CN": "套餐购买 - Aivro", "zh-TW": "套餐購買 - Aivro", "en-US": "Plans - Aivro", "ja-JP": "プラン - Aivro", "ko-KR": "요금제 - Aivro", "fr-FR": "Offres - Aivro" },
        description: {
            "zh-CN": "购买 Aivro 套餐，获取算力点和云端工作流创建次数，支持图片、视频、画布和 AI 创作。",
            "zh-TW": "購買 Aivro 套餐，獲取算力點和雲端工作流建立次數，支持圖片、影片、畫布和 AI 創作。",
            "en-US": "Buy Aivro plans to get credits and cloud workflow quota for image, video, canvas, and AI creation.",
            "ja-JP": "Aivro のプランを購入してクレジットとクラウドワークフローの作成回数を取得し、画像・動画・キャンバス・AI 創作に活用できます。",
            "ko-KR": "Aivro 요금제를 구매해 크레딧과 클라우드 워크플로 생성 횟수를 받고 이미지, 영상, 캔버스, AI 창작에 사용하세요.",
            "fr-FR": "Achetez une offre Aivro pour obtenir des crédits et des créations de workflows cloud pour l'image, la vidéo, le canevas et la création IA.",
        },
    },
    models: {
        path: "/models",
        index: true,
        title: { "zh-CN": "模型定价表 - Aivro", "zh-TW": "模型定價表 - Aivro", "en-US": "Model pricing - Aivro", "ja-JP": "モデル料金表 - Aivro", "ko-KR": "모델 요금표 - Aivro", "fr-FR": "Tarifs des modèles - Aivro" },
        description: {
            "zh-CN": "查看 Aivro 各模型在控制台的标准价、GO、Plus、Pro、Max 会员价和 API 单价，了解每个模型消耗多少算力点。",
            "zh-TW": "查看 Aivro 各模型在控制台的標準價、GO、Plus、Pro、Max 會員價和 API 單價，了解每個模型消耗多少算力點。",
            "en-US": "Check standard credits, GO / Plus / Pro / Max member pricing, and API unit prices for every model available in Aivro.",
            "ja-JP": "Aivro で利用できる各モデルの標準クレジット、GO・Plus・Pro・Max の会員価格、API 単価を確認できます。",
            "ko-KR": "Aivro에서 사용할 수 있는 모든 모델의 표준 크레딧, GO·Plus·Pro·Max 회원 가격, API 단가를 확인하세요.",
            "fr-FR": "Consultez les crédits standard, les tarifs membres GO / Plus / Pro / Max et les prix API de chaque modèle Aivro.",
        },
    },
    image: {
        path: "/image",
        index: true,
        title: { "zh-CN": "AI 生图工作台 - Aivro", "zh-TW": "AI 生圖工作台 - Aivro", "en-US": "AI Image Studio - Aivro", "ja-JP": "AI 画像スタジオ - Aivro", "ko-KR": "AI 이미지 스튜디오 - Aivro", "fr-FR": "Studio d'image IA - Aivro" },
        description: {
            "zh-CN": "在 Aivro 生图工作台使用后台配置的模型生成图片，管理参考图、参数和云端生成记录。",
            "zh-TW": "在 Aivro 生圖工作台使用後台設定的模型生成圖片，管理參考圖、參數和雲端生成記錄。",
            "en-US": "Generate images with configured AI models in Aivro Image Studio, with reference images, settings, and cloud history.",
            "ja-JP": "Aivro 画像スタジオでは設定済みのモデルで画像を生成し、参照画像・パラメーター・クラウド生成履歴を管理できます。",
            "ko-KR": "Aivro 이미지 스튜디오에서 설정된 모델로 이미지를 생성하고 참조 이미지, 설정, 클라우드 생성 기록을 관리하세요.",
            "fr-FR": "Générez des images avec les modèles configurés dans le Studio d'image Aivro, avec images de référence, réglages et historique cloud.",
        },
    },
    video: {
        path: "/video",
        index: true,
        title: { "zh-CN": "AI 视频创作台 - Aivro", "zh-TW": "AI 影片創作台 - Aivro", "en-US": "AI Video Studio - Aivro", "ja-JP": "AI 動画スタジオ - Aivro", "ko-KR": "AI 비디오 스튜디오 - Aivro", "fr-FR": "Studio vidéo IA - Aivro" },
        description: {
            "zh-CN": "使用 Aivro 视频创作台生成视频，支持提示词、参考图、清晰度、尺寸、秒数和生成记录。",
            "zh-TW": "使用 Aivro 影片創作台生成影片，支持提示詞、參考圖、清晰度、尺寸、秒數和生成記錄。",
            "en-US": "Create videos in Aivro Video Studio with prompts, reference images, resolution, size, duration, and generation history.",
            "ja-JP": "Aivro 動画スタジオではプロンプト、参照画像、解像度、サイズ、秒数、生成履歴を使って動画を生成できます。",
            "ko-KR": "Aivro 비디오 스튜디오에서 프롬프트, 참조 이미지, 해상도, 크기, 길이, 생성 기록을 활용해 영상을 만드세요.",
            "fr-FR": "Créez des vidéos dans le Studio vidéo Aivro avec prompts, images de référence, résolution, taille, durée et historique.",
        },
    },
    model3d: {
        path: "/model-3d",
        index: true,
        title: { "zh-CN": "AI 3D 模型工作台 - Aivro", "zh-TW": "AI 3D 模型工作台 - Aivro", "en-US": "AI 3D Model Studio - Aivro", "ja-JP": "AI 3D モデルスタジオ - Aivro", "ko-KR": "AI 3D 모델 스튜디오 - Aivro", "fr-FR": "Studio de modèles 3D IA - Aivro" },
        description: {
            "zh-CN": "通过 Aivro 3D 模型工作台探索 AI 生成 3D 内容的创作流程。",
            "zh-TW": "通過 Aivro 3D 模型工作台探索 AI 生成 3D 內容的創作流程。",
            "en-US": "Explore AI-generated 3D content workflows with Aivro 3D Model Studio.",
            "ja-JP": "Aivro 3D モデルスタジオで、AI による 3D コンテンツ生成の制作フローを体験できます。",
            "ko-KR": "Aivro 3D 모델 스튜디오에서 AI 3D 콘텐츠 생성 작업 흐름을 살펴보세요.",
            "fr-FR": "Explorez les flux de création 3D assistés par IA avec le Studio de modèles 3D Aivro.",
        },
    },
    canvas: {
        path: "/canvas",
        index: false,
        title: { "zh-CN": "AI 工作流画布 - Aivro", "zh-TW": "AI 工作流畫布 - Aivro", "en-US": "AI Workflow Canvas - Aivro", "ja-JP": "AI ワークフローキャンバス - Aivro", "ko-KR": "AI 워크플로 캔버스 - Aivro", "fr-FR": "Canevas de workflow IA - Aivro" },
        description: {
            "zh-CN": "在 Aivro 无限画布中连接图片、文本、参考图和生成节点，把创作变成可复用工作流。",
            "zh-TW": "在 Aivro 無限畫布中連接圖片、文本、參考圖和生成節點，把創作變成可複用工作流。",
            "en-US": "Connect images, text, references, and generation nodes in Aivro's infinite canvas to build reusable workflows.",
            "ja-JP": "Aivro のインフィニティキャンバスで画像・テキスト・参照画像・生成ノードをつなぎ、再利用できるワークフローにします。",
            "ko-KR": "Aivro 무한 캔버스에서 이미지, 텍스트, 참조 이미지, 생성 노드를 연결해 재사용 가능한 워크플로를 만드세요.",
            "fr-FR": "Reliez images, textes, références et nœuds de génération dans le canevas infini Aivro pour créer des workflows réutilisables.",
        },
    },
    prompts: {
        path: "/prompts",
        index: true,
        title: { "zh-CN": "AI 提示词库 - Aivro", "zh-TW": "AI 提示詞庫 - Aivro", "en-US": "AI Prompt Library - Aivro", "ja-JP": "AI プロンプトライブラリ - Aivro", "ko-KR": "AI 프롬프트 라이브러리 - Aivro", "fr-FR": "Bibliothèque de prompts IA - Aivro" },
        description: {
            "zh-CN": "浏览和收藏 Aivro 提示词库中的图片、视频和创作提示词，快速复用稳定风格。",
            "zh-TW": "瀏覽和收藏 Aivro 提示詞庫中的圖片、影片和創作提示詞，快速複用穩定風格。",
            "en-US": "Browse and save image, video, and creative prompts in Aivro's prompt library to reuse proven styles.",
            "ja-JP": "Aivro プロンプトライブラリの画像・動画・創作プロンプトを閲覧・保存して、安定したスタイルをすぐに再利用できます。",
            "ko-KR": "Aivro 프롬프트 라이브러리의 이미지, 영상, 창작 프롬프트를 둘러보고 저장해 안정적인 스타일을 바로 재사용하세요.",
            "fr-FR": "Parcourez et enregistrez les prompts image, vidéo et créatifs de la bibliothèque Aivro pour réutiliser des styles éprouvés.",
        },
    },
    assets: {
        path: "/assets",
        index: false,
        title: { "zh-CN": "我的素材 - Aivro", "zh-TW": "我的素材 - Aivro", "en-US": "My Assets - Aivro", "ja-JP": "マイ素材 - Aivro", "ko-KR": "내 에셋 - Aivro", "fr-FR": "Mes assets - Aivro" },
        description: {
            "zh-CN": "管理 Aivro 中保存的文本、图片和视频素材，支持导入、导出和云端文件引用。",
            "zh-TW": "管理 Aivro 中儲存的文本、圖片和影片素材，支持匯入、匯出和雲端檔案引用。",
            "en-US": "Manage saved text, image, and video assets in Aivro with import, export, and cloud file references.",
            "ja-JP": "Aivro に保存したテキスト・画像・動画の素材を管理し、インポート・エクスポート・クラウドファイル参照が行えます。",
            "ko-KR": "Aivro에 저장된 텍스트, 이미지, 영상 에셋을 관리하고 가져오기, 내보내기, 클라우드 파일 참조를 사용하세요.",
            "fr-FR": "Gérez les assets texte, image et vidéo enregistrés dans Aivro avec import, export et références de fichiers cloud.",
        },
    },
    assetLibrary: {
        path: "/asset-library",
        index: true,
        title: { "zh-CN": "素材库 - Aivro", "zh-TW": "素材庫 - Aivro", "en-US": "Asset Library - Aivro", "ja-JP": "素材ライブラリ - Aivro", "ko-KR": "에셋 라이브러리 - Aivro", "fr-FR": "Bibliothèque d'assets - Aivro" },
        description: {
            "zh-CN": "浏览 Aivro 素材库，发现可用于 AI 创作的文本、图片和视频内容。",
            "zh-TW": "瀏覽 Aivro 素材庫，發現可用於 AI 創作的文本、圖片和影片內容。",
            "en-US": "Browse Aivro's asset library to discover text, image, and video content for AI creation.",
            "ja-JP": "Aivro 素材ライブラリを閲覧し、AI 創作に使えるテキスト・画像・動画を見つけましょう。",
            "ko-KR": "Aivro 에셋 라이브러리에서 AI 창작에 활용할 텍스트, 이미지, 영상 콘텐츠를 찾아보세요.",
            "fr-FR": "Parcourez la bibliothèque d'assets Aivro pour découvrir des contenus texte, image et vidéo pour la création IA.",
        },
    },
    privacy: {
        path: "/privacy",
        index: true,
        title: { "zh-CN": "隐私政策 - Aivro", "zh-TW": "隱私政策 - Aivro", "en-US": "Privacy Policy - Aivro", "ja-JP": "プライバシーポリシー - Aivro", "ko-KR": "개인정보 처리방침 - Aivro", "fr-FR": "Politique de confidentialité - Aivro" },
        description: {
            "zh-CN": "查看 Aivro 隐私政策，了解账号、生成内容、云存储和第三方服务相关数据处理方式。",
            "zh-TW": "查看 Aivro 隱私政策，瞭解帳號、生成內容、雲存儲和第三方服務相關資料處理方式。",
            "en-US": "Read Aivro's privacy policy for account, generated content, cloud storage, and third-party service data handling.",
            "ja-JP": "Aivro のプライバシーポリシーで、アカウント・生成コンテンツ・クラウドストレージ・第三者サービスのデータの取り扱いを確認できます。",
            "ko-KR": "Aivro 개인정보 처리방침에서 계정, 생성 콘텐츠, 클라우드 저장소, 제3자 서비스의 데이터 처리 방식을 확인하세요.",
            "fr-FR": "Consultez la politique de confidentialité Aivro pour le traitement des données de compte, contenus générés, stockage cloud et services tiers.",
        },
    },
    terms: {
        path: "/terms",
        index: true,
        title: { "zh-CN": "服务条款 - Aivro", "zh-TW": "服務條款 - Aivro", "en-US": "Terms of Service - Aivro", "ja-JP": "利用規約 - Aivro", "ko-KR": "서비스 약관 - Aivro", "fr-FR": "Conditions d'utilisation - Aivro" },
        description: {
            "zh-CN": "查看 Aivro 服务条款，了解 AI 创作、账号、安全、内容责任和服务变更规则。",
            "zh-TW": "查看 Aivro 服務條款，瞭解 AI 創作、帳號、安全、內容責任和服務變更規則。",
            "en-US": "Read Aivro's terms for AI creation, accounts, security, content responsibility, and service changes.",
            "ja-JP": "Aivro の利用規約で、AI 創作・アカウント・セキュリティ・コンテンツの責任・サービス変更のルールを確認できます。",
            "ko-KR": "Aivro 서비스 약관에서 AI 창작, 계정, 보안, 콘텐츠 책임, 서비스 변경 규칙을 확인하세요.",
            "fr-FR": "Consultez les conditions Aivro pour la création IA, les comptes, la sécurité, la responsabilité des contenus et les évolutions du service.",
        },
    },
    login: {
        path: "/login",
        index: false,
        title: { "zh-CN": "登录 - Aivro", "zh-TW": "登入 - Aivro", "en-US": "Sign in - Aivro", "ja-JP": "ログイン - Aivro", "ko-KR": "로그인 - Aivro", "fr-FR": "Connexion - Aivro" },
        description: {
            "zh-CN": "登录 Aivro 账号，继续使用工作流、生图、视频、提示词和素材能力。",
            "zh-TW": "登入 Aivro 帳號，繼續使用工作流、生圖、影片、提示詞和素材能力。",
            "en-US": "Sign in to Aivro to continue using workflows, image generation, video creation, prompts, and assets.",
            "ja-JP": "Aivro アカウントにログインして、ワークフロー・画像生成・動画・プロンプト・素材の機能を続けて利用できます。",
            "ko-KR": "Aivro 계정에 로그인해 워크플로, 이미지 생성, 영상, 프롬프트, 에셋 기능을 계속 사용하세요.",
            "fr-FR": "Connectez-vous à Aivro pour continuer à utiliser workflows, génération d'images, vidéo, prompts et assets.",
        },
    },
    forgotPassword: {
        path: "/forgot-password",
        index: false,
        title: { "zh-CN": "找回密码 - Aivro", "zh-TW": "找回密碼 - Aivro", "en-US": "Reset password - Aivro", "ja-JP": "パスワード再設定 - Aivro", "ko-KR": "비밀번호 재설정 - Aivro", "fr-FR": "Réinitialiser le mot de passe - Aivro" },
        description: {
            "zh-CN": "通过已绑定邮箱重置 Aivro 账号密码。",
            "zh-TW": "通過已綁定信箱重置 Aivro 帳號密碼。",
            "en-US": "Reset your Aivro account password with your verified email.",
            "ja-JP": "登録済みのメールアドレスで Aivro アカウントのパスワードを再設定します。",
            "ko-KR": "등록된 이메일로 Aivro 계정 비밀번호를 재설정하세요.",
            "fr-FR": "Réinitialisez le mot de passe de votre compte Aivro avec votre e-mail vérifié.",
        },
    },
    profileSetup: {
        path: "/profile/setup",
        index: false,
        private: true,
        title: { "zh-CN": "完善账户信息 - Aivro", "zh-TW": "完善帳戶資訊 - Aivro", "en-US": "Complete profile - Aivro", "ja-JP": "アカウント情報の入力 - Aivro", "ko-KR": "계정 정보 완성 - Aivro", "fr-FR": "Compléter le profil - Aivro" },
        description: {
            "zh-CN": "完善 Aivro 账号资料后继续创作。",
            "zh-TW": "完善 Aivro 帳號資料後繼續創作。",
            "en-US": "Complete your Aivro profile before continuing.",
            "ja-JP": "Aivro アカウント情報を入力してから制作を続けてください。",
            "ko-KR": "Aivro 계정 정보를 완성한 후 창작을 계속하세요.",
            "fr-FR": "Complétez votre profil Aivro avant de continuer.",
        },
    },
    pricingSuccess: {
        path: "/pricing/success",
        index: false,
        private: true,
        title: { "zh-CN": "支付处理中 - Aivro", "zh-TW": "支付處理中 - Aivro", "en-US": "Payment processing - Aivro", "ja-JP": "決済処理中 - Aivro", "ko-KR": "결제 처리 중 - Aivro", "fr-FR": "Paiement en cours - Aivro" },
        description: {
            "zh-CN": "查看 Aivro 套餐支付后的额度到账状态。",
            "zh-TW": "查看 Aivro 套餐支付後的額度到賬狀態。",
            "en-US": "Check your Aivro plan payment and credit update status.",
            "ja-JP": "Aivro プランの決済後のクレジット反映状況を確認できます。",
            "ko-KR": "Aivro 요금제 결제 후 크레딧 반영 상태를 확인하세요.",
            "fr-FR": "Vérifiez l'état du paiement de votre offre Aivro et de l'ajout des crédits.",
        },
    },
    metamaskEmail: {
        path: "/metamask-email",
        index: false,
        private: true,
        title: { "zh-CN": "绑定 MetaMask 邮箱 - Aivro", "zh-TW": "綁定 MetaMask 郵箱 - Aivro", "en-US": "Bind MetaMask email - Aivro", "ja-JP": "MetaMask メールアドレスの連携 - Aivro", "ko-KR": "MetaMask 이메일 연동 - Aivro", "fr-FR": "Associer un e-mail MetaMask - Aivro" },
        description: {
            "zh-CN": "首次使用 MetaMask 登录 Aivro 时绑定邮箱。",
            "zh-TW": "首次使用 MetaMask 登入 Aivro 時綁定信箱。",
            "en-US": "Bind an email when signing in to Aivro with MetaMask for the first time.",
            "ja-JP": "MetaMask で初めて Aivro にログインする際にメールアドレスを連携します。",
            "ko-KR": "MetaMask로 Aivro에 처음 로그인할 때 이메일을 연동하세요.",
            "fr-FR": "Associez un e-mail lors de votre première connexion à Aivro avec MetaMask.",
        },
    },
    workflowShare: {
        path: "/share/workflows",
        index: false,
        private: true,
        title: { "zh-CN": "工作流分享 - Aivro", "zh-TW": "工作流分享 - Aivro", "en-US": "Workflow share - Aivro", "ja-JP": "ワークフロー共有 - Aivro", "ko-KR": "워크플로 공유 - Aivro", "fr-FR": "Partage de workflow - Aivro" },
        description: {
            "zh-CN": "查看受保护的 Aivro 工作流分享。",
            "zh-TW": "查看受保護的 Aivro 工作流分享。",
            "en-US": "View a protected Aivro workflow share.",
            "ja-JP": "保護された Aivro ワークフローの共有を表示します。",
            "ko-KR": "보호된 Aivro 워크플로 공유를 확인하세요.",
            "fr-FR": "Consultez un partage de workflow Aivro protégé.",
        },
    },
};

export function seoPageForPath(pathname: string) {
    return Object.values(seoPages).find((item) => item.path === pathname) || seoPages.home;
}

export function localizedUrl(path: string, locale: Locale) {
    return `${siteUrl}${withLocalePath(path, locale)}`;
}

export function alternateLanguages(path: string) {
    return Object.fromEntries([...locales.map((locale) => [locale, localizedUrl(path, locale)]), ["x-default", localizedUrl(path, defaultLocale)]]);
}

export function buildMetadata(page: SeoPage, locale: Locale): Metadata {
    const title = page.title[locale];
    const description = page.description[locale];
    const url = localizedUrl(page.path, locale);
    const robots = page.index ? { index: true, follow: true } : { index: false, follow: false };
    if (!page.index || page.private) {
        return {
            title,
            description,
            alternates: page.private ? {} : { canonical: url },
            openGraph: { title, description, siteName: "Aivro", type: "website", locale: locale.replace("-", "_") },
            twitter: { card: "summary", title, description },
            robots,
        };
    }
    return {
        title,
        description,
        alternates: { canonical: url, languages: alternateLanguages(page.path) },
        openGraph: {
            title,
            description,
            url,
            siteName: "Aivro",
            type: "website",
            locale: locale.replace("-", "_"),
            alternateLocale: locales.filter((item) => item !== locale).map((item) => item.replace("-", "_")),
        },
        twitter: { card: "summary_large_image", title, description },
        robots,
    };
}
