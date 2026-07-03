package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func PublicSettings() (model.PublicSetting, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.PublicSetting{}, err
	}
	settings = normalizeSettings(settings)
	settings.Public.Auth.CustomProviders = publicCustomAuthProviders(settings.Private.Auth.CustomProviders)
	syncMetaMaskSignatureSetting(&settings)
	syncPublicCaptchaSetting(&settings)
	return settings.Public, nil
}

func AdsTxt() (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	return normalizePublicAdSenseSetting(settings.Public.AdSense).AdsTxt, nil
}

func AdminSettings() (model.Settings, error) {
	settings, err := repository.GetSettings()
	settings = normalizeSettings(settings)
	syncBuiltinAuthEnabled(&settings)
	return hidePrivateAPIKeys(settings), err
}

func SaveSettings(settings model.Settings) (model.Settings, error) {
	saved, err := repository.GetSettings()
	if err != nil {
		return model.Settings{}, err
	}
	settings = normalizeSettings(settings)
	syncBuiltinAuthEnabled(&settings)
	keepPrivateAPIKeys(&settings, normalizeSettings(saved))
	keepPrivateAuthSecrets(&settings, normalizeSettings(saved))
	keepCloudStorageSecrets(&settings, normalizeSettings(saved))
	keepBillingAndKYCSecrets(&settings, normalizeSettings(saved))
	result, err := repository.SaveSettings(settings, now())
	if err == nil {
		ClearPublicPromptCache()
		RefreshPromptSyncScheduler()
	}
	return hidePrivateAPIKeys(result), err
}

func syncBuiltinAuthEnabled(settings *model.Settings) {
	settings.Private.Auth.LinuxDo.Enabled = settings.Public.Auth.LinuxDo.Enabled
	settings.Private.Auth.Google.Enabled = settings.Public.Auth.Google.Enabled
	settings.Private.Auth.Github.Enabled = settings.Public.Auth.Github.Enabled
	settings.Private.Auth.MetaMask.Enabled = settings.Public.Auth.MetaMask.Enabled
	syncMetaMaskSignatureSetting(settings)
	settings.Public.Auth.CustomProviders = publicCustomAuthProviders(settings.Private.Auth.CustomProviders)
}

func syncMetaMaskSignatureSetting(settings *model.Settings) {
	settings.Private.Auth.MetaMask.SiteName = strings.TrimSpace(firstNonEmpty(settings.Private.Auth.MetaMask.SiteName, settings.Public.Auth.MetaMask.SiteName, settings.Public.Auth.MetaMask.Name, "Aivro"))
	settings.Private.Auth.MetaMask.SiteURL = strings.TrimSpace(firstNonEmpty(settings.Private.Auth.MetaMask.SiteURL, settings.Public.Auth.MetaMask.SiteURL))
	settings.Private.Auth.MetaMask.SignatureLogoURL = strings.TrimSpace(firstNonEmpty(settings.Private.Auth.MetaMask.SignatureLogoURL, settings.Public.Auth.MetaMask.SignatureLogoURL, settings.Public.Auth.MetaMask.IconURL))
	settings.Public.Auth.MetaMask.SiteName = settings.Private.Auth.MetaMask.SiteName
	settings.Public.Auth.MetaMask.SiteURL = settings.Private.Auth.MetaMask.SiteURL
	settings.Public.Auth.MetaMask.SignatureLogoURL = settings.Private.Auth.MetaMask.SignatureLogoURL
}

func syncPublicCaptchaSetting(settings *model.Settings) {
	captcha := normalizeCaptchaSetting(settings.Private.Captcha, settings.Private.Turnstile)
	settings.Private.Captcha = captcha
	settings.Public.Auth.TurnstileSiteKey = ""
	settings.Public.Auth.Captcha = model.PublicCaptchaSetting{Provider: captcha.Provider}
	if !captcha.Enabled {
		return
	}
	provider := captchaProviderSetting(captcha)
	if provider.SiteKey == "" || provider.SecretKey == "" {
		return
	}
	settings.Public.Auth.Captcha = model.PublicCaptchaSetting{Enabled: true, Provider: captcha.Provider, SiteKey: provider.SiteKey}
	if captcha.Provider == model.CaptchaProviderTurnstile {
		settings.Public.Auth.TurnstileSiteKey = provider.SiteKey
	}
}

func captchaProviderSetting(setting model.CaptchaSetting) model.CaptchaProviderKeySetting {
	if setting.Provider == model.CaptchaProviderHCaptcha {
		return setting.HCaptcha
	}
	return setting.Turnstile
}

func publicCustomAuthProviders(providers []model.PrivateOAuthProviderSetting) []model.PublicOAuthProviderSetting {
	result := make([]model.PublicOAuthProviderSetting, 0, len(providers))
	for _, provider := range providers {
		result = append(result, model.PublicOAuthProviderSetting{
			ID:      provider.ID,
			Name:    provider.Name,
			IconURL: provider.IconURL,
			Enabled: provider.Enabled,
		})
	}
	return result
}

func AdminChannelModels(index *int, channel model.ModelChannel) ([]string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return nil, err
	}
	return fetchAdminChannelModels(resolved)
}

func AdminTestChannelModel(index *int, channel model.ModelChannel, modelName string) (string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return "", err
	}
	resolved = normalizeModelChannel(resolved)
	modelName = strings.TrimSpace(modelName)
	for _, item := range resolved.ModelMappings {
		if item.Name == modelName || item.UpstreamName == modelName {
			modelName = item.UpstreamName
			break
		}
	}
	if modelName == "" && len(resolved.ModelMappings) > 0 {
		modelName = resolved.ModelMappings[0].UpstreamName
	}
	return testAdminChannelModel(resolved, modelName)
}

