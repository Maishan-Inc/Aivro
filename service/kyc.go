package service

import (
	"bytes"
	"crypto/hmac"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"gorm.io/gorm"
)

type KYCSessionResponse struct {
	URL      string               `json:"url"`
	Status   model.KYCStatus      `json:"status"`
	Provider string               `json:"provider"`
	Rewards  KYCRewardDescription `json:"rewards"`
}

type KYCRewardDescription struct {
	Credits               int `json:"credits"`
	WorkflowCreateCredits int `json:"workflowCreateCredits"`
}

func KYCStatusForUser(userID string) (map[string]any, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return nil, err
	}
	kyc := normalizePrivateSetting(settings.Private).KYC
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	item := model.KYCVerification{}
	status := "unverified"
	if err := db.Where("user_id = ?", userID).Order("created_at desc").First(&item).Error; err == nil {
		status = string(item.Status)
	}
	return map[string]any{
		"enabled":      kyc.Enabled,
		"provider":     firstNonEmpty(kyc.Provider, "didit"),
		"status":       status,
		"verification": item,
		"rewards":      KYCRewardDescription{Credits: kyc.RewardCredits, WorkflowCreateCredits: kyc.RewardWorkflowCreateCredits},
	}, nil
}

func CreateKYCSession(r *http.Request, userID string) (KYCSessionResponse, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return KYCSessionResponse{}, err
	}
	kyc := normalizePrivateSetting(settings.Private).KYC
	if !kyc.Enabled || strings.TrimSpace(kyc.DiditAPIKey) == "" || strings.TrimSpace(kyc.WorkflowID) == "" {
		return KYCSessionResponse{}, safeMessageError{message: "KYC 认证未配置"}
	}
	db, err := repository.DB()
	if err != nil {
		return KYCSessionResponse{}, err
	}
	if kyc.RewardOnce {
		var count int64
		if err := db.Model(&model.KYCVerification{}).Where("user_id = ? AND status = ? AND rewarded = ?", userID, model.KYCStatusApproved, true).Count(&count).Error; err != nil {
			return KYCSessionResponse{}, err
		}
		if count > 0 {
			return KYCSessionResponse{}, safeMessageError{message: "当前账号已领取过 KYC 奖励"}
		}
	}
	payload := map[string]any{
		"workflow_id": kyc.WorkflowID,
		"vendor_data": userID,
		"callback":    firstNonEmpty(kyc.CallbackURL, RequestOrigin(r)+"/api/webhooks/didit"),
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, "https://verification.didit.me/v3/session/", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", kyc.DiditAPIKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return KYCSessionResponse{}, err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return KYCSessionResponse{}, safeMessageError{message: "创建 KYC 认证会话失败"}
	}
	var data map[string]any
	_ = json.Unmarshal(responseBody, &data)
	sessionID := firstNonEmpty(anyString(data["session_id"]), anyString(data["id"]))
	url := firstNonEmpty(anyString(data["url"]), anyString(data["verification_url"]), anyString(data["session_url"]))
	if sessionID == "" || url == "" {
		return KYCSessionResponse{}, safeMessageError{message: "KYC 服务返回异常"}
	}
	item := model.KYCVerification{
		ID:                newID("kyc"),
		UserID:            userID,
		Provider:          "didit",
		ProviderSessionID: sessionID,
		Status:            model.KYCStatusPending,
		RawPayload:        responseBody,
		CreatedAt:         now(),
		UpdatedAt:         now(),
	}
	if err := db.Save(&item).Error; err != nil {
		return KYCSessionResponse{}, err
	}
	return KYCSessionResponse{URL: url, Status: item.Status, Provider: item.Provider, Rewards: KYCRewardDescription{Credits: kyc.RewardCredits, WorkflowCreateCredits: kyc.RewardWorkflowCreateCredits}}, nil
}

func HandleDiditWebhook(r *http.Request) error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	kyc := normalizePrivateSetting(settings.Private).KYC
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	if strings.TrimSpace(kyc.DiditWebhookSecret) == "" {
		return safeMessageError{message: "Didit webhook 签名未配置"}
	}
	if !validDiditSignature(r, body, kyc.DiditWebhookSecret) {
		return safeMessageError{message: "Didit webhook 签名无效"}
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return err
	}
	sessionID := firstNonEmpty(anyString(payload["session_id"]), anyString(payload["id"]), anyString(payload["verification_id"]))
	userID := firstNonEmpty(anyString(payload["vendor_data"]), anyString(payload["user_id"]))
	status := normalizeKYCStatus(firstNonEmpty(anyString(payload["status"]), anyString(payload["decision"]), anyString(payload["verification_status"])))
	if sessionID == "" {
		return nil
	}
	db, err := repository.DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		item := model.KYCVerification{}
		if err := tx.Where("provider_session_id = ?", sessionID).First(&item).Error; err != nil {
			return nil
		}
		item.Status = status
		item.RawPayload = body
		item.UpdatedAt = now()
		if status == model.KYCStatusApproved && !item.Rewarded {
			if err := grantKYCRewardTx(tx, item.UserID, item.ID, kyc); err != nil {
				return err
			}
			item.Rewarded = true
		}
		return tx.Save(&item).Error
	})
}

func grantKYCRewardTx(tx *gorm.DB, userID string, sourceID string, setting model.KYCSetting) error {
	if setting.RewardOnce {
		var count int64
		if err := tx.Model(&model.KYCVerification{}).Where("user_id = ? AND status = ? AND rewarded = ? AND id <> ?", userID, model.KYCStatusApproved, true, sourceID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}
	}
	user := model.User{}
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}
	user.Credits += setting.RewardCredits
	user.WorkflowCreateCredits += setting.RewardWorkflowCreateCredits
	user.UpdatedAt = now()
	if err := tx.Save(&user).Error; err != nil {
		return err
	}
	return createEntitlementLogTx(tx, model.EntitlementLog{
		ID:                         newID("entitle"),
		UserID:                     user.ID,
		Source:                     model.EntitlementLogKYCReward,
		SourceID:                   sourceID,
		CreditsDelta:               setting.RewardCredits,
		WorkflowCreateCreditsDelta: setting.RewardWorkflowCreateCredits,
		CreditsAfter:               user.Credits,
		WorkflowCreateCreditsAfter: user.WorkflowCreateCredits,
		Remark:                     "Didit KYC 认证奖励",
		CreatedAt:                  now(),
	})
}

func validDiditSignature(r *http.Request, body []byte, secret string) bool {
	signature := firstNonEmpty(r.Header.Get("X-Signature-V2"), r.Header.Get("X-Signature"), r.Header.Get("Didit-Signature"))
	if signature == "" {
		return false
	}
	candidates := []string{
		hmacSHA256Hex(secret, body),
		hmacSHA256Hex(secret, []byte(string(body)+secret)),
		hmacSHA256Hex(secret, []byte(secret+string(body))),
	}
	for _, candidate := range candidates {
		if hmac.Equal([]byte(strings.TrimSpace(signature)), []byte(candidate)) {
			return true
		}
	}
	return false
}

func normalizeKYCStatus(status string) model.KYCStatus {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "approved", "approve", "accepted", "success", "verified":
		return model.KYCStatusApproved
	case "rejected", "declined", "failed":
		return model.KYCStatusRejected
	case "expired":
		return model.KYCStatusExpired
	default:
		return model.KYCStatusPending
	}
}
