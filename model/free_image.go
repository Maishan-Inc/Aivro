package model

// FreeImageCampaign 每期免费生图活动独立配置模型和会员次数。
type FreeImageCampaign struct {
	ID string `json:"id" gorm:"primaryKey"`
	Name string `json:"name"`
	Enabled bool `json:"enabled" gorm:"index"`
	StartsAt string `json:"startsAt" gorm:"index"`
	EndsAt string `json:"endsAt" gorm:"index"`
	Models []string `json:"models" gorm:"serializer:json"`
	GroupLimits map[string]int `json:"groupLimits" gorm:"serializer:json"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type FreeImageUsage struct {
	CampaignID string `json:"campaignId" gorm:"primaryKey"`
	UserID string `json:"userId" gorm:"primaryKey"`
	Used int `json:"used"`
}

type FreeImageState struct {
	Campaign *FreeImageCampaign `json:"campaign"`
	Group string `json:"group"`
	Limit int `json:"limit"`
	Used int `json:"used"`
	Remaining int `json:"remaining"`
}
