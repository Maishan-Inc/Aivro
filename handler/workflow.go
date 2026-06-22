package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func Workflows(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ListWorkflows(user.ID, parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func Workflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetWorkflow(user.ID, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CreateWorkflow(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.SaveWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.CreateWorkflow(user.ID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func UpdateWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.SaveWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.UpdateWorkflow(user.ID, id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DeleteWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.DeleteWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	if err := service.DeleteWorkflowWithInput(user.ID, id, input); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func ShareWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.ShareWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.ShareWorkflow(r, user.ID, id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func WorkflowActiveShare(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetWorkflowActiveShare(r, user.ID, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func WorkflowShare(w http.ResponseWriter, r *http.Request, token string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetWorkflowSharePreview(user.ID, token, r.URL.Query().Get("shareAccessToken"))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func VerifyWorkflowShare(w http.ResponseWriter, r *http.Request, token string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input struct {
		Password string `json:"password"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.VerifyWorkflowShare(user.ID, token, input.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CopyWorkflowShare(w http.ResponseWriter, r *http.Request, token string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CopyWorkflowShareInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.CopyWorkflowShare(user.ID, token, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func WorkflowShareByPath(w http.ResponseWriter, r *http.Request, username string, slug string) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.GetWorkflowSharePreviewByPath(username, slug, user.ID, r.URL.Query().Get("shareAccessToken"))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func VerifyWorkflowShareByPath(w http.ResponseWriter, r *http.Request, username string, slug string) {
	user, _ := service.UserFromContext(r.Context())
	var input struct {
		Password string `json:"password"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.VerifyWorkflowShareByPath(user.ID, username, slug, input.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CopyWorkflowShareByPath(w http.ResponseWriter, r *http.Request, username string, slug string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CopyWorkflowShareInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.CopyWorkflowShareByPath(user.ID, username, slug, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func ToggleWorkflowShareStar(w http.ResponseWriter, r *http.Request, username string, slug string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ToggleWorkflowShareStar(user.ID, username, slug)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func RevokeWorkflowShare(w http.ResponseWriter, r *http.Request, token string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.RevokeWorkflowShare(user.ID, token); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func CommunityWorkflows(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListCommunityWorkflows(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func MyCommunityWorkflows(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ListMyCommunityWorkflows(user.ID, parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func PublishCommunityWorkflow(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.PublishCommunityWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.PublishCommunityWorkflow(user.ID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func SyncCommunityWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.SyncCommunityWorkflowInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.SyncCommunityWorkflow(user.ID, id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DeleteCommunityWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.DeleteCommunityWorkflow(user.ID, id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func CommunityWorkflow(w http.ResponseWriter, r *http.Request, token string) {
	result, err := service.GetCommunityWorkflowPreview(token)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func Plans(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListPlans(false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminPlans(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListPlans(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSavePlan(w http.ResponseWriter, r *http.Request) {
	var input model.Plan
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.SavePlan(input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func StripeCheckout(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CheckoutInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.CreateStripeCheckout(r, user.ID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func StripeWebhook(w http.ResponseWriter, r *http.Request) {
	if err := service.HandleStripeWebhook(r); err != nil {
		if service.IsWebhookSignatureError(err) {
			writeWebhookError(w, http.StatusBadRequest, err)
		} else {
			writeWebhookError(w, http.StatusInternalServerError, err)
		}
		return
	}
	OK(w, true)
}

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

func KYCStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.KYCStatusForUser(user.ID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DiditWebhook(w http.ResponseWriter, r *http.Request) {
	if err := service.HandleDiditWebhook(r); err != nil {
		if service.IsWebhookSignatureError(err) {
			writeWebhookError(w, http.StatusBadRequest, err)
		} else {
			writeWebhookError(w, http.StatusInternalServerError, err)
		}
		return
	}
	OK(w, true)
}

func writeWebhookError(w http.ResponseWriter, status int, err error) {
	log.Printf("webhook failed: %v", err)
	msg := "操作失败"
	if safe, ok := err.(interface{ SafeMessage() string }); ok {
		msg = safe.SafeMessage()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response{Code: 1, Data: nil, Msg: msg})
}
