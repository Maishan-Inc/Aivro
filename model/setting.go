package model

import "encoding/json"

type SettingKey string

const (
	SettingKeyPublic  SettingKey = "public"
	SettingKeyPrivate SettingKey = "private"
)

type ModelRateLimit struct {
	Model     string `json:"model"`
	PerMinute int    `json:"perMinute"`
}

// AIQueueSetting 控制 AI 请求按模型限流和排队。
type AIQueueSetting struct {
	Enabled            *bool            `json:"enabled"`
	Backend            string           `json:"backend"`
	RedisURL           string           `json:"redisUrl"`
	DefaultPerMinute   int              `json:"defaultPerMinute"`
	ModelPerMinute     []ModelRateLimit `json:"modelPerMinute"`
	MaxQueuedPerUser   int              `json:"maxQueuedPerUser"`
	TaskRetentionHours int              `json:"taskRetentionHours"`
}

// ModelChannel 模型渠道配置。
type ModelChannel struct {
	Protocol string   `json:"protocol"`
	Name     string   `json:"name"`
	BaseURL  string   `json:"baseUrl"`
	APIKey   string   `json:"apiKey"`
	Models   []string `json:"models"`
	Weight   int      `json:"weight"`
	Enabled  bool     `json:"enabled"`
	Remark   string   `json:"remark"`
}

// ModelCost 模型算力点配置。
type ModelCost struct {
	Model   string `json:"model"`
	Credits int    `json:"credits"`
}

// PublicModelChannelSetting 公开模型渠道配置。
type PublicModelChannelSetting struct {
	AvailableModels   []string    `json:"availableModels"`
	ModelCosts        []ModelCost `json:"modelCosts"`
	DefaultModel      string      `json:"defaultModel"`
	DefaultImageModel string      `json:"defaultImageModel"`
	DefaultVideoModel string      `json:"defaultVideoModel"`
	DefaultTextModel  string      `json:"defaultTextModel"`
	SystemPrompt      string      `json:"systemPrompt"`
}

// PublicSetting 公开配置。
type PublicSetting struct {
	ModelChannel PublicModelChannelSetting `json:"modelChannel"`
	Auth         PublicAuthSetting         `json:"auth"`
	Pages        PublicPagesSetting        `json:"pages"`
	PageAccess   PublicPageAccessSetting   `json:"pageAccess"`
	AdSense      PublicAdSenseSetting      `json:"adSense"`
}

type PublicPagesSetting struct {
	PrivacyTitle     string `json:"privacyTitle"`
	PrivacyContent   string `json:"privacyContent"`
	PrivacyTitleEn   string `json:"privacyTitleEn"`
	PrivacyContentEn string `json:"privacyContentEn"`
	TermsTitle       string `json:"termsTitle"`
	TermsContent     string `json:"termsContent"`
	TermsTitleEn     string `json:"termsTitleEn"`
	TermsContentEn   string `json:"termsContentEn"`
}

type PublicPageAccessSetting struct {
	CanvasLoginRequired  bool `json:"canvasLoginRequired"`
	ImageLoginRequired   bool `json:"imageLoginRequired"`
	VideoLoginRequired   bool `json:"videoLoginRequired"`
	PromptsLoginRequired bool `json:"promptsLoginRequired"`
	AssetsLoginRequired  bool `json:"assetsLoginRequired"`
}

type PublicAdSenseSetting struct {
	Enabled bool                     `json:"enabled"`
	Code    string                   `json:"code"`
	AdsTxt  string                   `json:"adsTxt"`
	Pages   PublicAdSensePageSetting `json:"pages"`
}

type PublicAdSensePageSetting struct {
	Home         bool `json:"home"`
	Pricing      bool `json:"pricing"`
	Image        bool `json:"image"`
	Video        bool `json:"video"`
	Model3D      bool `json:"model3d"`
	Canvas       bool `json:"canvas"`
	Prompts      bool `json:"prompts"`
	Assets       bool `json:"assets"`
	AssetLibrary bool `json:"assetLibrary"`
	Privacy      bool `json:"privacy"`
	Terms        bool `json:"terms"`
}

