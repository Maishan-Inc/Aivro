package handler

import (
	"net/http"

	"github.com/basketikun/aivro/service"
)

func GenerationTasks(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ListGenerationTasks(user)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func GenerationTask(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetGenerationTask(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func GenerationTaskResult(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetGenerationTaskResult(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	writeAIProxyResponse(w, result)
}

func CancelGenerationTask(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.CancelGenerationTask(user, id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
