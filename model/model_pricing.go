package model

import "strings"

// PlanPricingCodes 是支持专属定价的套餐代码，顺序用于前台展示。
var PlanPricingCodes = []string{"go", "plus", "pro", "max"}

const (
	BillingTypeFixed = "fixed"
	BillingTypeSecond = "second"
	BillingTypeToken = "token"
	// DefaultAPIMultiplier 是 API 价相对控制台标准价的默认倍数。
	DefaultAPIMultiplier = 2
)

// CreditsForPlan 返回套餐专属价；没有配置或配置为 0 时沿用标准价。
func (m ModelCost) CreditsForPlan(planCode string) int {
	if value, ok := m.PlanCredits[strings.ToLower(strings.TrimSpace(planCode))]; ok && value > 0 {
		return value
	}
	return m.Credits
}

// APICost 返回 API 价格；显式配置大于 0 时优先使用，否则按标准价乘以倍数。
func (m ModelCost) APICost() int {
	if m.APICredits > 0 {
		return m.APICredits
	}
	multiplier := m.ApiMultiplier
	if multiplier <= 0 {
		multiplier = DefaultAPIMultiplier
	}
	return m.Credits * multiplier
}

// APIBillingType 返回 API 计费方式，未单独配置时沿用控制台计费方式。
func (m ModelCost) APIBillingType() string {
	if m.APIBilling == BillingTypeToken || m.APIBilling == BillingTypeFixed {
		return m.APIBilling
	}
	return m.BillingType
}