func AdminTestMail(setting model.MailSetting, email string, context MailTemplateContext) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return safeMessageError{message: "请填写测试收件邮箱"}
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	setting = normalizeMailSetting(setting)
	if strings.TrimSpace(setting.Password) == "" {
		setting.Password = normalizeMailSetting(settings.Private.Mail).Password
	}
	if err := sendVerificationMail(setting, email, "register", "123456", context); err != nil {
		var deliveryErr mailDeliveryError
		if errors.As(err, &deliveryErr) {
			return safeMessageError{message: "邮件发送失败：" + deliveryErr.DetailMessage()}
		}
		return err
	}
	return nil
}

func AdminUpdateDatabase() error {
	return repository.UpdateDatabase()
}

func EnsureDatabaseUpdated() error {
	return repository.UpdateDatabase()
}

func AdminDatabaseStatus() (model.DatabaseStatus, error) {
	return repository.DatabaseStatus()
}

func normalizeSettings(settings model.Settings) model.Settings {
	settings.Private = normalizePrivateSetting(settings.Private)
	settings.Public = normalizePublicSettingWithChannels(settings.Public, settings.Private.Channels)
	return settings
}

func normalizePublicSetting(setting model.PublicSetting) model.PublicSetting {
	return normalizePublicSettingWithChannels(setting, nil)
}

