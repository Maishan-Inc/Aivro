package handler

import (
	"net/http"

	"github.com/basketikun/aivro/service"
)

func Prompts(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListPublicPrompts(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
	w.Header().Set("CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
	w.Header().Set("Surrogate-Control", "max-age=300, stale-while-revalidate=600")
	OK(w, result)
}
