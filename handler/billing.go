package handler

import (
	"log"
	"net/http"

	"github.com/basketikun/aivro/service"
)

// Plans 返回可用套餐列表（用户端）
func Plans(w http.ResponseWriter, r *http.Request) {
	plans, err := service.ListPlans(false)
	if err != nil {
		log.Printf("list plans failed: %v", err)
		Fail(w, "读取套餐失败")
		return
	}
	OK(w, plans)
}

// StripeCheckout 创建 Stripe 支付会话
func StripeCheckout(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CheckoutInput
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "参数错误")
		return
	}
	result, err := service.CreateStripeCheckout(r, user.ID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// StripeWebhook 处理 Stripe 回调
func StripeWebhook(w http.ResponseWriter, r *http.Request) {
	if err := service.HandleStripeWebhook(r); err != nil {
		log.Printf("stripe webhook failed: %v", err)
		FailError(w, err)
		return
	}
	OK(w, nil)
}

// KYCSession 创建 KYC 认证会话
func KYCSession(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.CreateKYCSession(r, user.ID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// KYCStatus 获取 KYC 认证状态
func KYCStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetKYCStatus(user.ID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// DiditWebhook 处理 Didit KYC 回调
func DiditWebhook(w http.ResponseWriter, r *http.Request) {
	if err := service.HandleDiditWebhook(r); err != nil {
		log.Printf("didit webhook failed: %v", err)
		FailError(w, err)
		return
	}
	OK(w, nil)
}

// AdminPlans 返回套餐列表（管理端）
func AdminPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := service.ListPlans(true)
	if err != nil {
		log.Printf("admin list plans failed: %v", err)
		Fail(w, "读取套餐失败")
		return
	}
	OK(w, plans)
}

// AdminSavePlan 创建或更新套餐（管理端）
func AdminSavePlan(w http.ResponseWriter, r *http.Request) {
	var input model.Plan
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "参数错误")
		return
	}
	plan, err := service.SavePlan(input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, plan)
}
