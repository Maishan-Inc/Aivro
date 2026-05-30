package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

type adminChannelActionRequest struct {
	Index   *int               `json:"index"`
	Channel model.ModelChannel `json:"channel"`
	Model   string             `json:"model"`
}

type adminCloudStorageTestRequest struct {
	Setting model.CloudStorageSetting `json:"setting"`
}

type adminMailTestRequest struct {
	Setting model.MailSetting `json:"setting"`
	Email   string            `json:"email"`
}

func Settings(w http.ResponseWriter, r *http.Request) {
	settings, err := service.PublicSettings()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, settings)
}

func AdminSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := service.AdminSettings()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, settings)
}

func AdminSaveSettings(w http.ResponseWriter, r *http.Request) {
	var settings model.Settings
	_ = json.NewDecoder(r.Body).Decode(&settings)
	result, err := service.SaveSettings(settings)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminUpdateDatabase(w http.ResponseWriter, r *http.Request) {
	if err := service.AdminUpdateDatabase(); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminDatabaseStatus(w http.ResponseWriter, r *http.Request) {
	status, err := service.AdminDatabaseStatus()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, status)
}

func AdminChannelModels(w http.ResponseWriter, r *http.Request) {
	var request adminChannelActionRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	models, err := service.AdminChannelModels(request.Index, request.Channel)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, models)
}

func AdminTestChannelModel(w http.ResponseWriter, r *http.Request) {
	var request adminChannelActionRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	result, err := service.AdminTestChannelModel(request.Index, request.Channel, request.Model)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminTestCloudStorage(w http.ResponseWriter, r *http.Request) {
	var request adminCloudStorageTestRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	result, err := service.AdminTestCloudStorage(request.Setting)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminTestMail(w http.ResponseWriter, r *http.Request) {
	var request adminMailTestRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.AdminTestMail(request.Setting, request.Email, service.MailTemplateContextFromRequest(r)); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
