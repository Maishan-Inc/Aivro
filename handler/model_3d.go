package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/aivro/service"
)

func AIModel3DGenerations(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var input service.Model3DGenerationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.CreateModel3DGeneration(r.Context(), user, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AIModel3DGeneration(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.GetModel3DGeneration(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
