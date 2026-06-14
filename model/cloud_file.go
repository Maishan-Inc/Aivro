package model

type CloudFileType string

const (
	CloudFileTypeImage   CloudFileType = "image"
	CloudFileTypeVideo   CloudFileType = "video"
	CloudFileTypeModel3D CloudFileType = "model3d"
	CloudFileTypeTask    CloudFileType = "task"
)

type CloudFilePurpose string

const (
	CloudFilePurposeTemp       CloudFilePurpose = "temp"
	CloudFilePurposeWorkflow   CloudFilePurpose = "workflow"
	CloudFilePurposeGeneration CloudFilePurpose = "generation"
)

// CloudFile 记录已转存到 R2/S3 或服务器本地的用户文件。
type CloudFile struct {
	ID          string           `json:"id" gorm:"primaryKey"`
	UserID      string           `json:"userId" gorm:"index"`
	Username    string           `json:"username" gorm:"index"`
	Provider    string           `json:"provider"`
	FileType    CloudFileType    `json:"fileType" gorm:"index"`
	Purpose     CloudFilePurpose `json:"purpose" gorm:"index"`
	WorkflowID  string           `json:"workflowId" gorm:"index"`
	HistoryID   string           `json:"historyId" gorm:"index"`
	Bucket      string           `json:"bucket"`
	ObjectKey   string           `json:"objectKey" gorm:"index"`
	PublicURL   string           `json:"publicUrl"`
	AccessToken string           `json:"-" gorm:"index"`
	ContentType string           `json:"contentType"`
	Size        int64            `json:"size"`
	Source      string           `json:"source"`
	ExpiresAt   string           `json:"expiresAt" gorm:"index"`
	DeletedAt   string           `json:"deletedAt" gorm:"index"`
	CreatedAt   string           `json:"createdAt"`
	UpdatedAt   string           `json:"updatedAt"`
}
