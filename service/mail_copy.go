package service

import (
	"strings"

	"golang.org/x/text/language"
)

type mailScene struct {
	Subject, Title, Eyebrow, Body, Hint, Note string
}

type mailWords struct {
	Category, Code, Expiry, Recipient, RequestDetails, IP, Location string
	Safety, Footer, Visit, Unknown, VerifyStep, PasswordStep       string
	TestLabel, TestNote                                           string
	Scenes                                                       map[string]mailScene
}

func canonicalMailLocale(value string) string {
	tag, err := language.Parse(strings.TrimSpace(value))
	if err != nil || tag == language.Und {
		return ""
	}
	base, _ := tag.Base()
	switch base.String() {
	case "zh":
		script, _ := tag.Script()
		region, _ := tag.Region()
		if script.String() == "Hant" || region.String() == "TW" || region.String() == "HK" || region.String() == "MO" {
			return "zh-TW"
		}
		return "zh-CN"
	case "en":
		return "en-US"
	case "ja":
		return "ja-JP"
	case "ko":
		return "ko-KR"
	case "fr":
		return "fr-FR"
	}
	return ""
}

func requestedMailLocale(locale string, acceptLanguage string) string {
	if value := canonicalMailLocale(locale); value != "" {
		return value
	}
	tags, _, err := language.ParseAcceptLanguage(acceptLanguage)
	if err == nil {
		for _, tag := range tags {
			if value := canonicalMailLocale(tag.String()); value != "" {
				return value
			}
		}
	}
	return ""
}

func resolveMailLocale(locale string, fallback string) string {
	if value := canonicalMailLocale(locale); value != "" {
		return value
	}
	if value := canonicalMailLocale(fallback); value != "" {
		return value
	}
	return "zh-CN"
}

