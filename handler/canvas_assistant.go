package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/aivro/service"
)

const canvasAssistantRequestMaxBytes = 2 << 20

func CanvasAssistantSessions(w http.ResponseWriter, r *http.Request, workflowID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ListCanvasAssistantSessions(user.ID, workflowID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func SendCanvasAssistantMessage(w http.ResponseWriter, r *http.Request, workflowID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CanvasAssistantSendInput
	r.Body = http.MaxBytesReader(w, r.Body, canvasAssistantRequestMaxBytes)
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "请求参数无效或过大")
		return
	}
	result, err := service.SendCanvasAssistantMessage(r.Context(), user.ID, workflowID, input, service.RequestLogMetaFromRequest(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func PlanCanvasAgent(w http.ResponseWriter, r *http.Request, workflowID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.CanvasAgentPlanInput
	r.Body = http.MaxBytesReader(w, r.Body, canvasAssistantRequestMaxBytes)
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "请求参数无效或过大")
		return
	}
	result, err := service.PlanCanvasAgent(r.Context(), user.ID, workflowID, input, service.RequestLogMetaFromRequest(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DeleteCanvasAssistantSession(w http.ResponseWriter, r *http.Request, workflowID string, sessionID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.DeleteCanvasAssistantSession(user.ID, workflowID, sessionID); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func BatchDeleteCanvasAssistantSessions(w http.ResponseWriter, r *http.Request, workflowID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input struct {
		IDs []string `json:"ids"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	if err := service.BatchDeleteCanvasAssistantSessions(user.ID, workflowID, input.IDs); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
