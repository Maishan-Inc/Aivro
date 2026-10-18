package service

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v79"
	checkoutsession "github.com/stripe/stripe-go/v79/checkout/session"
	"github.com/stripe/stripe-go/v79/webhook"
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
	input.Features = cleanPlanFeatures(input.Features)
	for key, tr := range input.Translations {
		tr.Features = cleanPlanFeatures(tr.Features)
		input.Translations[key] = tr
	}
	input.UpdatedAt = now()
	return input, db.Save(&input).Error
}

func cleanPlanFeatures(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		text := strings.TrimSpace(item)
		if text != "" {
			result = append(result, text)
		}
	}
	return result
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
	if resolved.PriceCents <= 0 || resolved.Credits < 0 || resolved.WorkflowCreateCredits < 0 { return nil, safeMessageError{message: "套餐价格或权益配置无效"} }
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
	params.Context = r.Context()
	params.SetIdempotencyKey(order.ID)
	client := checkoutsession.Client{B: stripe.GetBackend(stripe.APIBackend), Key: stripeSetting.SecretKey}
	session, err := client.New(params)
	if err != nil {
		return nil, err
	}
	order.StripeCheckoutSessionID = &session.ID
	order.UpdatedAt = now()
	if err := db.Model(&model.PlanOrder{}).Where("id = ?", order.ID).Updates(map[string]any{"stripe_checkout_session_id": session.ID, "updated_at": now()}).Error; err != nil {
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
	body, err := readLimited(r.Body, 1<<20, "回调内容过大")
	if err != nil {
		return err
	}
	if strings.TrimSpace(stripeSetting.WebhookSecret) == "" {
		return &webhookSignatureError{message: "Stripe webhook 签名未配置"}
	}
	event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), stripeSetting.WebhookSecret)
	if err != nil {
		return &webhookSignatureError{message: "Stripe webhook 签名无效"}
	}
	if event.Type != "checkout.session.completed" && event.Type != "checkout.session.async_payment_succeeded" {
		return nil
	}
	var session stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}
	if session.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		return nil
	}
	orderID := session.Metadata["order_id"]
	if orderID == "" || session.ID == "" {
		return safeMessageError{message: "支付订单信息不完整"}
	}
	order, err := repository.GetPlanOrder(orderID)
	if err != nil {
		return err
	}
	if order.UserID != session.Metadata["user_id"] || order.PlanID != session.Metadata["plan_id"] || int64(order.AmountCents) != session.AmountTotal || !strings.EqualFold(order.Currency, string(session.Currency)) || (order.StripeCheckoutSessionID != nil && *order.StripeCheckoutSessionID != session.ID) {
		return safeMessageError{message: "支付金额或订单信息不匹配"}
	}
	intentID := ""
	if session.PaymentIntent != nil {
		intentID = session.PaymentIntent.ID
	}
	return repository.CompletePlanOrder(order, session.ID, intentID, model.EntitlementLog{
		ID: newID("entitle"), UserID: order.UserID, Source: model.EntitlementLogPlanPurchase, SourceID: order.ID,
		CreditsDelta: order.Credits, WorkflowCreateCreditsDelta: order.WorkflowCreateCredits,
		Remark: "Stripe 套餐购买", CreatedAt: now(),
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
