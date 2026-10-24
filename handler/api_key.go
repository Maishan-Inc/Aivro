package handler

import (
	"github.com/basketikun/aivro/service"
	"net/http"
)

func UserAPIKeys(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.ListUserAPIKeys(user, parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CreateUserAPIKey(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	var input struct {
		Name string `json:"name"`
	}
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.CreateUserAPIKey(user, input.Name)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func RevokeUserAPIKey(w http.ResponseWriter, r *http.Request, id string) {
	user, _ := service.UserFromContext(r.Context())
	if err := service.RevokeUserAPIKey(user, id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func APIModels(w http.ResponseWriter, r *http.Request) {
	items, err := service.ListAPIModels()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, items)
}
