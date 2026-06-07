package model

type UserRole string

const (
	UserRoleGuest UserRole = "guest"
	UserRoleUser  UserRole = "user"
	UserRoleAdmin UserRole = "admin"
)

type UserStatus string

const (
	UserStatusActive UserStatus = "active"
	UserStatusBan    UserStatus = "ban"
)

type UserAccountType string

const (
	UserAccountTypePersonal UserAccountType = "personal"
	UserAccountTypeCompany  UserAccountType = "company"
)

// User 系统用户。
type User struct {
	ID                    string          `json:"id" gorm:"primaryKey"`
	Username              string          `json:"username" gorm:"uniqueIndex"`
	Password              string          `json:"password,omitempty"`
	Email                 string          `json:"email"`
	DisplayName           string          `json:"displayName"`
	AccountType           UserAccountType `json:"accountType"`
	ProfileCompleted      bool            `json:"profileCompleted"`
	AvatarURL             string          `json:"avatarUrl"`
	Role                  UserRole        `json:"role"`
	Credits               int             `json:"credits"`
	WorkflowCreateCredits int             `json:"workflowCreateCredits"`
	AffCode               string          `json:"affCode" gorm:"uniqueIndex"`
	AffCount              int             `json:"affCount"`
	InviterID             string          `json:"inviterId"`
	GithubID              string          `json:"githubId" gorm:"index"`
	GoogleID              string          `json:"googleId" gorm:"index"`
	LinuxDoID             string          `json:"linuxDoId" gorm:"index"`
	MetaMaskAddress       string          `json:"metamaskAddress" gorm:"column:metamask_address;index"`
	WechatID              string          `json:"wechatId"`
	AuthProvider          string          `json:"authProvider"`
	EmailVerified         bool            `json:"emailVerified"`
	Status                UserStatus      `json:"status"`
	TokenVersion          int             `json:"tokenVersion"`
	LastLoginAt           string          `json:"lastLoginAt"`
	Extra                 string          `json:"extra" gorm:"type:text"`
	CreatedAt             string          `json:"createdAt"`
	UpdatedAt             string          `json:"updatedAt"`
}

// UserList 用户分页结果。
type UserList struct {
	Items []User `json:"items"`
	Total int    `json:"total"`
}

// AuthUser 用户公开信息。
type AuthUser struct {
	ID                    string          `json:"id"`
	Username              string          `json:"username"`
	DisplayName           string          `json:"displayName"`
	AccountType           UserAccountType `json:"accountType"`
	ProfileCompleted      bool            `json:"profileCompleted"`
	AvatarURL             string          `json:"avatarUrl"`
	Role                  UserRole        `json:"role"`
	Credits               int             `json:"credits"`
	WorkflowCreateCredits int             `json:"workflowCreateCredits"`
	CreatedAt             string          `json:"createdAt"`
	UpdatedAt             string          `json:"updatedAt"`
}

// AuthSession 登录会话信息。
type AuthSession struct {
	Token string   `json:"token"`
	User  AuthUser `json:"user"`
}

// UserPreference 保存用户界面与生成参数偏好。
type UserPreference struct {
	UserID    string         `json:"userId" gorm:"primaryKey"`
	Value     map[string]any `json:"value" gorm:"serializer:json"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}

func PublicUser(user User) AuthUser {
	return AuthUser{
		ID:                    user.ID,
		Username:              user.Username,
		DisplayName:           user.DisplayName,
		AccountType:           user.AccountType,
		ProfileCompleted:      user.ProfileCompleted,
		AvatarURL:             user.AvatarURL,
		Role:                  user.Role,
		Credits:               user.Credits,
		WorkflowCreateCredits: user.WorkflowCreateCredits,
		CreatedAt:             user.CreatedAt,
		UpdatedAt:             user.UpdatedAt,
	}
}

type CreditLogType string

const (
	CreditLogTypeAdminAdjust CreditLogType = "admin_adjust"
	CreditLogTypeAIConsume   CreditLogType = "ai_consume"
	CreditLogTypeAIRefund    CreditLogType = "ai_refund"
)

// CreditLog 用户算力点变更流水。
type CreditLog struct {
	ID        string        `json:"id" gorm:"primaryKey"`
	UserID    string        `json:"userId" gorm:"index"`
	Type      CreditLogType `json:"type"`
	Amount    int           `json:"amount"`
	Balance   int           `json:"balance"`
	RelatedID string        `json:"relatedId"`
	Remark    string        `json:"remark"`
	Extra     string        `json:"extra" gorm:"type:text"`
	CreatedAt string        `json:"createdAt"`
}

type CreditLogList struct {
	Items []CreditLog `json:"items"`
	Total int         `json:"total"`
}

// EmailVerification 邮箱验证码。
type EmailVerification struct {
	ID        string `json:"id" gorm:"primaryKey"`
	Purpose   string `json:"purpose" gorm:"index"`
	Target    string `json:"target" gorm:"index"`
	Code      string `json:"code"`
	Attempts  int    `json:"attempts"`
	ExpiresAt string `json:"expiresAt" gorm:"index"`
	UsedAt    string `json:"usedAt"`
	CreatedAt string `json:"createdAt"`
}
