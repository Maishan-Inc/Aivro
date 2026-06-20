package model

type PlanCode string

const (
	PlanCodeGO   PlanCode = "go"
	PlanCodePlus PlanCode = "plus"
	PlanCodePro  PlanCode = "pro"
	PlanCodeMax  PlanCode = "max"
)

type Plan struct {
	ID                    string                     `json:"id" gorm:"primaryKey"`
	Code                  PlanCode                   `json:"code" gorm:"uniqueIndex"`
	Name                  string                     `json:"name"`
	Description           string                     `json:"description" gorm:"type:text"`
	PriceCents            int                        `json:"priceCents"`
	Currency              string                     `json:"currency"`
	Credits               int                        `json:"credits"`
	WorkflowCreateCredits int                        `json:"workflowCreateCredits"`
	Enabled               bool                       `json:"enabled" gorm:"index"`
	Recommended           bool                       `json:"recommended"`
	Sort                  int                        `json:"sort"`
	Translations          map[string]PlanTranslation `json:"translations" gorm:"serializer:json"`
	CreatedAt             string                     `json:"createdAt"`
	UpdatedAt             string                     `json:"updatedAt"`
}

// PlanTranslation holds a fully independent set of display and entitlement
// values for a single locale. When present for a locale it overrides the base
// plan fields wholesale; locales without a translation fall back to the base.
type PlanTranslation struct {
	Name                  string `json:"name"`
	Description           string `json:"description"`
	PriceCents            int    `json:"priceCents"`
	Currency              string `json:"currency"`
	Credits               int    `json:"credits"`
	WorkflowCreateCredits int    `json:"workflowCreateCredits"`
}

// ResolveForLocale returns a copy of the plan with base display and entitlement
// fields replaced by the locale override when one exists. Plan-level fields
// (code, enabled, recommended, sort) are never localized.
func (p Plan) ResolveForLocale(locale string) Plan {
	tr, ok := p.Translations[locale]
	if !ok {
		return p
	}
	resolved := p
	if tr.Name != "" {
		resolved.Name = tr.Name
	}
	if tr.Description != "" {
		resolved.Description = tr.Description
	}
	if tr.Currency != "" {
		resolved.Currency = tr.Currency
	}
	if tr.PriceCents > 0 {
		resolved.PriceCents = tr.PriceCents
	}
	if tr.Credits > 0 {
		resolved.Credits = tr.Credits
	}
	if tr.WorkflowCreateCredits > 0 {
		resolved.WorkflowCreateCredits = tr.WorkflowCreateCredits
	}
	return resolved
}

type PlanOrderStatus string

const (
	PlanOrderStatusPending  PlanOrderStatus = "pending"
	PlanOrderStatusPaid     PlanOrderStatus = "paid"
	PlanOrderStatusFailed   PlanOrderStatus = "failed"
	PlanOrderStatusCanceled PlanOrderStatus = "canceled"
)

type PlanOrder struct {
	ID                      string          `json:"id" gorm:"primaryKey"`
	UserID                  string          `json:"userId" gorm:"index"`
	PlanID                  string          `json:"planId" gorm:"index"`
	Status                  PlanOrderStatus `json:"status" gorm:"index"`
	Locale                  string          `json:"locale"`
	AmountCents             int             `json:"amountCents"`
	Currency                string          `json:"currency"`
	Credits                 int             `json:"credits"`
	WorkflowCreateCredits   int             `json:"workflowCreateCredits"`
	StripeCheckoutSessionID string          `json:"stripeCheckoutSessionId" gorm:"uniqueIndex"`
	StripePaymentIntentID   string          `json:"stripePaymentIntentId" gorm:"index"`
	PaidAt                  string          `json:"paidAt"`
	CreatedAt               string          `json:"createdAt"`
	UpdatedAt               string          `json:"updatedAt"`
}

type EntitlementLogSource string

const (
	EntitlementLogPlanPurchase   EntitlementLogSource = "plan_purchase"
	EntitlementLogKYCReward      EntitlementLogSource = "kyc_reward"
	EntitlementLogWorkflowCreate EntitlementLogSource = "workflow_create"
	EntitlementLogAdminAdjust    EntitlementLogSource = "admin_adjust"
)

type EntitlementLog struct {
	ID                         string               `json:"id" gorm:"primaryKey"`
	UserID                     string               `json:"userId" gorm:"index"`
	Source                     EntitlementLogSource `json:"source" gorm:"index"`
	SourceID                   string               `json:"sourceId" gorm:"index"`
	CreditsDelta               int                  `json:"creditsDelta"`
	WorkflowCreateCreditsDelta int                  `json:"workflowCreateCreditsDelta"`
	CreditsAfter               int                  `json:"creditsAfter"`
	WorkflowCreateCreditsAfter int                  `json:"workflowCreateCreditsAfter"`
	Remark                     string               `json:"remark"`
	CreatedAt                  string               `json:"createdAt"`
}
