package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func AdminExploreSettings(w http.ResponseWriter, r *http.Request) {
	result, err := service.AdminExploreSettings()
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminSaveExploreSettings(w http.ResponseWriter, r *http.Request) {
	var input service.ExploreSettings
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 50000)).Decode(&input) != nil { Fail(w, "请求参数错误"); return }
	result, err := service.SaveExploreSettings(input)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminFreeImageCampaigns(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListFreeImageCampaigns(parseQuery(r))
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminSaveFreeImageCampaign(w http.ResponseWriter, r *http.Request) {
	var input model.FreeImageCampaign
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 50000)).Decode(&input) != nil { Fail(w, "请求参数错误"); return }
	result, err := service.SaveFreeImageCampaign(input)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func FreeImageState(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.FreeImageState(user)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func FreeImageGeneration(w http.ResponseWriter, r *http.Request) {
	ensureAIProxyExecutor()
	var input service.FreeImageInput
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 50000)).Decode(&input) != nil { Fail(w, "请求参数错误"); return }
	user, _ := service.UserFromContext(r.Context())
	result, err := service.SubmitFreeImage(r.Context(), user, input, service.RequestLogMetaFromRequest(r))
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func PromptReverse(w http.ResponseWriter, r *http.Request) {
	var input service.PromptReverseInput
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&input) != nil { Fail(w, "请求参数错误"); return }
	user, _ := service.UserFromContext(r.Context())
	result, err := service.ReverseImagePrompt(r.Context(), user, input, service.RequestLogMetaFromRequest(r))
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminFreeImageHistories(w http.ResponseWriter, r *http.Request) {
	result, err := service.AdminFreeImageHistories(parseQuery(r))
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminPublishFreeImage(w http.ResponseWriter, r *http.Request) {
	var input service.FreeImagePublicationInput
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 50000)).Decode(&input) != nil { Fail(w, "请求参数错误"); return }
	user, _ := service.UserFromContext(r.Context())
	result, err := service.PublishFreeImage(r.Context(), user, input)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}
