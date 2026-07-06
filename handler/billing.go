package handler

import (
	"net/http"

	"github.com/basketikun/aivro/service"
)

func CreditLogs(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	result, err := service.ListUserCreditLogs(user, parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
