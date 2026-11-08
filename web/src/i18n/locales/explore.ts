// 内置工具的六语言文案；模型名、协议字段和用户内容保持原样。
const rows: Record<string, string[]> = {
    "模型发布后第一时间接入，添加后 7 天自动消失": ["模型發布後第一時間接入，新增後 7 天自動消失", "Integrated as soon as the model is released; the tag disappears automatically 7 days after it is added", "モデル公開後すぐに導入。タグは追加から7日後に自動的に消えます", "모델 출시 즉시 연동되었으며, 태그는 추가 후 7일 뒤 자동으로 사라집니다", "Intégré dès la sortie du modèle ; le tag disparaît automatiquement 7 jours après son ajout"],
    "选择生成记录": ["選擇生成記錄", "Select generation record", "生成履歴を選択", "생성 기록 선택", "Sélectionner un historique de génération"],
    "每次最多上传 6 张图片": ["每次最多上傳 6 張圖片", "Upload up to 6 images at a time", "一度にアップロードできる画像は6枚までです", "한 번에 최대 6장의 이미지를 업로드할 수 있습니다", "Importez jusqu’à 6 images à la fois"],
    "最多 6 张图片 · 每张不超过 5MB": ["最多 6 張圖片 · 每張不超過 5MB", "Up to 6 images · 5MB per image", "最大6枚 · 1枚あたり5MBまで", "최대 6장 · 이미지당 최대 5MB", "6 images maximum · 5 Mo par image"],
    "确认反推任务": ["確認反推任務", "Confirm prompt reconstruction", "プロンプト逆生成を確認", "프롬프트 역추출 확인", "Confirmer la reconstruction de prompts"],
    "确认反推 {0} 张图片": ["確認反推 {0} 張圖片", "Reconstruct prompts for {0} images", "{0}枚の逆生成を確定", "이미지 {0}장 역추출 확인", "Confirmer pour {0} images"],
    "每张图片独立计费，按实际使用的 token 四舍五入扣除整数点数。": ["每張圖片獨立計費，按實際使用的 token 四捨五入扣除整數點數。", "Each image is billed separately for actual token usage, rounded to the nearest whole credit.", "画像ごとに実際のトークン使用量で課金し、四捨五入した整数のポイントを差し引きます。", "각 이미지는 실제 토큰 사용량에 따라 개별 과금되며, 포인트를 반올림하여 정수로 차감합니다.", "Chaque image est facturée séparément selon les tokens réellement utilisés, avec un arrondi au crédit entier le plus proche."],
    "提示词反推需要按词元计费的文本模型": ["提示詞反推需要按詞元計費的文字模型", "Prompt reconstruction requires an enabled text model with token billing", "逆生成にはトークン課金の有効なテキストモデルが必要です", "프롬프트 역추출에는 토큰 과금 방식의 활성 텍스트 모델이 필요합니다", "La reconstruction nécessite un modèle de texte activé avec une facturation par token"],
    "模型未返回词元用量，本次反推未扣费": ["模型未傳回詞元用量，本次反推未扣費", "The model did not report token usage. No credits were charged for this reconstruction.", "モデルがトークン使用量を返さなかったため、今回の逆生成は課金されませんでした。", "모델이 토큰 사용량을 반환하지 않아 이번 역추출은 과금되지 않았습니다.", "Le modèle n’a pas indiqué l’utilisation des tokens. Aucun crédit n’a été facturé pour cette reconstruction."],
    "正在反推": ["正在反推", "Reconstructing prompt", "プロンプトを逆生成中", "프롬프트 역추출 중", "Reconstruction en cours"],
    "反推完成": ["反推完成", "Prompt ready", "逆生成が完了しました", "역추출 완료", "Prompt prêt"],
    "双击查看提示词": ["按兩下查看提示詞", "Double-click to view the prompt", "ダブルクリックでプロンプトを表示", "두 번 클릭하여 프롬프트 보기", "Double-cliquez pour voir le prompt"],
    "查看提示词": ["查看提示詞", "View prompt", "プロンプトを表示", "프롬프트 보기", "Voir le prompt"],
    "新建任务": ["新增任務", "New task", "新規タスク", "새 작업", "Nouvelle tâche"],
"Free [限量] 仅用于免费生图活动，常规工作台和 API 仍按原价计费。": ["Free [限量] 僅用於免費生圖活動，一般工作台和 API 仍按原價計費。","Free [Limited] applies only to free image campaigns. Regular studios and the API retain their normal pricing.","Free [数量限定] は無料画像キャンペーンのみ適用され、通常のワークスペースと API は通常料金です。","Free [한정]은 무료 이미지 이벤트에만 적용됩니다. 일반 워크스페이스와 API는 기존 요금으로 과금됩니다.","Free [Limité] s’applique uniquement aux campagnes gratuites. Les ateliers habituels et l’API conservent leur tarification normale."],
    "免费生成图片尚未开启": [
        "免費生成圖片尚未開啟",
        "Free image generation is disabled",
        "無料画像生成は無効です",
        "무료 이미지 생성이 비활성화되어 있습니다",
        "La génération gratuite d’images est désactivée"
    ],
    "提示词反推尚未开启": [
        "提示詞反推尚未開啟",
        "Prompt reverse is disabled",
        "プロンプト逆生成は無効です",
        "프롬프트 역추출이 비활성화되어 있습니다",
        "La reconstruction de prompts est désactivée"
    ],
    "Free [限量]": [
        "Free [限量]",
        "Free [Limited]",
        "Free [数量限定]",
        "Free [한정]",
        "Free [Limité]"
    ],
    "限量活动，让好作品获得奖励": [
        "限量活動，讓好作品獲得獎勵",
        "Limited campaigns that reward great work",
        "数量限定キャンペーンで作品に報酬を",
        "한정 이벤트로 좋은 작품에 보상을",
        "Des campagnes limitées pour récompenser les belles créations"
    ],
    "查看协议": [
        "查看協議",
        "View agreement",
        "同意内容を確認",
        "약관 보기",
        "Voir l’accord"
    ],
    "登录后参加免费活动": [
        "登入後參加免費活動",
        "Sign in to join a free campaign",
        "ログインして無料キャンペーンに参加",
        "로그인하여 무료 이벤트에 참여하세요",
        "Connectez-vous pour participer à une campagne gratuite"
    ],
    "当前暂未免费活动": [
        "目前暫無免費活動",
        "No free campaign is currently available",
        "現在、無料キャンペーンはありません",
        "현재 진행 중인 무료 이벤트가 없습니다",
        "Aucune campagne gratuite n’est disponible pour le moment"
    ],
    "活动结束：{0}": [
        "活動結束：{0}",
        "Campaign ends: {0}",
        "終了日時：{0}",
        "이벤트 종료: {0}",
        "Fin de la campagne : {0}"
    ],
    "本期剩余 {0} / {1} 次": [
        "本期剩餘 {0} / {1} 次",
        "{0} / {1} uses remaining this campaign",
        "今回の残り回数：{0} / {1}",
        "이번 이벤트 잔여 횟수 {0} / {1}",
        "{0} / {1} utilisations restantes pour cette campagne"
    ],
    "排队中，前方 {0} 个任务": [
        "排隊中，前方 {0} 個任務",
        "Queued, {0} tasks ahead",
        "待機中、前に {0} 件のタスク",
        "대기 중, 앞에 {0}개 작업",
        "En file d’attente, {0} tâches avant vous"
    ],
    "用一段提示词，开启本期创作": [
        "用一段提示詞，開啟本期創作",
        "Start creating with a prompt",
        "プロンプトから今回の創作を始めましょう",
        "프롬프트로 이번 창작을 시작하세요",
        "Commencez à créer avec un prompt"
    ],
    "本期额度按会员等级分配，每次生成一张图片。": [
        "本期額度依會員等級分配，每次生成一張圖片。",
        "Campaign quotas depend on membership level. Each use generates one image.",
        "利用回数は会員レベルごとに設定され、1 回につき 1 枚を生成します。",
        "이벤트 할당량은 회원 등급에 따라 정해지며 한 번에 이미지 한 장을 생성합니다.",
        "Le quota dépend du niveau d’abonnement. Chaque utilisation génère une image."
    ],
    "本期暂无可用图片模型": [
        "本期暫無可用圖片模型",
        "No image models are available for this campaign",
        "今回利用可能な画像モデルはありません",
        "이번 이벤트에서 사용 가능한 이미지 모델이 없습니다",
        "Aucun modèle d’image n’est disponible pour cette campagne"
    ],
    "本期免费次数已用完": [
        "本期免費次數已用完",
        "You have used all free attempts for this campaign",
        "今回の無料利用回数を使い切りました",
        "이번 이벤트 무료 횟수를 모두 사용했습니다",
        "Vous avez épuisé vos utilisations gratuites pour cette campagne"
    ],
    "描述你想免费生成的画面...": [
        "描述你想免費生成的畫面...",
        "Describe the image you want to generate for free...",
        "無料で生成したい画像を説明してください...",
        "무료로 생성할 이미지를 설명하세요...",
        "Décrivez l’image que vous souhaitez générer gratuitement..."
    ],
    "免费生成图片协议": [
        "免費生成圖片協議",
        "Free image generation agreement",
        "無料画像生成への同意",
        "무료 이미지 생성 약관",
        "Accord de génération gratuite d’images"
    ],
    "同意并继续": [
        "同意並繼續",
        "Agree and continue",
        "同意して続ける",
        "동의하고 계속",
        "Accepter et continuer"
    ],
    "免费生成图片：Aivro 会根据你图片的质量公开你生成的图片和提示词。公开后，你将获得一定的奖励额度。": [
        "免費生成圖片：Aivro 會根據你圖片的品質公開你生成的圖片和提示詞。公開後，你將獲得一定的獎勵額度。",
        "Free image generation: Aivro may publish your generated images and prompts based on their quality. Once published, you will receive reward credits.",
        "無料画像生成：Aivro は画像の品質に応じて、生成した画像とプロンプトを公開します。公開後、報酬クレジットが付与されます。",
        "무료 이미지 생성: Aivro는 이미지 품질에 따라 생성한 이미지와 프롬프트를 공개할 수 있습니다. 공개되면 보상 크레딧이 지급됩니다.",
        "Génération gratuite d’images : Aivro peut publier vos images et prompts selon leur qualité. Après publication, vous recevrez des crédits de récompense."
    ],
    "公开与奖励由管理员审核决定，奖励额度在审核后发放。请仅提交你有权公开的内容。": [
        "公開與獎勵由管理員審核決定，獎勵額度於審核後發放。請僅提交你有權公開的內容。",
        "An administrator reviews publication and rewards. Credits are issued after approval. Only submit content you have the right to publish.",
        "公開と報酬は管理者が審査し、承認後にクレジットを付与します。公開する権利のある内容のみ提出してください。",
        "공개와 보상은 관리자의 심사를 거쳐 결정되며 승인 후 지급됩니다. 공개할 권리가 있는 콘텐츠만 제출하세요.",
        "La publication et la récompense sont soumises à l’examen d’un administrateur. Les crédits sont versés après approbation. Ne soumettez que du contenu que vous pouvez publier."
    ],
    "我已阅读并同意公开图片和提示词": [
        "我已閱讀並同意公開圖片和提示詞",
        "I have read and agree to publication of my images and prompts",
        "内容を読み、画像とプロンプトの公開に同意します",
        "내용을 읽었으며 이미지와 프롬프트 공개에 동의합니다",
        "J’ai lu et j’accepte la publication de mes images et prompts"
    ],
    "新记录保存 {0} 天": [
        "新記錄保存 {0} 天",
        "New records are kept for {0} days",
        "新しい記録の保存期間：{0} 日",
        "새 기록은 {0}일 동안 보관됩니다",
        "Les nouveaux historiques sont conservés {0} jours"
    ],
    "保存至 {0}": [
        "保存至 {0}",
        "Kept until {0}",
        "保存期限：{0}",
        "보관 기한: {0}",
        "Conservé jusqu’au {0}"
    ],
    "暂无记录": [
        "暫無記錄",
        "No records yet",
        "記録はありません",
        "아직 기록이 없습니다",
        "Aucun historique pour le moment"
    ],
    "删除这条记录？": [
        "刪除這筆記錄？",
        "Delete this record?",
        "この記録を削除しますか？",
        "이 기록을 삭제할까요?",
        "Supprimer cet historique ?"
    ],
    "从图片中还原主体、构图、光线和风格": [
        "從圖片中還原主體、構圖、光線和風格",
        "Reconstruct subjects, composition, lighting and style from an image",
        "画像から被写体・構図・光・スタイルを再現",
        "이미지의 피사체, 구도, 조명과 스타일을 복원하세요",
        "Reconstituez le sujet, la composition, la lumière et le style d’une image"
    ],
    "登录后使用提示词反推": [
        "登入後使用提示詞反推",
        "Sign in to reconstruct image prompts",
        "ログインしてプロンプト逆生成を使用",
        "로그인하여 프롬프트 역추출을 사용하세요",
        "Connectez-vous pour reconstruire les prompts"
    ],
    "反推参考图": [
        "反推參考圖",
        "Reference image for prompt reconstruction",
        "逆生成用の参照画像",
        "역추출 참조 이미지",
        "Image de référence pour la reconstruction"
    ],
    "上传或拖入图片": [
        "上傳或拖入圖片",
        "Upload or drop an image",
        "画像をアップロードまたはドロップ",
        "이미지를 업로드하거나 끌어다 놓으세요",
        "Importez ou déposez une image"
    ],
    "PNG、JPEG、WebP，最大 5MB": [
        "PNG、JPEG、WebP，最大 5MB",
        "PNG, JPEG or WebP, up to 5MB",
        "PNG・JPEG・WebP、最大 5MB",
        "PNG, JPEG, WebP, 최대 5MB",
        "PNG, JPEG ou WebP, 5 Mo maximum"
    ],
    "选择图片": [
        "選擇圖片",
        "Choose an image",
        "画像を選択",
        "이미지 선택",
        "Choisir une image"
    ],
    "选择图片和文本模型，开始反推提示词": [
        "選擇圖片和文字模型，開始反推提示詞",
        "Choose an image and a text model to reconstruct its prompt",
        "画像とテキストモデルを選択して逆生成を開始",
        "이미지와 텍스트 모델을 선택해 프롬프트를 역추출하세요",
        "Choisissez une image et un modèle de texte pour reconstruire son prompt"
    ],
    "反推提示词": [
        "反推提示詞",
        "Reconstructed prompt",
        "逆生成プロンプト",
        "역추출 프롬프트",
        "Prompt reconstitué"
    ],
    "画面分析": [
        "畫面分析",
        "Image analysis",
        "画像分析",
        "이미지 분석",
        "Analyse de l’image"
    ],
    "结构化提示词": [
        "結構化提示詞",
        "Structured prompt",
        "構造化プロンプト",
        "구조화된 프롬프트",
        "Prompt structuré"
    ],
    "复制 JSON": [
        "複製 JSON",
        "Copy JSON",
        "JSON をコピー",
        "JSON 복사",
        "Copier le JSON"
    ],
    "用于生图": [
        "用於生圖",
        "Use for image generation",
        "画像生成に使用",
        "이미지 생성에 사용",
        "Utiliser pour générer une image"
    ],
    "选择文本模型": [
        "選擇文字模型",
        "Choose a text model",
        "テキストモデルを選択",
        "텍스트 모델 선택",
        "Choisir un modèle de texte"
    ],
    "开始反推": [
        "開始反推",
        "Reconstruct prompt",
        "逆生成を開始",
        "역추출 시작",
        "Reconstituer le prompt"
    ],
    "按所选文本模型计费，反推记录到期后自动删除。": [
        "依所選文字模型計費，反推記錄到期後自動刪除。",
        "Billed using the selected text model. Reconstruction records are deleted after expiry.",
        "選択したテキストモデルで課金され、記録は保存期限後に自動削除されます。",
        "선택한 텍스트 모델 기준으로 과금되며 역추출 기록은 기한이 지나면 자동 삭제됩니다.",
        "Facturation selon le modèle de texte choisi. L’historique est supprimé automatiquement à son expiration."
    ],
    "暂无已开放的文本模型": [
        "暫無已開放的文字模型",
        "No text models are enabled",
        "有効なテキストモデルはありません",
        "활성화된 텍스트 모델이 없습니다",
        "Aucun modèle de texte n’est activé"
    ],
    "反推图片仅支持 PNG、JPEG、WebP，单张不超过 5MB": [
        "反推圖片僅支援 PNG、JPEG、WebP，單張不超過 5MB",
        "Only PNG, JPEG and WebP images up to 5MB are supported",
        "逆生成画像は PNG・JPEG・WebP に対応し、1 枚最大 5MB です",
        "역추출 이미지는 PNG, JPEG, WebP만 지원하며 장당 최대 5MB입니다",
        "Seules les images PNG, JPEG et WebP de 5 Mo maximum sont acceptées"
    ],
    "反推图片格式无效": [
        "反推圖片格式無效",
        "Invalid reference image format",
        "参照画像の形式が無効です",
        "참조 이미지 형식이 잘못되었습니다",
        "Format de l’image de référence invalide"
    ],
    "读取图片失败": [
        "讀取圖片失敗",
        "Could not read the image",
        "画像を読み込めませんでした",
        "이미지를 읽지 못했습니다",
        "Impossible de lire l’image"
    ],
    "反推失败": [
        "反推失敗",
        "Prompt reconstruction failed",
        "プロンプト逆生成に失敗しました",
        "프롬프트 역추출에 실패했습니다",
        "La reconstruction du prompt a échoué"
    ],
    "提示词反推只能选择已开放的文本模型": [
        "提示詞反推只能選擇已開放的文字模型",
        "Prompt reconstruction only supports enabled text models",
        "逆生成では有効なテキストモデルのみ選択できます",
        "프롬프트 역추출은 활성화된 텍스트 모델만 사용할 수 있습니다",
        "La reconstruction accepte uniquement les modèles de texte activés"
    ],
    "模型未返回有效的反推结果": [
        "模型未返回有效的反推結果",
        "The model returned an invalid reconstruction result",
        "モデルから有効な逆生成結果が返されませんでした",
        "모델이 유효한 역추출 결과를 반환하지 않았습니다",
        "Le modèle a renvoyé un résultat de reconstruction invalide"
    ],
    "模型未返回完整的六语言反推结果": [
        "模型未返回完整的六語言反推結果",
        "The model did not return complete results in all six languages",
        "モデルから 6 言語すべての結果が返されませんでした",
        "모델이 6개 언어의 완전한 결과를 반환하지 않았습니다",
        "Le modèle n’a pas renvoyé de résultats complets dans les six langues"
    ],
    "请先同意免费生成图片协议": [
        "請先同意免費生成圖片協議",
        "Please accept the free image generation agreement first",
        "先に無料画像生成への同意が必要です",
        "먼저 무료 이미지 생성 약관에 동의하세요",
        "Veuillez d’abord accepter l’accord de génération gratuite d’images"
    ],
    "该模型不在本期免费活动中": [
        "該模型不在本期免費活動中",
        "This model is not included in the current free campaign",
        "このモデルは今回の無料キャンペーン対象外です",
        "이 모델은 이번 무료 이벤트에 포함되지 않습니다",
        "Ce modèle ne fait pas partie de la campagne gratuite actuelle"
    ],
    "请输入生图提示词，最多 20000 字节": [
        "請輸入生圖提示詞，最多 20000 位元組",
        "Enter an image prompt of up to 20,000 bytes",
        "画像生成プロンプトを 20,000 バイト以内で入力してください",
        "이미지 프롬프트를 최대 20,000바이트로 입력하세요",
        "Saisissez un prompt d’image de 20 000 octets maximum"
    ],
    "作品奖励": [
        "作品獎勵",
        "Creation reward",
        "作品報酬",
        "작품 보상",
        "Récompense de création"
    ],
    "免费生图作品公开奖励": [
        "免費生圖作品公開獎勵",
        "Reward for publishing a free campaign image",
        "無料生成作品の公開報酬",
        "무료 생성 작품 공개 보상",
        "Récompense pour la publication d’une image de campagne gratuite"
    ],
    "管理员开启后，可从首页导航或工作空间的“探索更多”进入内置工具。提示词反推使用文本模型并保留限时记录；免费生图仅在活动期间开放，次数以本期活动和会员等级为准。": [
        "管理員開啟後，可從首頁導覽或工作空間的「探索更多」進入內置工具。提示詞反推使用文字模型並保留限時記錄；免費生圖僅在活動期間開放，次數以本期活動和會員等級為準。",
        "Once enabled by an administrator, the built-in tools appear in home navigation and Explore more in the workspace. Prompt reconstruction uses text models and keeps expiring records. Free image generation is available only during campaigns, with quotas based on campaign and membership level.",
        "管理者が有効にすると、ホームのナビゲーションまたはワークスペースの「さらに探索」から内蔵ツールを利用できます。逆生成はテキストモデルを使い、記録には保存期限があります。無料画像生成はキャンペーン期間中のみ利用でき、回数はキャンペーンと会員レベルに応じます。",
        "관리자가 활성화하면 홈 내비게이션 또는 워크스페이스의 '더 탐색하기'에서 내장 도구를 사용할 수 있습니다. 역추출은 텍스트 모델을 사용하며 기록에는 보관 기한이 있습니다. 무료 이미지 생성은 이벤트 기간에만 가능하며 횟수는 이벤트와 회원 등급에 따라 정해집니다.",
        "Une fois activés par l’administrateur, les outils intégrés sont accessibles depuis la navigation d’accueil ou « Explorer plus ». La reconstruction utilise des modèles de texte et conserve un historique temporaire. La génération gratuite est réservée aux campagnes, avec un quota selon la campagne et l’abonnement."
    ],
    "参与本站免费生图活动，用限量次数尝试新的创意。": [
        "參與本站免費生圖活動，用限量次數嘗試新的創意。",
        "Join a free image campaign and try new ideas with a limited quota.",
        "無料画像生成キャンペーンに参加し、限られた回数で新しいアイデアを試しましょう。",
        "사이트 무료 이미지 이벤트에 참여해 한정 횟수로 새로운 아이디어를 시도하세요.",
        "Participez aux campagnes gratuites et explorez de nouvelles idées avec un quota limité."
    ]
};

