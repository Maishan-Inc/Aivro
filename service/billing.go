package service

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v79"
	checkoutsession "github.com/stripe/stripe-go/v79/checkout/session"
	"github.com/stripe/stripe-go/v79/webhook"
	"gorm.io/gorm"
)

type CheckoutInput struct {
	PlanID string `json:"planId"`
	Locale string `json:"locale"`
}

func ListPlans(admin bool) ([]model.Plan, error) {
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	items := []model.Plan{}
	query := func() error {
		tx := db.Order("sort asc, created_at asc")
		if !admin {
			tx = tx.Where("enabled = ?", true)
		}
		return tx.Find(&items).Error
	}
	if err := query(); err != nil {
		return nil, err
	}
	if len(items) == 0 {
		if err := repository.EnsureDefaultPlans(); err != nil {
			return nil, err
		}
		items = []model.Plan{}
		if err := query(); err != nil {
			return nil, err
		}
	}
	return items, nil
}

func SavePlan(input model.Plan) (model.Plan, error) {
	db, err := repository.DB()
	if err != nil {
		return input, err
	}
	if input.ID == "" {
		input.ID = "plan-" + uuid.NewString()
		input.CreatedAt = now()
	}
	input.Code = normalizePlanCode(input.Code)
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		input.Name = strings.ToUpper(string(input.Code))
	}
	if input.Currency == "" {
		input.Currency = "USD"
	}
	input.Currency = strings.ToUpper(input.Currency)
	input.UpdatedAt = now()
	return input, db.Save(&input).Error
}

func CreateStripeCheckout(r *http.Request, userID string, input CheckoutInput) (map[string]string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return nil, err
	}
	stripeSetting := normalizePrivateSetting(settings.Private).Stripe
	if !stripeSetting.Enabled || strings.TrimSpace(stripeSetting.SecretKey) == "" {
		return nil, safeMessageError{message: "Stripe 支付未配置"}
	}
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	plan := model.Plan{}
	if err := db.Where("id = ? AND enabled = ?", input.PlanID, true).First(&plan).Error; err != nil {
		return nil, safeMessageError{message: "套餐不存在或已下架"}
	}
	resolved := plan.ResolveForLocale(input.Locale)
	order := model.PlanOrder{
		ID:                    newID("order"),
		UserID:                userID,
		PlanID:                plan.ID,
		Status:                model.PlanOrderStatusPending,
		Locale:                input.Locale,
		AmountCents:           resolved.PriceCents,
		Currency:              strings.ToUpper(resolved.Currency),
		Credits:               resolved.Credits,
		WorkflowCreateCredits: resolved.WorkflowCreateCredits,
		CreatedAt:             now(),
		UpdatedAt:             now(),
	}
	if err := db.Create(&order).Error; err != nil {
		return nil, err
	}
	stripe.Key = stripeSetting.SecretKey
	origin := RequestOrigin(r)
	successURL := firstNonEmpty(stripeSetting.SuccessURL, origin+"/pricing/success?session_id={CHECKOUT_SESSION_ID}")
	cancelURL := firstNonEmpty(stripeSetting.CancelURL, origin+"/pricing")
	params := &stripe.CheckoutSessionParams{
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{{
			Quantity: stripe.Int64(1),
			PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
				Currency:   stripe.String(strings.ToLower(resolved.Currency)),
				UnitAmount: stripe.Int64(int64(resolved.PriceCents)),
				ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
					Name:        stripe.String(resolved.Name),
					Description: stripe.String(resolved.Description),
				},
			},
		}},
		Metadata: map[string]string{
			"order_id": order.ID,
			"plan_id":  plan.ID,
			"user_id":  userID,
		},
	}
	session, err := checkoutsession.New(params)
	if err != nil {
		return nil, err
	}
	order.StripeCheckoutSessionID = session.ID
	order.UpdatedAt = now()
	if err := db.Save(&order).Error; err != nil {
		return nil, err
	}
	return map[string]string{"checkoutUrl": session.URL, "orderId": order.ID}, nil
}

func HandleStripeWebhook(r *http.Request) error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	stripeSetting := normalizePrivateSetting(settings.Private).Stripe
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), stripeSetting.WebhookSecret)
	if err != nil {
		return safeMessageError{message: "Stripe webhook 签名无效"}
	}
	if event.Type != "checkout.session.completed" {
		return nil
	}
	var session stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}
	orderID := session.Metadata["order_id"]
	if orderID == "" {
		orderID = session.ClientReferenceID
	}
	db, err := repository.DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		order := model.PlanOrder{}
		if err := tx.Where("id = ? OR stripe_checkout_session_id = ?", orderID, session.ID).First(&order).Error; err != nil {
			return err
		}
		if order.Status == model.PlanOrderStatusPaid {
			return nil
		}
		plan := model.Plan{}
		if err := tx.Where("id = ?", order.PlanID).First(&plan).Error; err != nil {
			return err
		}
		user := model.User{}
		if err := tx.Where("id = ?", order.UserID).First(&user).Error; err != nil {
			return err
		}
		// Grant the entitlements recorded on the order at checkout time so the
		// user gets exactly what was localized and paid for. Fall back to the
		// current plan values for legacy orders created before locale recording.
		creditsDelta := order.Credits
		workflowDelta := order.WorkflowCreateCredits
		if creditsDelta == 0 && workflowDelta == 0 {
			creditsDelta = plan.Credits
			workflowDelta = plan.WorkflowCreateCredits
		}
		user.Credits += creditsDelta
		user.WorkflowCreateCredits += workflowDelta
		user.UpdatedAt = now()
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		order.Status = model.PlanOrderStatusPaid
		order.StripeCheckoutSessionID = session.ID
		if session.PaymentIntent != nil {
			order.StripePaymentIntentID = session.PaymentIntent.ID
		}
		order.PaidAt = now()
		order.UpdatedAt = now()
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return createEntitlementLogTx(tx, model.EntitlementLog{
			ID:                         newID("entitle"),
			UserID:                     user.ID,
			Source:                     model.EntitlementLogPlanPurchase,
			SourceID:                   order.ID,
			CreditsDelta:               creditsDelta,
			WorkflowCreateCreditsDelta: workflowDelta,
			CreditsAfter:               user.Credits,
			WorkflowCreateCreditsAfter: user.WorkflowCreateCredits,
			Remark:                     "Stripe 套餐购买",
			CreatedAt:                  now(),
		})
	})
}

func normalizePlanCode(code model.PlanCode) model.PlanCode {
	switch strings.ToLower(string(code)) {
	case "plus":
		return model.PlanCodePlus
	case "pro":
		return model.PlanCodePro
	case "max":
		return model.PlanCodeMax
	default:
		return model.PlanCodeGO
	}
}