func normalizePublicSettingWithChannels(setting model.PublicSetting, channels []model.ModelChannel) model.PublicSetting {
	if setting.ModelChannel.AvailableModels == nil {
		setting.ModelChannel.AvailableModels = []string{}
	}
	setting.ModelChannel.AvailableModels = filterModels(setting.ModelChannel.AvailableModels, collectChannelModelNames(channels))
	setting.ModelChannel.ImageModels = normalizeScopedModels(setting.ModelChannel.ImageModels, setting.ModelChannel.AvailableModels, collectChannelModelNamesByCapability(channels, "image"))
	setting.ModelChannel.VideoModels = normalizeScopedModels(setting.ModelChannel.VideoModels, setting.ModelChannel.AvailableModels, collectChannelModelNamesByCapability(channels, "video"))
	setting.ModelChannel.TextModels = normalizeScopedModels(setting.ModelChannel.TextModels, setting.ModelChannel.AvailableModels, collectChannelModelNamesByCapability(channels, "text"))
	setting.ModelChannel.Model3DModels = normalizeScopedModels(setting.ModelChannel.Model3DModels, setting.ModelChannel.AvailableModels, collectChannelModelNamesByCapability(channels, "model3d"))
	if setting.ModelChannel.ModelCosts == nil {
		setting.ModelChannel.ModelCosts = []model.ModelCost{}
	}
	setting.ModelChannel.ModelCosts = normalizeModelCosts(setting.ModelChannel.ModelCosts, setting.ModelChannel.AvailableModels, channels)
	setting.ModelChannel.DefaultImageModel = defaultScopedModel(setting.ModelChannel.ImageModels, setting.ModelChannel.DefaultImageModel)
	setting.ModelChannel.DefaultVideoModel = defaultScopedModel(setting.ModelChannel.VideoModels, setting.ModelChannel.DefaultVideoModel)
	setting.ModelChannel.DefaultTextModel = defaultScopedModel(setting.ModelChannel.TextModels, setting.ModelChannel.DefaultTextModel)
	setting.ModelChannel.DefaultModel3D = defaultScopedModel(setting.ModelChannel.Model3DModels, setting.ModelChannel.DefaultModel3D)
	setting.ModelChannel.DefaultModel = firstNonEmpty(setting.ModelChannel.DefaultTextModel, setting.ModelChannel.DefaultImageModel, setting.ModelChannel.DefaultVideoModel, setting.ModelChannel.DefaultModel3D)
	if setting.Auth.AllowRegister == nil {
		enabled := true
		setting.Auth.AllowRegister = &enabled
	}
	if setting.Auth.EmailVerification == nil {
		enabled := false
		setting.Auth.EmailVerification = &enabled
	}
	setting.Auth.TurnstileSiteKey = ""
	setting.Auth.Captcha = model.PublicCaptchaSetting{Provider: model.CaptchaProviderTurnstile}
	setting.Auth.LinuxDo = normalizePublicAuthProvider(setting.Auth.LinuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg")
	setting.Auth.Google = normalizePublicAuthProvider(setting.Auth.Google, "google", "Google", "/icons/google.svg")
	setting.Auth.Github = normalizePublicAuthProvider(setting.Auth.Github, "github", "GitHub", "/icons/github.svg")
	setting.Auth.MetaMask = normalizePublicAuthProvider(setting.Auth.MetaMask, "metamask", "MetaMask", "/icons/metamask.svg")
	if setting.Auth.MetaMask.SiteName == "" {
		setting.Auth.MetaMask.SiteName = firstNonEmpty(setting.Auth.MetaMask.Name, "Aivro")
	}
	if setting.Auth.MetaMask.SignatureLogoURL == "" {
		setting.Auth.MetaMask.SignatureLogoURL = setting.Auth.MetaMask.IconURL
	}
	if setting.Auth.CustomProviders == nil {
		setting.Auth.CustomProviders = []model.PublicOAuthProviderSetting{{ID: "o2", Name: "O2", Enabled: false}}
	}
	for i := range setting.Auth.CustomProviders {
		setting.Auth.CustomProviders[i] = normalizePublicAuthProvider(setting.Auth.CustomProviders[i], setting.Auth.CustomProviders[i].ID, setting.Auth.CustomProviders[i].Name, setting.Auth.CustomProviders[i].IconURL)
	}
	setting.Pages = normalizePublicPagesSetting(setting.Pages)
	setting.PageAccess = normalizePublicPageAccessSetting(setting.PageAccess)
	setting.AdSense = normalizePublicAdSenseSetting(setting.AdSense)
	return setting
}

func normalizePublicPageAccessSetting(setting model.PublicPageAccessSetting) model.PublicPageAccessSetting {
	return setting
}

func normalizePublicAdSenseSetting(setting model.PublicAdSenseSetting) model.PublicAdSenseSetting {
	setting.Code = strings.TrimSpace(setting.Code)
	setting.AdsTxt = strings.TrimSpace(setting.AdsTxt)
	return setting
}

func normalizePublicPagesSetting(setting model.PublicPagesSetting) model.PublicPagesSetting {
	if strings.TrimSpace(setting.PrivacyTitle) == "" {
		setting.PrivacyTitle = "隐私政策"
	}
	if strings.TrimSpace(setting.PrivacyTitleEn) == "" {
		setting.PrivacyTitleEn = "Privacy Policy"
	}
	if strings.TrimSpace(setting.TermsTitle) == "" {
		setting.TermsTitle = "服务条款"
	}
	if strings.TrimSpace(setting.TermsTitleEn) == "" {
		setting.TermsTitleEn = "Terms of Service"
	}
	if strings.TrimSpace(setting.PrivacyContent) == "" {
		setting.PrivacyContent = defaultPrivacyPolicyContent()
	}
	if strings.TrimSpace(setting.PrivacyContentEn) == "" {
		setting.PrivacyContentEn = defaultPrivacyPolicyContentEn()
	}
	if strings.TrimSpace(setting.TermsContent) == "" {
		setting.TermsContent = defaultTermsContent()
	}
	if strings.TrimSpace(setting.TermsContentEn) == "" {
		setting.TermsContentEn = defaultTermsContentEn()
	}
	setting.PrivacyContent = normalizeBrandName(setting.PrivacyContent)
	setting.TermsContent = normalizeBrandName(setting.TermsContent)
	return setting
}

func normalizeBrandName(value string) string {
	return strings.NewReplacer("Aivro（边缘幻星）", "Aivro", "Aivro / 边缘幻星", "Aivro", "边缘幻星", "Aivro").Replace(value)
}

func defaultPrivacyPolicyContent() string {
	return strings.TrimSpace(`欢迎使用 Aivro。我们重视你的隐私，并尽量只处理提供服务所必需的信息。

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
我们可能根据功能变化更新本政策。更新后的内容会展示在本页面，继续使用 Aivro 表示你理解并同意更新后的政策。`)
}

func defaultTermsContent() string {
	return strings.TrimSpace(`欢迎使用 Aivro。使用、登录或注册 Aivro，即表示你同意遵守本服务条款。

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
我们可能根据功能和合规要求更新本条款。更新后的内容会展示在本页面，继续使用或登录 Aivro 表示你接受更新后的条款。`)
}

func defaultPrivacyPolicyContentEn() string {
	return strings.TrimSpace(`Welcome to Aivro. We respect your privacy and only process information needed to provide the service.

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
We may update this policy as features change. Updated content will be shown on this page. Continuing to use Aivro means you understand and agree to the updated policy.`)
}

func defaultTermsContentEn() string {
	return strings.TrimSpace(`Welcome to Aivro. By using, signing in to, or registering for Aivro, you agree to these Terms of Service.

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
We may update these terms for feature and compliance reasons. Updated content will be shown on this page. Continuing to use or sign in to Aivro means you accept the updated terms.`)
}

func ModelCost(modelName string) (int, error) {
	billing, err := ModelBilling(modelName)
	if err != nil {
		return 0, err
	}
	return billing.Credits, nil
}

func ModelBilling(modelName string) (model.ModelCost, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.ModelCost{}, err
	}
	settings = normalizeSettings(settings)
	modelName = strings.TrimSpace(modelName)
	modelID := modelIDForName(settings.Private.Channels, modelName)
	for _, item := range settings.Public.ModelChannel.ModelCosts {
		if modelID != "" && item.ModelID == modelID {
			item.Model = modelName
			return item, nil
		}
		if modelID == "" && item.Model == modelName {
			return item, nil
		}
	}
	return model.ModelCost{ModelID: modelID, Model: modelName, BillingType: "fixed"}, nil
}

func normalizePrivateSetting(setting model.PrivateSetting) model.PrivateSetting {
	if setting.Channels == nil {
		setting.Channels = []model.ModelChannel{}
	}
	setting.Runtime = normalizeRuntimeSetting(setting.Runtime)
	setting.PromptSync = normalizePromptSyncSetting(setting.PromptSync)
	setting.AIQueue = normalizeAIQueueSetting(setting.AIQueue)
	setting.CanvasAssist = normalizeCanvasAssistSetting(setting.CanvasAssist)
	setting.Turnstile = normalizeTurnstileSetting(setting.Turnstile)
	setting.Captcha = normalizeCaptchaSetting(setting.Captcha, setting.Turnstile)
	setting.Auth = normalizePrivateAuthSetting(setting.Auth)
	setting.Mail = normalizeMailSetting(setting.Mail)
	setting.CloudStorage = normalizeCloudStorageSetting(setting.CloudStorage)
	setting.Stripe = normalizeStripeSetting(setting.Stripe)
	setting.KYC = normalizeKYCSetting(setting.KYC)
	setting.Channels, setting.ModelIDSeq = normalizeModelChannelsWithSeq(setting.Channels, setting.ModelIDSeq)
	return setting
}

