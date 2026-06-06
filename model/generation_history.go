package model

type GenerationHistoryType string

const (
	GenerationHistoryTypeImage   GenerationHistoryType = "image"
	GenerationHistoryTypeVideo   GenerationHistoryType = "video"
	GenerationHistoryTypeModel3D GenerationHistoryType = "model3d"
)

type GenerationHistoryMedia struct {
	CloudFileID string        `json:"cloudFileId"`
	StorageKey  string        `json:"storageKey"`
	URL         string        `json:"url"`
	FileType    CloudFileType `json:"fileType"`
	ContentType string        `json:"contentType"`
	Size        int64         `json:"size"`
	Width       int           `json:"width"`
	Height      int           `json:"height"`
	ExpiresAt   string        `json:"expiresAt"`
}

type GenerationHistoryReference struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	URL        string `json:"url"`
	StorageKey string `json:"storageKey"`
}

// GenerationHistory 记录用户生成历史。媒体文件生命周期跟随关联的 cloud_files。
type GenerationHistory struct {
	ID         string                       `json:"id" gorm:"primaryKey"`
	UserID     string                       `json:"userId" gorm:"index"`
	Type       GenerationHistoryType        `json:"type" gorm:"index"`
	Title      string                       `json:"title"`
	Prompt     string                       `json:"prompt"`
	Model      string                       `json:"model"`
	Config     map[string]string            `json:"config" gorm:"serializer:json"`
	References []GenerationHistoryReference `json:"references" gorm:"serializer:json"`
	Media      []GenerationHistoryMedia     `json:"media" gorm:"serializer:json"`
	Status     string                       `json:"status"`
	Error      string                       `json:"error"`
	DurationMs int64                        `json:"durationMs"`
	ExpiresAt  string                       `json:"expiresAt" gorm:"index"`
	CreatedAt  string                       `json:"createdAt"`
	UpdatedAt  string                       `json:"updatedAt"`
}

type GenerationHistoryList struct {
	Items []GenerationHistory `json:"items"`
	Total int                 `json:"total"`
}