type PublicAuthSetting struct {
	AllowRegister     *bool                        `json:"allowRegister"`
	EmailVerification *bool                        `json:"emailVerification"`
	TurnstileSiteKey  string                       `json:"turnstileSiteKey"`
	Captcha           PublicCaptchaSetting         `json:"captcha"`
	LinuxDo           PublicOAuthProviderSetting   `json:"linuxDo"`
	Google            PublicOAuthProviderSetting   `json:"google"`
	Github            PublicOAuthProviderSetting   `json:"github"`
	MetaMask          PublicOAuthProviderSetting   `json:"metamask"`
	CustomProviders   []PublicOAuthProviderSetting `json:"customProviders"`
}

type CaptchaProvider string

const (
	CaptchaProviderTurnstile CaptchaProvider = "turnstile"
	CaptchaProviderHCaptcha  CaptchaProvider = "hcaptcha"
)

type PublicCaptchaSetting struct {
	Enabled  bool            `json:"enabled"`
	Provider CaptchaProvider `json:"provider"`
	SiteKey  string          `json:"siteKey"`
}

type PublicOAuthProviderSetting struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	IconURL          string `json:"iconUrl"`
	Enabled          bool   `json:"enabled"`
	SiteName         string `json:"siteName"`
	SiteURL          string `json:"siteUrl"`
	SignatureLogoURL string `json:"signatureLogoUrl"`
}

// PrivateSetting 私有配置。
type PrivateSetting struct {
	Channels     []ModelChannel      `json:"channels"`
	Runtime      RuntimeSetting      `json:"runtime"`
	PromptSync   PromptSyncSetting   `json:"promptSync"`
	AIQueue      AIQueueSetting      `json:"aiQueue"`
	CanvasAssist CanvasAssistSetting `json:"canvasAssist"`
	Captcha      CaptchaSetting      `json:"captcha"`
	Turnstile    TurnstileSetting    `json:"turnstile"`
	Auth         PrivateAuthSetting  `json:"auth"`
	Mail         MailSetting         `json:"mail"`
	CloudStorage CloudStorageSetting `json:"cloudStorage"`
	Stripe       StripeSetting       `json:"stripe"`
	KYC          KYCSetting          `json:"kyc"`
}

type RuntimeSetting struct {
	AppOrigin      string `json:"appOrigin"`
	AllowedOrigins string `json:"allowedOrigins"`
	JWTExpireHours int    `json:"jwtExpireHours"`
}

type TurnstileSetting struct {
	Enabled   bool   `json:"enabled"`
	SiteKey   string `json:"siteKey"`
	SecretKey string `json:"secretKey"`
}

type CaptchaSetting struct {
	Enabled   bool                      `json:"enabled"`
	Provider  CaptchaProvider           `json:"provider"`
	Turnstile CaptchaProviderKeySetting `json:"turnstile"`
	HCaptcha  CaptchaProviderKeySetting `json:"hcaptcha"`
}

type CaptchaProviderKeySetting struct {
	SiteKey   string `json:"siteKey"`
	SecretKey string `json:"secretKey"`
}

type StripeSetting struct {
	Enabled       bool   `json:"enabled"`
	SecretKey     string `json:"secretKey"`
	WebhookSecret string `json:"webhookSecret"`
	SuccessURL    string `json:"successUrl"`
	CancelURL     string `json:"cancelUrl"`
}

type KYCSetting struct {
	Enabled                     bool   `json:"enabled"`
	Provider                    string `json:"provider"`
	DiditAPIKey                 string `json:"diditApiKey"`
	DiditWebhookSecret          string `json:"diditWebhookSecret"`
	WorkflowID                  string `json:"workflowId"`
	CallbackURL                 string `json:"callbackUrl"`
	RewardCredits               int    `json:"rewardCredits"`
	RewardWorkflowCreateCredits int    `json:"rewardWorkflowCreateCredits"`
	RewardOnce                  bool   `json:"rewardOnce"`
}