func normalizeRuntimeSetting(setting model.RuntimeSetting) model.RuntimeSetting {
	setting.AppOrigin = strings.TrimRight(strings.TrimSpace(setting.AppOrigin), "/")
	setting.AllowedOrigins = strings.TrimSpace(setting.AllowedOrigins)
	if setting.JWTExpireHours <= 0 {
		setting.JWTExpireHours = config.Cfg.JWTExpireHours
	}
	if setting.JWTExpireHours <= 0 {
		setting.JWTExpireHours = 168
	}
	return setting
}

func RuntimeSetting() model.RuntimeSetting {
	settings, err := repository.GetSettings()
	if err != nil {
		return normalizeRuntimeSetting(model.RuntimeSetting{})
	}
	return normalizeRuntimeSetting(settings.Private.Runtime)
}

func normalizeCanvasAssistSetting(setting model.CanvasAssistSetting) model.CanvasAssistSetting {
	if setting.HistoryRetentionDays <= 0 {
		setting.HistoryRetentionDays = 7
	}
	return setting
}

func normalizeAIQueueSetting(setting model.AIQueueSetting) model.AIQueueSetting {
	if setting.Enabled == nil {
		enabled := true
		setting.Enabled = &enabled
	}
	setting.Backend = strings.TrimSpace(setting.Backend)
	if setting.Backend == "" {
		setting.Backend = "database"
	}
	if setting.Backend != "database" {
		setting.Backend = "database"
	}
	setting.RedisURL = strings.TrimSpace(setting.RedisURL)
	if setting.DefaultPerMinute <= 0 {
		setting.DefaultPerMinute = 50
	}
	if setting.MaxQueuedPerUser <= 0 {
		setting.MaxQueuedPerUser = 20
	}
	if setting.TaskRetentionHours <= 0 {
		setting.TaskRetentionHours = 24
	}
	if setting.ModelPerMinute == nil {
		setting.ModelPerMinute = []model.ModelRateLimit{}
	}
	for i := range setting.ModelPerMinute {
		setting.ModelPerMinute[i].Model = strings.TrimSpace(setting.ModelPerMinute[i].Model)
		if setting.ModelPerMinute[i].PerMinute <= 0 {
			setting.ModelPerMinute[i].PerMinute = setting.DefaultPerMinute
		}
	}
	return setting
}

func normalizeTurnstileSetting(setting model.TurnstileSetting) model.TurnstileSetting {
	setting.SiteKey = strings.TrimSpace(setting.SiteKey)
	setting.SecretKey = strings.TrimSpace(setting.SecretKey)
	return setting
}

func normalizeCaptchaSetting(setting model.CaptchaSetting, legacyTurnstile model.TurnstileSetting) model.CaptchaSetting {
	hasCaptchaSetting := setting.Provider != "" || setting.Enabled || setting.Turnstile.SiteKey != "" || setting.Turnstile.SecretKey != "" || setting.HCaptcha.SiteKey != "" || setting.HCaptcha.SecretKey != ""
	setting.Turnstile.SiteKey = strings.TrimSpace(firstNonEmpty(setting.Turnstile.SiteKey, legacyTurnstile.SiteKey))
	setting.Turnstile.SecretKey = strings.TrimSpace(firstNonEmpty(setting.Turnstile.SecretKey, legacyTurnstile.SecretKey))
	setting.HCaptcha.SiteKey = strings.TrimSpace(setting.HCaptcha.SiteKey)
	setting.HCaptcha.SecretKey = strings.TrimSpace(setting.HCaptcha.SecretKey)
	if setting.Provider != model.CaptchaProviderHCaptcha {
		setting.Provider = model.CaptchaProviderTurnstile
	}
	if !hasCaptchaSetting && !setting.Enabled && legacyTurnstile.Enabled && setting.Turnstile.SiteKey != "" && setting.Turnstile.SecretKey != "" {
		setting.Enabled = true
		setting.Provider = model.CaptchaProviderTurnstile
	}
	return setting
}

func normalizeStripeSetting(setting model.StripeSetting) model.StripeSetting {
	return setting
}

func normalizeKYCSetting(setting model.KYCSetting) model.KYCSetting {
	if setting.Provider == "" {
		setting.Provider = "didit"
	}
	if !setting.RewardOnce {
		setting.RewardOnce = true
	}
	if setting.RewardCredits < 0 {
		setting.RewardCredits = 0
	}
	if setting.RewardWorkflowCreateCredits < 0 {
		setting.RewardWorkflowCreateCredits = 0
	}
	return setting
}

func hidePrivateAPIKeys(settings model.Settings) model.Settings {
	for i := range settings.Private.Channels {
		settings.Private.Channels[i].APIKey = ""
	}
	settings.Private.Auth.LinuxDo.ClientSecret = ""
	settings.Private.Auth.Google.ClientSecret = ""
	settings.Private.Auth.Github.ClientSecret = ""
	for i := range settings.Private.Auth.CustomProviders {
		settings.Private.Auth.CustomProviders[i].ClientSecret = ""
	}
	settings.Private.Mail.Password = ""
	settings.Private.Turnstile.SecretKey = ""
	settings.Private.Captcha.Turnstile.SecretKey = ""
	settings.Private.Captcha.HCaptcha.SecretKey = ""
	settings.Private.CloudStorage.SecretAccessKey = ""
	settings.Private.Stripe.SecretKey = ""
	settings.Private.Stripe.WebhookSecret = ""
	settings.Private.KYC.DiditAPIKey = ""
	settings.Private.KYC.DiditWebhookSecret = ""
	return settings
}

