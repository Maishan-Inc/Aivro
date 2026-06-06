package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/basketikun/aivro/model"
)

type response struct {
	Code int    `json:"code"`
	Data any    `json:"data"`
	Msg  string `json:"msg"`
}

func OK(w http.ResponseWriter, data any) {
	writeJSON(w, response{Code: 0, Data: data, Msg: "ok"})
}

func Fail(w http.ResponseWriter, msg string) {
	writeJSON(w, response{Code: 1, Data: nil, Msg: msg})
}

func FailError(w http.ResponseWriter, err error) {
	log.Printf("request failed: %v", err)
	if safe, ok := err.(interface{ SafeMessage() string }); ok {
		Fail(w, safe.SafeMessage())
		return
	}
	if msg := databaseErrorMessage(err); msg != "" {
		Fail(w, msg)
		return
	}
	Fail(w, "操作失败")
}

func databaseErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	text := strings.ToLower(err.Error())
	if strings.Contains(text, "no such table") || strings.Contains(text, "doesn't exist") || strings.Contains(text, "does not exist") && strings.Contains(text, "relation") {
		return "数据库表不存在，请在后台数据库页面执行更新"
	}
	if strings.Contains(text, "no such column") || strings.Contains(text, "unknown column") || strings.Contains(text, "column") && strings.Contains(text, "does not exist") {
		return "数据库字段不存在，请在后台数据库页面执行更新"
	}
	if strings.Contains(text, "readonly") || strings.Contains(text, "read-only") || strings.Contains(text, "permission denied") || strings.Contains(text, "access denied") {
		return "数据库写入失败，请检查数据库连接和权限"
	}
	if strings.Contains(text, "duplicate") || strings.Contains(text, "unique constraint") || strings.Contains(text, "duplicate key") {
		return "数据已存在，请检查唯一字段"
	}
	return ""
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate")
	w.Header().Set("CDN-Cache-Control", "no-store")
	w.Header().Set("Surrogate-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	_ = json.NewEncoder(w).Encode(value)
}

func parseQuery(r *http.Request) model.Query {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	return model.Query{
		Keyword:  q.Get("keyword"),
		Tags:     q["tag"],
		Category: q.Get("category"),
		Type:     q.Get("type"),
		Page:     page,
		PageSize: pageSize,
	}
}

func BindJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