// CloudStorageSetting 云存储配置。Cloudflare R2 通过 S3-compatible endpoint 访问。
type CloudStorageSetting struct {
	Enabled             bool   `json:"enabled"`
	StorageMode         string `json:"storageMode"`
	Provider            string `json:"provider"`
	Endpoint            string `json:"endpoint"`
	Region              string `json:"region"`
	AccessKeyID         string `json:"accessKeyId"`
	SecretAccessKey     string `json:"secretAccessKey"`
	Bucket              string `json:"bucket"`
	PublicBaseURL       string `json:"publicBaseUrl"`
	ImagePathTemplate   string `json:"imagePathTemplate"`
	VideoPathTemplate   string `json:"videoPathTemplate"`
	Model3DPathTemplate string `json:"model3dPathTemplate"`
	ImageExpireDays     int    `json:"imageExpireDays"`
	VideoExpireDays     int    `json:"videoExpireDays"`
	Model3DExpireDays   int    `json:"model3dExpireDays"`
	AutoCleanupEnabled  *bool  `json:"autoCleanupEnabled"`
	PathStyleEndpoint   *bool  `json:"pathStyleEndpoint"`
}

// PromptSyncSetting 提示词定时同步配置。
type PromptSyncSetting struct {
	Enabled               *bool  `json:"enabled"`
	Cron                  string `json:"cron"`
	GithubRawProxyEnabled bool   `json:"githubRawProxyEnabled"`
}

type CanvasAssistSetting struct {
	HistoryRetentionDays int `json:"historyRetentionDays"`
}

type PrivateAuthSetting struct {
	LinuxDo         PrivateOAuthProviderSetting   `json:"linuxDo"`
	Google          PrivateOAuthProviderSetting   `json:"google"`
	Github          PrivateOAuthProviderSetting   `json:"github"`
	MetaMask        PrivateMetaMaskAuthSetting    `json:"metamask"`
	CustomProviders []PrivateOAuthProviderSetting `json:"customProviders"`
}

type PrivateOAuthProviderSetting struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	IconURL      string `json:"iconUrl"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	AuthorizeURL string `json:"authorizeUrl"`
	TokenURL     string `json:"tokenUrl"`
	UserInfoURL  string `json:"userInfoUrl"`
	Scope        string `json:"scope"`
	Enabled      bool   `json:"enabled"`
}

type PrivateMetaMaskAuthSetting struct {
	Enabled          bool   `json:"enabled"`
	SiteName         string `json:"siteName"`
	SiteURL          string `json:"siteUrl"`
	SignatureLogoURL string `json:"signatureLogoUrl"`
}

type MailSetting struct {
	Enabled       bool          `json:"enabled"`
	Host          string        `json:"host"`
	Port          int           `json:"port"`
	Username      string        `json:"username"`
	Password      string        `json:"password"`
	FromEmail     string        `json:"fromEmail"`
	FromName      string        `json:"fromName"`
	CodeExpireMin int           `json:"codeExpireMin"`
	Templates     MailTemplates `json:"templates"`
}

type MailTemplates struct {
	Register MailTemplate `json:"register"`
	Reset    MailTemplate `json:"reset"`
	MetaMask MailTemplate `json:"metamask"`
}

type MailTemplate struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// Setting 系统配置。
type Setting struct {
	Key       SettingKey      `json:"key" gorm:"primaryKey"`
	Value     json.RawMessage `json:"value" gorm:"serializer:json"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

type DatabaseUpdateLog struct {
	ID         string `json:"id" gorm:"primaryKey"`
	SourceFile string `json:"sourceFile"`
	Models     string `json:"models"`
	Status     string `json:"status"`
	Error      string `json:"error"`
	CreatedAt  string `json:"createdAt"`
}

type DatabaseStatus struct {
	Driver         string              `json:"driver"`
	DSN            string              `json:"dsn"`
	Updated        bool                `json:"updated"`
	SourceFiles    []string            `json:"sourceFiles"`
	Missing        []string            `json:"missing"`
	MissingColumns []string            `json:"missingColumns"`
	Logs           []DatabaseUpdateLog `json:"logs"`
}

// Settings 系统公开和私有配置。
type Settings struct {
	Public  PublicSetting  `json:"public"`
	Private PrivateSetting `json:"private"`
}