func keepPrivateAPIKeys(settings *model.Settings, saved model.Settings) {
	for i := range settings.Private.Channels {
		if strings.TrimSpace(settings.Private.Channels[i].APIKey) != "" {
			continue
		}
		if channel, ok := findSavedChannel(settings.Private.Channels[i], saved.Private.Channels, i); ok {
			settings.Private.Channels[i].APIKey = channel.APIKey
		}
	}
}

func keepPrivateAuthSecrets(settings *model.Settings, saved model.Settings) {
	if strings.TrimSpace(settings.Private.Auth.LinuxDo.ClientSecret) == "" {
		settings.Private.Auth.LinuxDo.ClientSecret = saved.Private.Auth.LinuxDo.ClientSecret
	}
	if strings.TrimSpace(settings.Private.Auth.Google.ClientSecret) == "" {
		settings.Private.Auth.Google.ClientSecret = saved.Private.Auth.Google.ClientSecret
	}
	if strings.TrimSpace(settings.Private.Auth.Github.ClientSecret) == "" {
		settings.Private.Auth.Github.ClientSecret = saved.Private.Auth.Github.ClientSecret
	}
	for i := range settings.Private.Auth.CustomProviders {
		if strings.TrimSpace(settings.Private.Auth.CustomProviders[i].ClientSecret) != "" {
			continue
		}
		if provider, ok := findSavedAuthProvider(settings.Private.Auth.CustomProviders[i], saved.Private.Auth.CustomProviders, i); ok {
			settings.Private.Auth.CustomProviders[i].ClientSecret = provider.ClientSecret
		}
	}
	if strings.TrimSpace(settings.Private.Mail.Password) == "" {
		settings.Private.Mail.Password = saved.Private.Mail.Password
	}
	if strings.TrimSpace(settings.Private.Turnstile.SecretKey) == "" {
		settings.Private.Turnstile.SecretKey = saved.Private.Turnstile.SecretKey
	}
	if strings.TrimSpace(settings.Private.Captcha.Turnstile.SecretKey) == "" {
		settings.Private.Captcha.Turnstile.SecretKey = saved.Private.Captcha.Turnstile.SecretKey
	}
	if strings.TrimSpace(settings.Private.Captcha.HCaptcha.SecretKey) == "" {
		settings.Private.Captcha.HCaptcha.SecretKey = saved.Private.Captcha.HCaptcha.SecretKey
	}
}

func keepCloudStorageSecrets(settings *model.Settings, saved model.Settings) {
	if strings.TrimSpace(settings.Private.CloudStorage.SecretAccessKey) == "" {
		settings.Private.CloudStorage.SecretAccessKey = saved.Private.CloudStorage.SecretAccessKey
	}
}

func keepBillingAndKYCSecrets(settings *model.Settings, saved model.Settings) {
	if strings.TrimSpace(settings.Private.Stripe.SecretKey) == "" {
		settings.Private.Stripe.SecretKey = saved.Private.Stripe.SecretKey
	}
	if strings.TrimSpace(settings.Private.Stripe.WebhookSecret) == "" {
		settings.Private.Stripe.WebhookSecret = saved.Private.Stripe.WebhookSecret
	}
	if strings.TrimSpace(settings.Private.KYC.DiditAPIKey) == "" {
		settings.Private.KYC.DiditAPIKey = saved.Private.KYC.DiditAPIKey
	}
	if strings.TrimSpace(settings.Private.KYC.DiditWebhookSecret) == "" {
		settings.Private.KYC.DiditWebhookSecret = saved.Private.KYC.DiditWebhookSecret
	}
}

func normalizePublicAuthProvider(provider model.PublicOAuthProviderSetting, id string, name string, iconURL string) model.PublicOAuthProviderSetting {
	if provider.ID == "" {
		provider.ID = id
	}
	if provider.Name == "" {
		provider.Name = name
	}
	if provider.IconURL == "" {
		provider.IconURL = iconURL
	}
	return provider
}

