package model

// GenerationTaskStatus 表示 AI 生成任务状态。
type GenerationTaskStatus string

const (
	GenerationTaskQueued    GenerationTaskStatus = "queued"
	GenerationTaskExecuting GenerationTaskStatus = "executing"
	GenerationTaskSucceeded GenerationTaskStatus = "succeeded"
	GenerationTaskFailed    GenerationTaskStatus = "failed"
	GenerationTaskCanceled  GenerationTaskStatus = "canceled"
)

// GenerationTask 记录进入限流队列的 AI 请求。
type GenerationTask struct {
	ID             string               `json:"id" gorm:"primaryKey"`
	UserID         string               `json:"userId" gorm:"index"`
	Username       string               `json:"username"`
	Model          string               `json:"model" gorm:"index"`
	Path           string               `json:"path" gorm:"index"`
	ContentType    string               `json:"contentType"`
	RequestBody    []byte               `json:"-"`
	Credits        int                  `json:"credits"`
	RequestCount   int                  `json:"requestCount"`
	Status         GenerationTaskStatus `json:"status" gorm:"index"`
	QueuePosition  int                  `json:"queuePosition" gorm:"index"`
	ResponseStatus int                  `json:"responseStatus"`
	ResponseHeader string               `json:"responseHeader" gorm:"type:text"`
	ResponseBody   []byte               `json:"-"`
	Error          string               `json:"error"`
	StartedAt      string               `json:"startedAt" gorm:"index"`
	FinishedAt     string               `json:"finishedAt" gorm:"index"`
	CanceledAt     string               `json:"canceledAt"`
	CreatedAt      string               `json:"createdAt" gorm:"index"`
	UpdatedAt      string               `json:"updatedAt"`
}

// GenerationTaskView 是前端轮询使用的轻量任务视图。
type GenerationTaskView struct {
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
	Queued        bool   `json:"queued"`
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	QueuePosition int    `json:"queuePosition"`
	AheadCount    int    `json:"aheadCount"`
	Model         string `json:"model"`
	Path          string `json:"path"`
}
