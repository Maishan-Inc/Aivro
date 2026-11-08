package model

// GenerationRetentionPolicy 配置会员组各工作台生成文件的保存天数。
type GenerationRetentionPolicy struct {
	Group string `json:"group" gorm:"primaryKey"`
	Days map[string]int `json:"days" gorm:"serializer:json"`
	UpdatedAt string `json:"updatedAt"`
}

type GenerationRetention struct {
	Group string `json:"group"`
	Days map[string]int `json:"days"`
}