var mailTranslations = map[string]mailWords{
	"zh-CN": {
		Category: "账号安全", Code: "邮箱验证码", Expiry: "{{expireMinutes}} 分钟内有效",
		Recipient: "收件邮箱", RequestDetails: "本次请求", IP: "请求 IP", Location: "国家 / 地区",
		Safety: "安全提醒", Footer: "此邮件由系统自动发送，请勿直接回复。", Visit: "访问 Aivro",
		Unknown: "未知", VerifyStep: "验证身份", PasswordStep: "设置新密码",
		TestLabel: "测试邮件", TestNote: "这是一封测试邮件。123456 仅用于预览，不能用于验证账号，也不会修改账号信息。",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] 验证邮箱，完成注册", Title: "验证邮箱，完成注册", Eyebrow: "欢迎加入 Aivro",
				Body: "欢迎加入 {{siteName}}！\n请在注册页面输入下方验证码，完成邮箱验证，开启你的创作之旅。",
				Hint: "验证码仅用于本次注册，请勿转发或分享。",
				Note: "如果你没有申请注册，请忽略此邮件。不要向任何人提供验证码，Aivro 工作人员也不会向你索取。",
			},
			"reset": {
				Subject: "[{{siteName}}] 重置账号密码", Title: "重置你的账号密码", Eyebrow: "密码重置",
				Body: "我们收到了你的 {{siteName}} 账号密码重置请求。\n请返回找回密码页面输入下方验证码，验证身份后设置新密码。",
				Hint: "验证码仅用于本次密码重置，请勿向任何人透露。",
				Note: "如果你没有申请重置密码，请忽略此邮件。仅收到邮件不会更改你的密码。请勿分享验证码，Aivro 工作人员不会向你索取。",
			},
			"metamask": {
				Subject: "[{{siteName}}] 验证 MetaMask 登录邮箱", Title: "确认你的登录邮箱", Eyebrow: "MetaMask 邮箱验证",
				Body: "你正在通过 MetaMask 登录 {{siteName}}。\n请确认收件邮箱无误，然后在登录页面输入下方验证码。",
				Hint: "验证码仅用于本次 MetaMask 登录邮箱验证。",
				Note: "如果不是你发起的登录，请勿输入或分享验证码。Aivro 不会通过邮件索取钱包助记词、私钥或要求转账。",
			},
		},
	},
	"zh-TW": {
		Category: "帳號安全", Code: "信箱驗證碼", Expiry: "{{expireMinutes}} 分鐘內有效",
		Recipient: "收件信箱", RequestDetails: "本次請求", IP: "請求 IP", Location: "國家 / 地區",
		Safety: "安全提醒", Footer: "此郵件由系統自動發送，請勿直接回覆。", Visit: "前往 Aivro",
		Unknown: "未知", VerifyStep: "驗證身分", PasswordStep: "設定新密碼",
		TestLabel: "測試郵件", TestNote: "這是一封測試郵件。123456 僅供預覽，無法用於驗證帳號，也不會修改帳號資訊。",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] 驗證信箱，完成註冊", Title: "驗證信箱，完成註冊", Eyebrow: "歡迎加入 Aivro",
				Body: "歡迎加入 {{siteName}}！\n請在註冊頁面輸入下方驗證碼，完成信箱驗證，開啟你的創作之旅。",
				Hint: "驗證碼僅用於本次註冊，請勿轉寄或分享。",
				Note: "如果你沒有申請註冊，請忽略此郵件。不要向任何人提供驗證碼，Aivro 工作人員也不會向你索取。",
			},
			"reset": {
				Subject: "[{{siteName}}] 重設帳號密碼", Title: "重設你的帳號密碼", Eyebrow: "密碼重設",
				Body: "我們收到了你的 {{siteName}} 帳號密碼重設請求。\n請返回找回密碼頁面輸入下方驗證碼，驗證身分後設定新密碼。",
				Hint: "驗證碼僅用於本次密碼重設，請勿向任何人透露。",
				Note: "如果你沒有申請重設密碼，請忽略此郵件。僅收到郵件不會更改你的密碼。請勿分享驗證碼，Aivro 工作人員不會向你索取。",
			},
			"metamask": {
				Subject: "[{{siteName}}] 驗證 MetaMask 登入信箱", Title: "確認你的登入信箱", Eyebrow: "MetaMask 信箱驗證",
				Body: "你正在透過 MetaMask 登入 {{siteName}}。\n請確認收件信箱無誤，然後在登入頁面輸入下方驗證碼。",
				Hint: "驗證碼僅用於本次 MetaMask 登入信箱驗證。",
				Note: "如果不是你發起的登入，請勿輸入或分享驗證碼。Aivro 不會透過郵件索取錢包助記詞、私鑰或要求轉帳。",
			},
		},
	},
	"en-US": {
		Category: "Account security", Code: "Email verification code", Expiry: "Valid for {{expireMinutes}} minutes",
		Recipient: "Email address", RequestDetails: "Request details", IP: "Request IP", Location: "Country / region",
		Safety: "Security reminder", Footer: "This is an automated email. Please do not reply.", Visit: "Visit Aivro",
		Unknown: "Unknown", VerifyStep: "Verify identity", PasswordStep: "Set a new password",
		TestLabel: "Test email", TestNote: "This is a test email. 123456 is a preview code, cannot verify an account and does not change any account information.",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] Verify your email", Title: "Verify your email", Eyebrow: "Welcome to Aivro",
				Body: "Welcome to {{siteName}}!\nEnter the code below on the registration page to verify your email and start creating.",
				Hint: "This code is only for this registration. Do not forward or share it.",
				Note: "If you did not request an account, you can ignore this email. Never share your code with anyone. The Aivro team will never ask for it.",
			},
			"reset": {
				Subject: "[{{siteName}}] Reset your password", Title: "Reset your password", Eyebrow: "Password reset",
				Body: "We received a request to reset your {{siteName}} password.\nEnter the code below on the password recovery page to verify your identity, then choose a new password.",
				Hint: "This code is only for this password reset. Never share it with anyone.",
				Note: "If you did not request a reset, ignore this email. Receiving it does not change your password. Do not share your code; the Aivro team will never ask for it.",
			},
			"metamask": {
				Subject: "[{{siteName}}] Verify your MetaMask sign-in email", Title: "Confirm your sign-in email", Eyebrow: "MetaMask email verification",
				Body: "You are signing in to {{siteName}} with MetaMask.\nCheck the recipient email address, then enter the code below on the sign-in page.",
				Hint: "This code only verifies the email for this MetaMask sign-in.",
				Note: "If you did not initiate this sign-in, do not enter or share the code. Aivro will never ask for your wallet recovery phrase, private key or a transfer by email.",
			},
		},
	},
	"ja-JP": {
		Category: "アカウントのセキュリティ", Code: "メール認証コード", Expiry: "{{expireMinutes}} 分間有効",
		Recipient: "宛先", RequestDetails: "リクエスト情報", IP: "リクエスト元 IP", Location: "国 / 地域",
		Safety: "セキュリティに関する注意", Footer: "このメールは自動送信されています。返信はご遠慮ください。", Visit: "Aivro にアクセス",
		Unknown: "不明", VerifyStep: "本人確認", PasswordStep: "新しいパスワードを設定",
		TestLabel: "テストメール", TestNote: "これはテストメールです。123456 はプレビュー用のコードで、アカウントの認証には使用できません。アカウント情報も変更されません。",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] メールアドレスの認証", Title: "メールを認証して登録を完了", Eyebrow: "Aivro へようこそ",
				Body: "{{siteName}} へようこそ！\n登録ページで以下のコードを入力し、メールアドレスの認証を完了して創作を始めましょう。",
				Hint: "このコードは今回の登録専用です。転送や共有はしないでください。",
				Note: "登録をリクエストしていない場合は、このメールを無視してください。認証コードは誰にも教えないでください。Aivro のスタッフがお尋ねすることもありません。",
			},
			"reset": {
				Subject: "[{{siteName}}] パスワードの再設定", Title: "パスワードを再設定", Eyebrow: "パスワードの再設定",
				Body: "{{siteName}} アカウントのパスワード再設定リクエストを受け付けました。\nパスワード再設定ページで以下のコードを入力し、本人確認後に新しいパスワードを設定してください。",
				Hint: "このコードは今回のパスワード再設定専用です。誰にも教えないでください。",
				Note: "再設定をリクエストしていない場合は、このメールを無視してください。受信しただけでパスワードが変わることはありません。Aivro のスタッフが認証コードを尋ねることはありません。",
			},
			"metamask": {
				Subject: "[{{siteName}}] MetaMask ログイン用メールの認証", Title: "ログイン用メールを確認", Eyebrow: "MetaMask メール認証",
				Body: "MetaMask で {{siteName}} にログインしようとしています。\n宛先のメールアドレスを確認し、ログインページで以下のコードを入力してください。",
				Hint: "このコードは今回の MetaMask ログイン用メールの認証専用です。",
				Note: "このログインに心当たりがない場合は、コードを入力・共有しないでください。Aivro がメールでウォレットのリカバリーフレーズ、秘密鍵、送金を求めることはありません。",
			},
		},
	},
	"ko-KR": {
		Category: "계정 보안", Code: "이메일 인증 코드", Expiry: "{{expireMinutes}}분 동안 유효",
		Recipient: "받는 이메일", RequestDetails: "요청 정보", IP: "요청 IP", Location: "국가 / 지역",
		Safety: "보안 안내", Footer: "이 메일은 자동으로 발송되었습니다. 회신하지 마세요.", Visit: "Aivro 방문",
		Unknown: "알 수 없음", VerifyStep: "본인 확인", PasswordStep: "새 비밀번호 설정",
		TestLabel: "테스트 메일", TestNote: "이 메일은 테스트 메일입니다. 123456은 미리보기용 코드로 계정 인증에 사용할 수 없으며 계정 정보도 변경되지 않습니다.",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] 이메일 인증을 완료하세요", Title: "이메일을 인증하고 가입 완료", Eyebrow: "Aivro에 오신 것을 환영합니다",
				Body: "{{siteName}}에 오신 것을 환영합니다!\n가입 페이지에 아래 코드를 입력하여 이메일 인증을 완료하고 창작을 시작하세요.",
				Hint: "이 코드는 이번 가입에만 사용됩니다. 전달하거나 공유하지 마세요.",
				Note: "가입을 요청하지 않았다면 이 메일을 무시하세요. 인증 코드를 누구에게도 알려주지 마세요. Aivro 직원도 인증 코드를 요청하지 않습니다.",
			},
			"reset": {
				Subject: "[{{siteName}}] 비밀번호 재설정", Title: "계정 비밀번호 재설정", Eyebrow: "비밀번호 재설정",
				Body: "{{siteName}} 계정의 비밀번호 재설정 요청을 받았습니다.\n비밀번호 찾기 페이지에 아래 코드를 입력하여 본인 확인을 마친 후 새 비밀번호를 설정하세요.",
				Hint: "이 코드는 이번 비밀번호 재설정에만 사용됩니다. 누구에게도 알려주지 마세요.",
				Note: "재설정을 요청하지 않았다면 이 메일을 무시하세요. 메일 수신만으로 비밀번호가 변경되지는 않습니다. 코드를 공유하지 마세요. Aivro 직원은 인증 코드를 요청하지 않습니다.",
			},
			"metamask": {
				Subject: "[{{siteName}}] MetaMask 로그인 이메일 인증", Title: "로그인 이메일 확인", Eyebrow: "MetaMask 이메일 인증",
				Body: "MetaMask로 {{siteName}}에 로그인하고 있습니다.\n받는 이메일 주소를 확인한 후 로그인 페이지에 아래 코드를 입력하세요.",
				Hint: "이 코드는 이번 MetaMask 로그인의 이메일 인증에만 사용됩니다.",
				Note: "직접 요청한 로그인이 아니라면 코드를 입력하거나 공유하지 마세요. Aivro는 이메일로 지갑 복구 문구, 개인 키 또는 송금을 요청하지 않습니다.",
			},
		},
	},
	"fr-FR": {
		Category: "Sécurité du compte", Code: "Code de vérification", Expiry: "Valable {{expireMinutes}} minutes",
		Recipient: "Adresse e-mail", RequestDetails: "Détails de la demande", IP: "IP de la demande", Location: "Pays / région",
		Safety: "Rappel de sécurité", Footer: "Cet e-mail est envoyé automatiquement. Merci de ne pas y répondre.", Visit: "Accéder à Aivro",
		Unknown: "Inconnu", VerifyStep: "Vérifier votre identité", PasswordStep: "Définir un nouveau mot de passe",
		TestLabel: "E-mail de test", TestNote: "Ceci est un e-mail de test. Le code 123456 sert uniquement à la prévisualisation. Il ne permet pas de vérifier un compte et ne modifie aucune information du compte.",
		Scenes: map[string]mailScene{
			"register": {
				Subject: "[{{siteName}}] Vérifiez votre adresse e-mail", Title: "Vérifiez votre adresse e-mail", Eyebrow: "Bienvenue sur Aivro",
				Body: "Bienvenue sur {{siteName}} !\nSaisissez le code ci-dessous sur la page d’inscription pour vérifier votre adresse e-mail et commencer à créer.",
				Hint: "Ce code est réservé à cette inscription. Ne le transférez pas et ne le partagez pas.",
				Note: "Si vous n’avez pas demandé de compte, ignorez cet e-mail. Ne communiquez jamais votre code à qui que ce soit. L’équipe Aivro ne vous le demandera jamais.",
			},
			"reset": {
				Subject: "[{{siteName}}] Réinitialisez votre mot de passe", Title: "Réinitialisez votre mot de passe", Eyebrow: "Réinitialisation du mot de passe",
				Body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte {{siteName}}.\nSaisissez le code ci-dessous sur la page de récupération pour vérifier votre identité, puis choisissez un nouveau mot de passe.",
				Hint: "Ce code est réservé à cette réinitialisation. Ne le communiquez à personne.",
				Note: "Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail. Sa réception ne modifie pas votre mot de passe. Ne partagez pas votre code : l’équipe Aivro ne vous le demandera jamais.",
			},
			"metamask": {
				Subject: "[{{siteName}}] Vérifiez votre e-mail de connexion MetaMask", Title: "Confirmez votre e-mail de connexion", Eyebrow: "Vérification e-mail MetaMask",
				Body: "Vous vous connectez à {{siteName}} avec MetaMask.\nVérifiez l’adresse e-mail destinataire, puis saisissez le code ci-dessous sur la page de connexion.",
				Hint: "Ce code vérifie uniquement l’e-mail de cette connexion MetaMask.",
				Note: "Si vous n’êtes pas à l’origine de cette connexion, ne saisissez pas le code et ne le partagez pas. Aivro ne vous demandera jamais par e-mail votre phrase de récupération, votre clé privée ou un transfert de fonds.",
			},
		},
	},
}
