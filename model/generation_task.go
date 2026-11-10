package model

// GenerationTaskStatus 表示 AI 生成任务状态。
type GenerationTaskStatus string

const (
	GenerationTaskSubmitting GenerationTaskStatus = "submitting"
	GenerationTaskQueued    GenerationTaskStatus = "queued"
	GenerationTaskExecuting GenerationTaskStatus = "executing"
	GenerationTaskSucceeded GenerationTaskStatus = "succeeded"
	GenerationTaskFailed    GenerationTaskStatus = "failed"
	GenerationTaskCanceled  GenerationTaskStatus = "canceled"
)

// PromptReverseItem 保存单张反推图片的状态、用量和结果。
type PromptReverseItem struct {
	Name string `json:"name"`
	Media *GenerationHistoryMedia `json:"media,omitempty"`
	Status string `json:"status"`
	Error string `json:"error,omitempty"`
	Tokens int `json:"tokens"`
	Credits int `json:"credits"`
	Result map[string]any `json:"result,omitempty"`
}

// GenerationTask 记录 AI 请求从提交到结算的完整生命周期。
type GenerationTask struct {
	Items []PromptReverseItem `json:"items,omitempty" gorm:"serializer:json"`
	CampaignID string `json:"campaignId,omitempty" gorm:"index"`
	QuotaLimit int `json:"-" gorm:"-"`
	AgreementAcceptedAt string `json:"agreementAcceptedAt,omitempty"`
	AgreementVersion string `json:"agreementVersion,omitempty"`
	ID             string               `json:"id" gorm:"primaryKey"`
	UserID         string               `json:"userId" gorm:"index"`
	Username       string               `json:"username"`
	Model          string               `json:"model" gorm:"index"`
	Path           string               `json:"path" gorm:"index"`
	Section        string               `json:"section" gorm:"index"`
	Prompt         string               `json:"prompt" gorm:"type:text"`
	Parameters     map[string]any       `json:"parameters" gorm:"serializer:json"`
	RetentionDays  int                  `json:"retentionDays"`
	Progress       int                  `json:"progress"`
	Stage          string               `json:"stage"`
	ProviderTaskID string               `json:"providerTaskId"`
	ErrorDetail    string               `json:"errorDetail" gorm:"type:text"`
	User           *LogUser             `json:"user,omitempty" gorm:"-"`
	Media          []GenerationHistoryMedia `json:"media,omitempty" gorm:"-"`
	ContentType    string               `json:"contentType"`
	RequestFileID  string               `json:"requestFileId" gorm:"index"`
	Credits        int                  `json:"credits"`
	APIBillingType string               `json:"-"`
	APIUnitCredits int                  `json:"-"`
	VideoBillingType string             `json:"videoBillingType,omitempty"`
	VideoSeconds int                    `json:"videoSeconds,omitempty"`
	VideoUnitCredits int                `json:"videoUnitCredits,omitempty"`
	IP             string               `json:"-"`
	Country        string               `json:"-"`
	RequestCount   int                  `json:"requestCount"`
	Status         GenerationTaskStatus `json:"status" gorm:"index"`
	QueuePosition  int                  `json:"queuePosition" gorm:"index"`
	ResponseStatus int                  `json:"responseStatus"`
	ResponseHeader string               `json:"responseHeader" gorm:"type:text"`
	ResponseFileID string               `json:"responseFileId" gorm:"index"`
	Error          string               `json:"error"`
	StartedAt      string               `json:"startedAt" gorm:"index"`
	WorkerID       string               `json:"-" gorm:"index"`
	LeaseExpiresAt string               `json:"-" gorm:"index"`
	FinishedAt     string               `json:"finishedAt" gorm:"index"`
	CanceledAt     string               `json:"canceledAt"`
	CreatedAt      string               `json:"createdAt" gorm:"index"`
	UpdatedAt      string               `json:"updatedAt"`
}

type VideoTask struct {
	ID             string `json:"id" gorm:"primaryKey"`
	UserID         string `json:"userId" gorm:"index"`
	ProviderID     string `json:"-"`
	Model          string `json:"model"`
	ChannelBaseURL string `json:"-"`
	ChannelKeyHash string `json:"-"`
	CreatedAt      string `json:"createdAt"`
}

// GenerationTaskView 是前端轮询使用的轻量任务视图。
type GenerationTaskView struct {
	Items []PromptReverseItem `json:"items,omitempty"`
	Progress int `json:"progress"`
	Stage string `json:"stage"`
	BillingType string `json:"billingType,omitempty"`
	Seconds int `json:"seconds,omitempty"`
	UnitCredits int `json:"unitCredits"`
	ID              string `json:"id"`
	Model           string `json:"model"`
	Path            string `json:"path"`
	Status          string `json:"status"`
	QueuePosition   int    `json:"queuePosition"`
	AheadCount       int    `json:"aheadCount"`
	Credits          int    `json:"credits"`
	Error            string `json:"error"`
	CreatedAt        string `json:"createdAt"`
	StartedAt        string `json:"startedAt"`
	FinishedAt       string `json:"finishedAt"`
	ResultAvailable  bool   `json:"resultAvailable"`
	ResponseStatus   int    `json:"responseStatus"`
}

// GenerationTaskSubmitResult 是 AI 请求被队列接管时返回给前端的结果。
type GenerationTaskSubmitResult struct {
	BillingType string `json:"billingType,omitempty"`
	Seconds int `json:"seconds,omitempty"`
	UnitCredits int `json:"unitCredits"`
	EnergyCost int `json:"energyCost"`
	Queued        bool   `json:"queued"`
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	QueuePosition int    `json:"queuePosition"`
	AheadCount    int    `json:"aheadCount"`
	Model         string `json:"model"`
	Path          string `json:"path"`
}
