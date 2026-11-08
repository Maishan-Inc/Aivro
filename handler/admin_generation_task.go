package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func AdminGenerationTasks(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAdminGenerationTasks(parseQuery(r))
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminGenerationTask(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.GetAdminGenerationTask(id)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminGenerationTaskFile(w http.ResponseWriter, r *http.Request, id string, fileID string) {
	file, content, err := service.GetAdminGenerationTaskFile(r.Context(), id, fileID)
	if err != nil { FailError(w, err); return }
	defer content.Close()
	w.Header().Set("Content-Type", file.ContentType)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = io.Copy(w, content)
}

func AdminGenerationRetention(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListGenerationRetentionPolicies()
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminSaveGenerationRetention(w http.ResponseWriter, r *http.Request) {
	var input model.GenerationRetentionPolicy
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil { Fail(w, "保存天数无效"); return }
	result, err := service.SaveGenerationRetentionPolicy(input)
	if err != nil { FailError(w, err); return }
	actor, _ := service.UserFromContext(r.Context())
	extra, _ := json.Marshal(result)
	meta := service.RequestLogMetaFromRequest(r)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionConfigUpdate, ActorID: actor.ID, ActorUsername: actor.Username, TargetType: "generation_retention", TargetID: input.Group, Remark: "修改生成记录保存规则", Extra: string(extra), IP: meta.IP, Country: meta.Country})
	OK(w, result)
}

func UserGenerationRetention(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.UserGenerationRetention(user.ID)
	if err != nil { FailError(w, err); return }
	OK(w, result)
}

func AdminSaveUserGenerationRetention(w http.ResponseWriter, r *http.Request, id string) {
	var input model.GenerationRetention
	if json.NewDecoder(r.Body).Decode(&input) != nil { Fail(w, "保存天数无效"); return }
	result, err := service.SaveUserGenerationRetention(id, input)
	if err != nil { FailError(w, err); return }
	actor, _ := service.UserFromContext(r.Context())
	meta := service.RequestLogMetaFromRequest(r)
	extra, _ := json.Marshal(input)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionUserUpdate, ActorID: actor.ID, ActorUsername: actor.Username, TargetType: "user", TargetID: id, Remark: "修改生成记录保存规则", Extra: string(extra), IP: meta.IP, Country: meta.Country})
	OK(w, result)
}