func normalizePrivateAuthSetting(setting model.PrivateAuthSetting) model.PrivateAuthSetting {
	setting.LinuxDo = normalizePrivateAuthProvider(setting.LinuxDo, "linux-do", "Linux.do", config.Cfg.LinuxDoAuthorizeURL, config.Cfg.LinuxDoTokenURL, config.Cfg.LinuxDoUserInfoURL, "read")
	setting.Google = normalizePrivateAuthProvider(setting.Google, "google", "Google", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v3/userinfo", "openid email profile")
	setting.Github = normalizePrivateAuthProvider(setting.Github, "github", "GitHub", "https://github.com/login/oauth/authorize", "https://github.com/login/oauth/access_token", "https://api.github.com/user", "read:user user:email")
	if setting.MetaMask.SiteName == "" {
		setting.MetaMask.SiteName = "Aivro"
	}
	if setting.MetaMask.SignatureLogoURL == "" {
		setting.MetaMask.SignatureLogoURL = "/icons/metamask.svg"
	}
	if setting.CustomProviders == nil {
		setting.CustomProviders = []model.PrivateOAuthProviderSetting{normalizePrivateAuthProvider(model.PrivateOAuthProviderSetting{}, "o2", "O2", "", "", "", "openid email profile")}
	}
	for i := range setting.CustomProviders {
		setting.CustomProviders[i] = normalizePrivateAuthProvider(setting.CustomProviders[i], setting.CustomProviders[i].ID, setting.CustomProviders[i].Name, setting.CustomProviders[i].AuthorizeURL, setting.CustomProviders[i].TokenURL, setting.CustomProviders[i].UserInfoURL, setting.CustomProviders[i].Scope)
	}
	return setting
}

func normalizePrivateAuthProvider(provider model.PrivateOAuthProviderSetting, id string, name string, authorizeURL string, tokenURL string, userInfoURL string, scope string) model.PrivateOAuthProviderSetting {
	if provider.ID == "" {
		provider.ID = id
	}
	if provider.Name == "" {
		provider.Name = name
	}
	if provider.AuthorizeURL == "" {
		provider.AuthorizeURL = authorizeURL
	}
	if provider.TokenURL == "" {
		provider.TokenURL = tokenURL
	}
	if provider.UserInfoURL == "" {
		provider.UserInfoURL = userInfoURL
	}
	if provider.Scope == "" {
		provider.Scope = scope
	}
	return provider
}

func normalizeMailSetting(setting model.MailSetting) model.MailSetting {
	setting.Host = strings.TrimSpace(setting.Host)
	setting.Username = strings.TrimSpace(setting.Username)
	setting.Password = strings.TrimSpace(setting.Password)
	setting.FromEmail = strings.TrimSpace(setting.FromEmail)
	setting.FromName = strings.TrimSpace(setting.FromName)
	if setting.Port <= 0 {
		setting.Port = 587
	}
	if setting.CodeExpireMin <= 0 {
		setting.CodeExpireMin = 10
	}
	if setting.Templates.Register.Subject == "" {
		setting.Templates.Register.Subject = "注册验证码：{{code}}"
	}
	if setting.Templates.Register.Body == "" {
		setting.Templates.Register.Body = "你的注册验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}"
	}
	if setting.Templates.Reset.Subject == "" {
		setting.Templates.Reset.Subject = "找回密码验证码：{{code}}"
	}
	if setting.Templates.Reset.Body == "" {
		setting.Templates.Reset.Body = "你的找回密码验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}"
	}
	if setting.Templates.MetaMask.Subject == "" {
		setting.Templates.MetaMask.Subject = "MetaMask 登录邮箱验证码：{{code}}"
	}
	if setting.Templates.MetaMask.Body == "" {
		setting.Templates.MetaMask.Body = "你的 MetaMask 登录邮箱验证码是 {{code}}，{{expireMinutes}} 分钟内有效。\n请求 IP：{{ip}}\n国家/地区：{{country}} {{region}}"
	}
	return setting
}

func findSavedAuthProvider(provider model.PrivateOAuthProviderSetting, saved []model.PrivateOAuthProviderSetting, index int) (model.PrivateOAuthProviderSetting, bool) {
	for _, item := range saved {
		if item.ID == provider.ID && provider.ID != "" {
			return item, true
		}
	}
	if index < len(saved) {
		return saved[index], true
	}
	return model.PrivateOAuthProviderSetting{}, false
}

func findSavedChannel(channel model.ModelChannel, saved []model.ModelChannel, index int) (model.ModelChannel, bool) {
	for _, item := range saved {
		if item.Name == channel.Name && item.BaseURL == channel.BaseURL {
			return item, true
		}
	}
	if index < len(saved) {
		return saved[index], true
	}
	return model.ModelChannel{}, false
}

type ModelChannelRoute struct {
	Channel       model.ModelChannel
	PublicModel   string
	UpstreamModel string
	Capability    string
}

func SelectModelChannel(modelName string) (model.ModelChannel, error) {
	route, err := SelectModelChannelRoute(modelName)
	return route.Channel, err
}

func SelectModelChannelRoute(modelName string) (ModelChannelRoute, error) {
	routes, err := SelectModelChannelRoutes(modelName)
	if err != nil {
		return ModelChannelRoute{}, err
	}
	return routes[0], nil
}

func SelectModelChannelRoutes(modelName string) ([]ModelChannelRoute, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return nil, err
	}
	routes := modelChannelRoutesForModel(normalizePrivateSetting(settings.Private).Channels, modelName)
	if len(routes) == 0 {
		return nil, errors.New("没有可用模型渠道")
	}
	sort.SliceStable(routes, func(i int, j int) bool {
		if routes[i].Channel.Weight == routes[j].Channel.Weight {
			return routes[i].Channel.Name < routes[j].Channel.Name
		}
		return routes[i].Channel.Weight > routes[j].Channel.Weight
	})
	return routes, nil
}

func ModelChannelRouteAttempts(routes []ModelChannelRoute) []ModelChannelRoute {
	if len(routes) == 0 {
		return nil
	}
	result := append([]ModelChannelRoute{}, routes...)
	result = append(result, routes[len(routes)-1])
	return result
}

func BuildModelChannelURL(channel model.ModelChannel, path string) string {
	baseURL := strings.TrimRight(channel.BaseURL, "/")
	if !strings.HasSuffix(baseURL, "/v1") {
		baseURL += "/v1"
	}
	return baseURL + path
}

func normalizeModelChannel(channel model.ModelChannel) model.ModelChannel {
	channels := normalizeModelChannels([]model.ModelChannel{channel})
	if len(channels) == 0 {
		return model.ModelChannel{}
	}
	return channels[0]
}

func normalizeModelChannels(channels []model.ModelChannel) []model.ModelChannel {
	result, _ := normalizeModelChannelsWithSeq(channels, 0)
	return result
}

