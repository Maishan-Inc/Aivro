package model

const (
	APIKeyActive  = "active"
	APIKeyRevoked = "revoked"
)

// UserAPIKey 仅保存密钥摘要和脱敏标识，完整密钥只在创建时返回。
type UserAPIKey struct {
	ID         string `json:"id" gorm:"primaryKey;size:64"`
	UserID     string `json:"-" gorm:"size:64;uniqueIndex:idx_user_api_key_name"`
	Name       string `json:"name" gorm:"size:200"`
	NameHash   string `json:"-" gorm:"size:64;uniqueIndex:idx_user_api_key_name"`
	KeyHash    string `json:"-" gorm:"size:64;uniqueIndex"`
	Preview    string `json:"preview" gorm:"size:40"`
	Status     string `json:"status" gorm:"size:16"`
	LastUsedAt string `json:"lastUsedAt"`
	CreatedAt  string `json:"createdAt"`
	RevokedAt  string `json:"revokedAt"`
}

type UserAPIKeyList struct {
	Items []UserAPIKey `json:"items"`
	Total int64        `json:"total"`
}

type CreatedUserAPIKey struct {
	Item UserAPIKey `json:"item"`
	Key  string     `json:"key"`
}

type APIModel struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Credits     int    `json:"credits"`
	BillingType string `json:"billingType"`
	VideoPrices map[string]int `json:"videoPrices,omitempty"`
}
