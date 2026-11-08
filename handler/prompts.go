package handler

import (
	"net/http"

	"github.com/basketikun/aivro/service"
)

func Prompts(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListPublicPrompts(r.Context(), parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