func normalizeModelChannelsWithSeq(channels []model.ModelChannel, currentSeq int) ([]model.ModelChannel, int) {
	usedIDs := map[string]bool{}
	maxID := currentSeq
	for _, channel := range channels {
		for _, item := range channel.ModelMappings {
			if id := strings.TrimSpace(item.ID); id != "" {
				if seq := modelIDSeq(id); seq > maxID {
					maxID = seq
				}
			}
		}
	}
	result := make([]model.ModelChannel, 0, len(channels))
	for index := range channels {
		channel := normalizeModelChannelWithIDs(channels[index], index, usedIDs, &maxID)
		result = append(result, channel)
	}
	return result, maxID
}

func normalizeModelChannelWithIDs(channel model.ModelChannel, index int, usedIDs map[string]bool, maxID *int) model.ModelChannel {
	if channel.Protocol == "" {
		channel.Protocol = "openai"
	}
	channel.Name = strings.TrimSpace(channel.Name)
	channel.Color = normalizeChannelColor(channel.Color, index)
	channel.BaseURL = strings.TrimSpace(channel.BaseURL)
	if channel.Models == nil {
		channel.Models = []string{}
	}
	if len(channel.ModelMappings) == 0 {
		for _, item := range channel.Models {
			item = strings.TrimSpace(item)
			if item != "" {
				channel.ModelMappings = append(channel.ModelMappings, model.ModelChannelModel{Name: item, UpstreamName: item})
			}
		}
	}
	channel.ModelMappings = normalizeModelMappingsWithIDs(channel.ModelMappings, usedIDs, maxID)
	channel.Models = make([]string, 0, len(channel.ModelMappings))
	for _, item := range channel.ModelMappings {
		channel.Models = append(channel.Models, item.Name)
	}
	if channel.Weight <= 0 {
		channel.Weight = 1
	}
	return channel
}

func normalizeModelMappings(items []model.ModelChannelModel) []model.ModelChannelModel {
	return normalizeModelMappingsWithIDs(items, nil, nil)
}

func normalizeModelMappingsWithIDs(items []model.ModelChannelModel, usedIDs map[string]bool, maxID *int) []model.ModelChannelModel {
	result := make([]model.ModelChannelModel, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		item.ID = strings.TrimSpace(item.ID)
		item.Name = strings.TrimSpace(item.Name)
		item.UpstreamName = strings.TrimSpace(item.UpstreamName)
		item.Capability = strings.TrimSpace(item.Capability)
		if item.Name == "" {
			continue
		}
		if item.UpstreamName == "" {
			item.UpstreamName = item.Name
		}
		switch item.Capability {
		case "text", "video", "model3d":
		default:
			item.Capability = "image"
		}
		if seen[item.Name] {
			continue
		}
		if usedIDs != nil && maxID != nil {
			if item.ID == "" || usedIDs[item.ID] {
				*maxID = *maxID + 1
				item.ID = fmt.Sprintf("model_%d", *maxID)
			}
			usedIDs[item.ID] = true
		}
		seen[item.Name] = true
		result = append(result, item)
	}
	return result
}

func modelIDSeq(id string) int {
	var seq int
	_, _ = fmt.Sscanf(id, "model_%d", &seq)
	return seq
}

func collectChannelModelNames(channels []model.ModelChannel) []string {
	names := []string{}
	for _, channel := range channels {
		if !channel.Enabled {
			continue
		}
		for _, item := range channel.ModelMappings {
			names = append(names, item.Name)
		}
	}
	if len(names) == 0 {
		return nil
	}
	return uniqueNonEmptyStrings(names)
}

func collectChannelModelNamesByCapability(channels []model.ModelChannel, capability string) []string {
	names := []string{}
	for _, channel := range channels {
		if !channel.Enabled {
			continue
		}
		for _, item := range channel.ModelMappings {
			if item.Capability == capability {
				names = append(names, item.Name)
			}
		}
	}
	if len(names) == 0 {
		return nil
	}
	return uniqueNonEmptyStrings(names)
}

func filterModels(models []string, options []string) []string {
	if len(options) == 0 {
		return uniqueNonEmptyStrings(models)
	}
	optionSet := map[string]bool{}
	for _, item := range options {
		optionSet[item] = true
	}
	result := []string{}
	for _, item := range uniqueNonEmptyStrings(models) {
		if optionSet[item] {
			result = append(result, item)
		}
	}
	return result
}

func normalizeScopedModels(models []string, availableModels []string, capabilityModels []string) []string {
	result := filterModels(models, availableModels)
	if len(result) > 0 {
		return result
	}
	result = filterModels(capabilityModels, availableModels)
	if len(result) > 0 {
		return result
	}
	return availableModels
}

func defaultScopedModel(models []string, current string) string {
	current = strings.TrimSpace(current)
	for _, item := range models {
		if item == current {
			return current
		}
	}
	if len(models) > 0 {
		return models[0]
	}
	return ""
}