export const exploreTranslations: Record<string, Record<string, string>> = Object.fromEntries(
    ["zh-TW","en-US","ja-JP","ko-KR","fr-FR"].map((locale, index) => [locale, Object.fromEntries(Object.entries(rows).map(([source, values]) => [source, values[index]]))]),
);

export const exploreAdminTranslations: Record<string, string> = {
    "内置工具与活动": "Built-in tools and campaigns",
    "内置工具": "Built-in tools",
    "两个工具默认关闭；全部关闭时不显示“探索更多”。免费生图还需开启有效活动。": "Both tools are disabled by default. Explore more is hidden when both are off. Free image generation also requires an active campaign.",
    "反推分析提示词": "Reconstruction system prompt",
    "参考 MX-Insight 的分析维度；可手动调整内容，保留六语言 JSON 输出结构。反推只使用已开放的文本模型，按文本模型价格计费。": "Based on MX-Insight’s analysis dimensions. You can edit the instructions while retaining the six-language JSON schema. Only enabled text models are used and their pricing applies.",
    "请输入反推分析提示词": "Enter the reconstruction system prompt",
    "内置工具设置已保存": "Built-in tool settings saved",
    "免费活动已保存": "Free campaign saved",
    "免费生图活动": "Free image campaigns",
    "新建活动": "New campaign",
    "每一期活动独立计算会员次数，0 次表示不可使用。每次生成一张图片，失败或撤销返还次数；活动不可重叠，结束后自动停止。常规工作台与 API 仍按原价计费。": "Each campaign has its own membership quotas; 0 disables access. Each use generates one image, with failures or cancellations refunded. Campaigns cannot overlap and stop automatically when they end. Regular studios and the API retain their normal pricing.",
    "活动名称": "Campaign name",
    "未开启": "Disabled",
    "未开始": "Not started",
    "已结束": "Ended",
    "活动时间": "Campaign period",
    "可用模型": "Available models",
    "会员次数": "Membership quotas",
    "修改免费活动": "Edit free campaign",
    "新建免费活动": "New free campaign",
    "请输入活动名称": "Enter the campaign name",
    "开启活动": "Enable campaign",
    "活动起止时间": "Campaign start and end",
    "请设置活动起止时间": "Set campaign start and end times",
    "本期可用图片模型": "Image models for this campaign",
    "请选择本期可用图片模型": "Choose image models for this campaign",
    "请输入活动次数": "Enter campaign quota",
    "免费作品审核": "Free image review",
    "按图片质量挑选作品，公开图片及提示词到素材库，并发放设定的奖励算力点。同一作品只能公开和奖励一次，公开副本保留在素材库中。": "Select works based on quality, publish the image and prompt to the asset library, and award the configured credits. Each work can be published and rewarded once. A publication copy is retained in the library.",
    "作品已公开，奖励已发放": "Work published and reward issued",
    "奖励": "Reward",
    "已公开，奖励 {0} 点": "Published, rewarded {0} credits",
    "公开并奖励": "Publish and reward",
    "公开免费作品并发放奖励": "Publish free image and award credits",
    "公开标题": "Publication title",
    "请输入公开标题": "Enter a publication title",
    "公开提示词": "Published prompt",
    "请输入公开提示词": "Enter the published prompt",
    "奖励算力点": "Reward credits",
    "请输入奖励算力点": "Enter reward credits",
    "请填写提示词反推的分析提示词，最多 40000 字节": "Enter a reconstruction system prompt of up to 40,000 bytes",
    "请设置有效的活动起止时间": "Set valid campaign start and end times",
    "活动结束时间必须晚于开始时间": "Campaign end must be later than its start",
    "请填写活动名称并选择图片模型": "Enter the campaign name and choose image models",
    "活动只能选择已开放的图片模型": "Campaigns can only use enabled image models",
    "活动会员次数无效": "Invalid membership campaign quota",
    "请配置所有会员等级的活动次数": "Set quotas for all membership levels",
    "免费活动时间不能重叠": "Free campaigns cannot overlap",
    "公开奖励需为 1–1000000 算力点": "Publication rewards must be 1–1,000,000 credits",
    "作品不存在或已过期": "The work does not exist or has expired",
    "作品已公开或不存在": "The work is already published or does not exist",
    "作品公开或奖励发放失败，请刷新后重试": "Publication or reward failed. Refresh and try again."
};
