package handler

import (
	"io"
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
	result, err := service.GetGenerationTaskResult(r.Context(), user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	defer result.Content.Close()
	copyResponseHeaders(w, result.Header)
	if result.StatusCode > 0 {
		w.WriteHeader(result.StatusCode)
	}
	_, _ = io.Copy(w, result.Content)
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