func normalizeModelCosts(items []model.ModelCost, availableModels []string, channels []model.ModelChannel) []model.ModelCost {
	byID := map[string]model.ModelCost{}
	byName := map[string]model.ModelCost{}
	for _, item := range items {
		item.ModelID = strings.TrimSpace(item.ModelID)
		item.Model = strings.TrimSpace(item.Model)
		if item.Credits < 0 {
			item.Credits = 0
		}
		if item.BillingType != "token" {
			item.BillingType = "fixed"
		}
		if item.ModelID != "" {
			byID[item.ModelID] = item
		}
		if item.Model != "" {
			byName[item.Model] = item
		}
	}
	result := make([]model.ModelCost, 0, len(availableModels))
	seenIDs := map[string]bool{}
	for _, modelName := range availableModels {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}
		modelID := modelIDForName(channels, modelName)
		item := byID[modelID]
		if item.ModelID == "" {
			item = byName[modelName]
		}
		item.ModelID = modelID
		item.Model = modelName
		if item.BillingType != "token" {
			item.BillingType = "fixed"
		}
		if item.Credits < 0 {
			item.Credits = 0
		}
		key := firstNonEmpty(modelID, modelName)
		if key == "" || seenIDs[key] {
			continue
		}
		seenIDs[key] = true
		result = append(result, item)
	}
	return result
}

func modelIDForName(channels []model.ModelChannel, modelName string) string {
	modelName = strings.TrimSpace(modelName)
	for _, channel := range channels {
		if !channel.Enabled {
			continue
		}
		for _, item := range channel.ModelMappings {
			if item.Name == modelName {
				return item.ID
			}
		}
	}
	return ""
}

func normalizeChannelColor(value string, index int) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "#") && (len(value) == 4 || len(value) == 7) {
		return value
	}
	palette := []string{"#2563eb", "#16a34a", "#f97316", "#9333ea", "#0891b2", "#dc2626", "#4f46e5", "#ca8a04"}
	if index < 0 {
		index = 0
	}
	return palette[index%len(palette)]
}

func uniqueNonEmptyStrings(items []string) []string {
	result := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
	}
	return result
}

func resolveAdminChannel(index *int, channel model.ModelChannel) (model.ModelChannel, error) {
	resolved := normalizeModelChannel(channel)
	if strings.TrimSpace(resolved.APIKey) == "" {
		settings, err := repository.GetSettings()
		if err != nil {
			return model.ModelChannel{}, err
		}
		saved := normalizePrivateSetting(settings.Private).Channels
		if index != nil && *index >= 0 && *index < len(saved) {
			if resolved.APIKey == "" {
				resolved.APIKey = saved[*index].APIKey
			}
			if resolved.BaseURL == "" {
				resolved.BaseURL = saved[*index].BaseURL
			}
			if resolved.Name == "" {
				resolved.Name = saved[*index].Name
			}
		}
		if resolved.APIKey == "" {
			if savedChannel, ok := findSavedChannel(resolved, saved, -1); ok {
				resolved.APIKey = savedChannel.APIKey
			}
		}
	}
	if strings.TrimSpace(resolved.BaseURL) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少接口地址"}
	}
	if strings.TrimSpace(resolved.APIKey) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少 API Key"}
	}
	return resolved, nil
}

func fetchAdminChannelModels(channel model.ModelChannel) ([]string, error) {
	request, err := http.NewRequest(http.MethodGet, BuildModelChannelURL(channel, "/models"), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return nil, readAdminChannelError(body, response.StatusCode, "读取模型失败")
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &payload)
	result := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		if strings.TrimSpace(item.ID) != "" {
			result = append(result, item.ID)
		}
	}
	sort.Strings(result)
	return result, nil
}

func testAdminChannelModel(channel model.ModelChannel, modelName string) (string, error) {
	if strings.TrimSpace(modelName) == "" {
		return "", errors.New("缺少模型名称")
	}
	body, _ := json.Marshal(map[string]any{
		"model": modelName,
		"messages": []map[string]string{{
			"role":    "user",
			"content": "hi",
		}},
	})
	request, err := http.NewRequest(http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return "", readAdminChannelError(responseBody, response.StatusCode, "测试失败")
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	_ = json.Unmarshal(responseBody, &payload)
	if len(payload.Choices) > 0 && strings.TrimSpace(payload.Choices[0].Message.Content) != "" {
		return payload.Choices[0].Message.Content, nil
	}
	return "ok", nil
}

func readAdminChannelError(body []byte, statusCode int, fallback string) error {
	var payload struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
		Msg string `json:"msg"`
	}
	if len(body) > 0 && json.Unmarshal(body, &payload) == nil {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return safeMessageError{message: payload.Error.Message}
		}
		if strings.TrimSpace(payload.Msg) != "" {
			return safeMessageError{message: payload.Msg}
		}
	}
	if statusCode == http.StatusUnauthorized {
		return safeMessageError{message: "上游接口认证失败（401），请检查 API Key"}
	}
	if statusCode > 0 {
		return safeMessageError{message: fmt.Sprintf("%s：%d", fallback, statusCode)}
	}
	return safeMessageError{message: fallback}
}

func SafeAIError(message string) error {
	return safeMessageError{message: message}
}

type safeMessageError struct {
	message string
}

func (err safeMessageError) Error() string {
	return err.message
}

func (err safeMessageError) SafeMessage() string {
	return err.message
}

func modelChannelRoutesForModel(channels []model.ModelChannel, modelName string) []ModelChannelRoute {
	modelName = strings.TrimSpace(modelName)
	result := []ModelChannelRoute{}
	for _, channel := range normalizeModelChannels(channels) {
		if !channel.Enabled || channel.BaseURL == "" || channel.APIKey == "" {
			continue
		}
		for _, item := range channel.ModelMappings {
			if item.Name == modelName {
				result = append(result, ModelChannelRoute{
					Channel:       channel,
					PublicModel:   item.Name,
					UpstreamModel: item.UpstreamName,
					Capability:    item.Capability,
				})
				break
			}
		}
	}
	return result
}
