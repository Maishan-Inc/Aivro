package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/aivro/service"
)

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
	_ = json.NewDecoder(r.Body).Decode(&input)
	result, err := service.SendCanvasAssistantMessage(r.Context(), user.ID, workflowID, input)
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
