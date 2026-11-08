package handler

import (
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func SupportTickets(w http.ResponseWriter, r *http.Request, admin bool) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.ListSupportTickets(user, parseQuery(r), admin)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CreateSupportTicket(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	var input service.CreateSupportTicketInput
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.CreateSupportTicket(user, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func SupportTicket(w http.ResponseWriter, r *http.Request, id string, admin bool) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.GetSupportTicket(user, id, admin)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func ReplySupportTicket(w http.ResponseWriter, r *http.Request, id string, admin bool) {
	user, _ := service.UserFromContext(r.Context())
	var input struct {
		Content string `json:"content"`
	}
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	if err := service.ReplySupportTicket(user, id, input.Content, admin); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func SetSupportTicketStatus(w http.ResponseWriter, r *http.Request, id string, admin bool) {
	user, _ := service.UserFromContext(r.Context())
	var input struct {
		Status model.SupportTicketStatus `json:"status"`
	}
	if err := BindJSON(r, &input); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	if err := service.SetSupportTicketStatus(user, id, input.Status, admin); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
