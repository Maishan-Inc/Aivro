package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

type generationTaskContextKey struct{}

func parameterPrompt(parameters map[string]any) string {
	if prompt, ok := parameters["prompt"].(string); ok { return prompt }
	return ""
}

func checkGenerationTaskAccess(user model.AuthUser, task model.GenerationTask) error {
	if err := CheckSectionAccess(user, generationSection(task.Path)); err != nil { return err }
	return CheckSectionAccess(user, generationSource(task.Path, task.Section))
}

func ReadAIRequestParameters(body []byte, contentType string) (map[string]any, error) {
	parameters := map[string]any{}
	mediaType, params, err := mime.ParseMediaType(firstNonEmpty(contentType, "application/json"))
	if err != nil { return nil, err }
	if mediaType == "multipart/form-data" {
		reader := multipart.NewReader(bytes.NewReader(body), params["boundary"])
		for {
			part, err := reader.NextPart()
			if err == io.EOF { break }
			if err != nil { return nil, err }
			var value any
			if part.FileName() != "" {
				size, err := io.Copy(io.Discard, part)
				if err != nil { return nil, err }
				value = map[string]any{"filename": part.FileName(), "contentType": part.Header.Get("Content-Type"), "bytes": size}
			} else {
				text, err := io.ReadAll(part)
				if err != nil { return nil, err }
				value = string(text)
			}
			key := part.FormName()
			if previous, ok := parameters[key]; ok {
				if values, ok := previous.([]any); ok { parameters[key] = append(values, value) } else { parameters[key] = []any{previous, value} }
			} else { parameters[key] = value }
			_ = part.Close()
		}
	} else {
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.UseNumber()
		if err := decoder.Decode(&parameters); err != nil { return nil, err }
	}
	return summarizeParameterMedia(parameters).(map[string]any), nil
}

func summarizeParameterMedia(value any) any {
	switch item := value.(type) {
	case map[string]any:
		for key, value := range item { item[key] = summarizeParameterMedia(value) }
	case []any:
		for index, value := range item { item[index] = summarizeParameterMedia(value) }
	case string:
		if strings.HasPrefix(item, "data:") {
			if index := strings.Index(item, ";base64,"); index > 0 {
				return map[string]any{"contentType": item[5:index], "bytes": base64.RawStdEncoding.DecodedLen(len(strings.TrimRight(item[index+8:], "=")))}
			}
		}
	}
	return value
}

func ListAdminGenerationTasks(query model.Query) (map[string]any, error) {
	items, total, err := repository.ListAdminGenerationTasks(query)
	if err != nil { return nil, err }
	ids := make([]string, 0, len(items))
	for _, item := range items { ids = append(ids, item.UserID) }
	users, err := repository.ListUsersByIDs(uniqueStrings(ids))
	if err != nil { return nil, err }
	byID := map[string]*model.LogUser{}
	for _, user := range users { byID[user.ID] = &model.LogUser{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName, AvatarURL: user.AvatarURL} }
	for index := range items {
		items[index].User = byID[items[index].UserID]
	}
	return map[string]any{"items": items, "total": total}, nil
}

func GetAdminGenerationTask(id string) (model.GenerationTask, error) {
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil { return task, err }
	if !ok { return task, safeMessageError{message: "任务不存在"} }
	files, err := repository.ListGenerationTaskFiles(id)
	if err != nil { return task, err }
	task.Media = []model.GenerationHistoryMedia{}
	for _, file := range files {
		if file.DeletedAt != "" || (file.ExpiresAt != "" && file.ExpiresAt <= now()) { continue }
		task.Media = append(task.Media, model.GenerationHistoryMedia{CloudFileID: file.ID, StorageKey: "cloud:"+file.ID, URL: file.PublicURL, FileType: file.FileType, ContentType: file.ContentType, Size: file.Size, ExpiresAt: file.ExpiresAt})
	}
	return task, nil
}

func GetAdminGenerationTaskFile(ctx context.Context, taskID string, fileID string) (model.CloudFile, io.ReadCloser, error) {
	task, ok, err := repository.GetGenerationTask(taskID)
	if err != nil { return model.CloudFile{}, nil, err }
	if !ok || task.Status != model.GenerationTaskSucceeded { return model.CloudFile{}, nil, safeMessageError{message: "任务结果不可用"} }
	file, ok, err := repository.GetCloudFile(fileID)
	if err != nil { return file, nil, err }
	if !ok || file.GenerationTaskID != taskID || file.UserID != task.UserID { return file, nil, safeMessageError{message: "任务文件不存在"} }
	return GetFileContent(ctx, model.AuthUser{ID: task.UserID}, file.ID, "")
}

// RecordGenerationProviderProgress 保存供应商实际返回的状态和进度，不推算百分比。
func RecordGenerationProviderProgress(ctx context.Context, body []byte) {
	task, ok := ctx.Value(generationTaskContextKey{}).(model.GenerationTask)
	if !ok { return }
	var payload map[string]any
	if json.Unmarshal(body, &payload) != nil { return }
	fields := map[string]any{"updated_at": now()}
	var inspect func(map[string]any)
	inspect = func(item map[string]any) {
		for _, key := range []string{"task_id", "TaskId", "id", "request_id"} { if id, ok := item[key].(string); ok && id != "" { fields["provider_task_id"] = id; break } }
		for _, key := range []string{"progress", "Progress", "percentage", "task_progress"} {
			value := item[key]
			if text, ok := value.(string); ok {
				number, err := strconv.ParseFloat(strings.TrimSuffix(text, "%"), 64)
				if err != nil { continue }
				value = number
			}
			if number, ok := value.(float64); ok && number >= 0 && number <= 100 { fields["progress"] = int(number) }
		}
		for _, key := range []string{"status", "Status"} { if status, ok := item[key].(string); ok { fields["stage"] = status } }
		for _, key := range []string{"data", "Response", "result"} { if nested, ok := item[key].(map[string]any); ok { inspect(nested) } }
	}
	inspect(payload)
	_ = repository.UpdateGenerationTaskProgress(task, fields)
}

func RecordGenerationTaskDiagnostic(ctx context.Context, message string) {
	if task, ok := ctx.Value(generationTaskContextKey{}).(model.GenerationTask); ok { _ = repository.UpdateGenerationTaskProgress(task, map[string]any{"error_detail": message, "updated_at": now()}) }
}
