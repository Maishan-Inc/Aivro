package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const maxAIRequestBytes = 80 << 20

type AIProxyResponse struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

// GenerationTaskResultStream 是任务结果的流式视图，由调用方负责关闭 Content。
type GenerationTaskResultStream struct {
	StatusCode int
	Header     http.Header
	Content    io.ReadCloser
}

type AIProxyExecutor func(ctx context.Context, user model.AuthUser, body io.Reader, contentType string, modelName string, path string) (AIProxyResponse, error)

var (
	queueMu       sync.Mutex
	proxyExecutor AIProxyExecutor
)

func RegisterAIProxyExecutor(executor AIProxyExecutor) {
	proxyExecutor = executor
}

func AIQueueEnabled() bool {
	settings, err := repository.GetSettings()
	if err != nil {
		log.Printf("read AI queue setting failed: %v", err)
		return true
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	return queue.Enabled != nil && *queue.Enabled
}

func SubmitAITask(ctx context.Context, user model.AuthUser, body []byte, contentType string, modelName string, path string, meta RequestLogMeta) (model.GenerationTaskSubmitResult, *AIProxyResponse, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	credits, err := ModelCost(modelName)
	if err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	requestCount := ReadAIRequestCount(body, contentType)
	credits *= requestCount

	requestFile, err := StoreTaskPayload(ctx, user, "request-"+newID("file")+".bin", body, contentType, path)
	if err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queueMu.Lock()
	if *queue.Enabled {
		if count, err := repository.CountQueuedUserTasks(user.ID); err != nil {
			queueMu.Unlock()
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, err
		} else if int(count) >= queue.MaxQueuedPerUser {
			queueMu.Unlock()
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, safeMessageError{message: "排队任务过多，请稍后再试"}
		}
	}
	if err := ConsumeUserCreditsWithMeta(user.ID, modelName, credits, path, meta); err != nil {
		queueMu.Unlock()
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	now := time.Now().Format(time.RFC3339)
	task := model.GenerationTask{
		ID:            newID("task"),
		UserID:        user.ID,
		Username:      user.Username,
		Model:         modelName,
		Path:          path,
		ContentType:   contentType,
		RequestFileID: requestFile.File.ID,
		Credits:       credits,
		RequestCount:  requestCount,
		Status:        model.GenerationTaskQueued,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	canRun, err := canDispatchModel(modelName, queue)
	if err != nil {
		queueMu.Unlock()
		_ = RefundUserCredits(user.ID, modelName, credits, path)
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	if !*queue.Enabled || canRun {
		task.Status = model.GenerationTaskExecuting
		task.StartedAt = now
		saved, err := repository.SaveGenerationTask(task)
		queueMu.Unlock()
		if err != nil {
			_ = RefundUserCredits(user.ID, modelName, credits, path)
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, err
		}
		resp, execErr := executeTask(ctx, user, saved)
		if execErr != nil {
			return model.GenerationTaskSubmitResult{}, nil, execErr
		}
		return model.GenerationTaskSubmitResult{}, &resp, nil
	}
	position, err := nextQueuePosition(modelName)
	if err != nil {
		queueMu.Unlock()
		_ = RefundUserCredits(user.ID, modelName, credits, path)
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	task.QueuePosition = position
	if _, err := repository.SaveGenerationTask(task); err != nil {
		queueMu.Unlock()
		_ = RefundUserCredits(user.ID, modelName, credits, path)
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queueMu.Unlock()
	return model.GenerationTaskSubmitResult{Queued: true, TaskID: task.ID, Status: string(task.Status), QueuePosition: position, AheadCount: position - 1, Model: modelName, Path: path}, nil, nil
}

func GetGenerationTask(user model.AuthUser, id string) (model.GenerationTaskView, error) {
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil {
		return model.GenerationTaskView{}, err
	}
	if !ok || task.UserID != user.ID {
		return model.GenerationTaskView{}, safeMessageError{message: "任务不存在或无权限访问"}
	}
	return generationTaskView(task), nil
}

func ListGenerationTasks(user model.AuthUser) ([]model.GenerationTaskView, error) {
	items, err := repository.ListUserGenerationTasks(user.ID, 50)
	if err != nil {
		return nil, err
	}
	result := make([]model.GenerationTaskView, 0, len(items))
	for _, item := range items {
		result = append(result, generationTaskView(item))
	}
	return result, nil
}

func GetGenerationTaskResult(user model.AuthUser, id string) (GenerationTaskResultStream, error) {
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil {
		return GenerationTaskResultStream{}, err
	}
	if !ok || task.UserID != user.ID {
		return GenerationTaskResultStream{}, safeMessageError{message: "任务不存在或无权限访问"}
	}
	if task.Status != model.GenerationTaskSucceeded || task.ResponseFileID == "" {
		return GenerationTaskResultStream{}, safeMessageError{message: "任务结果尚未生成"}
	}
	header := http.Header{}
	_ = json.Unmarshal([]byte(task.ResponseHeader), &header)
	_, content, err := GetFileContent(user, task.ResponseFileID, "")
	if err != nil {
		return GenerationTaskResultStream{}, err
	}
	return GenerationTaskResultStream{StatusCode: task.ResponseStatus, Header: header, Content: content}, nil
}

func CancelGenerationTask(user model.AuthUser, id string) error {
	queueMu.Lock()
	defer queueMu.Unlock()
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil {
		return err
	}
	if !ok || task.UserID != user.ID {
		return safeMessageError{message: "任务不存在或无权限访问"}
	}
	if task.Status != model.GenerationTaskQueued {
		return safeMessageError{message: "只能撤销排队中的任务"}
	}
	now := time.Now().Format(time.RFC3339)
	if err := RefundUserCredits(user.ID, task.Model, task.Credits, task.Path); err != nil {
		return err
	}
	if err := repository.UpdateGenerationTaskStatus(task.ID, model.GenerationTaskCanceled, map[string]any{"canceled_at": now, "finished_at": now, "error": "用户已撤销", "queue_position": 0}); err != nil {
		log.Printf("generation task mark canceled failed after refund: task=%s err=%v", task.ID, err)
		return err
	}
	if err := deleteTaskPayload(task.RequestFileID); err != nil {
		log.Printf("generation task request payload delete failed after cancel: task=%s err=%v", task.ID, err)
	}
	return repository.RecalculateGenerationTaskPositions(task.Model)
}

func StartGenerationQueueScheduler() {
	if proxyExecutor == nil {
		log.Printf("generation queue scheduler skipped: AI proxy executor not registered")
		return
	}
	go func() {
		_ = recoverExecutingTasks()
		ticker := time.NewTicker(time.Second)
		cleanupTicker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		defer cleanupTicker.Stop()
		for range ticker.C {
			if err := dispatchQueuedTasks(); err != nil {
				log.Printf("generation queue dispatch failed: %v", err)
			}
			select {
			case <-cleanupTicker.C:
				_ = cleanupOldGenerationTasks()
			default:
			}
		}
	}()
}

func dispatchQueuedTasks() error {
	queueMu.Lock()
	defer queueMu.Unlock()
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	if queue.Enabled == nil || !*queue.Enabled {
		return nil
	}
	models, err := repository.ListQueuedModels()
	if err != nil {
		return err
	}
	for _, modelName := range models {
		remaining, err := remainingCapacity(modelName, queue)
		if err != nil || remaining <= 0 {
			if err != nil {
				return err
			}
			continue
		}
		items, err := repository.ListQueuedGenerationTasks(modelName, remaining)
		if err != nil {
			return err
		}
		for _, task := range items {
			startedAt := time.Now().Format(time.RFC3339)
			changed, err := repository.MarkQueuedTaskExecuting(task.ID, startedAt)
			if err != nil {
				return err
			}
			if !changed {
				continue
			}
			task.Status = model.GenerationTaskExecuting
			task.StartedAt = startedAt
			task.QueuePosition = 0
			go func(item model.GenerationTask) {
				user := model.AuthUser{ID: item.UserID, Username: item.Username}
				if _, err := executeTask(context.Background(), user, item); err != nil {
					log.Printf("queued AI task failed: id=%s err=%v", item.ID, err)
				}
			}(task)
		}
		if err := repository.RecalculateGenerationTaskPositions(modelName); err != nil {
			return err
		}
	}
	return nil
}

func executeTask(ctx context.Context, user model.AuthUser, task model.GenerationTask) (AIProxyResponse, error) {
	if proxyExecutor == nil {
		return failExecutingTask(task, "AI 执行器未初始化")
	}
	if strings.TrimSpace(task.RequestFileID) == "" {
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	file, content, err := GetFileContent(user, task.RequestFileID, "")
	if err != nil {
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	if file.FileType != model.CloudFileTypeTask {
		_ = content.Close()
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	resp, err := proxyExecutor(ctx, user, content, task.ContentType, task.Model, task.Path)
	_ = content.Close()
	now := time.Now().Format(time.RFC3339)
	if err != nil {
		return failExecutingTask(task, "AI 接口请求失败")
	}
	headerJSON, _ := json.Marshal(resp.Header)
	responseFile, err := StoreTaskPayload(ctx, user, "response-"+newID("file")+".bin", resp.Body, firstNonEmpty(resp.Header.Get("Content-Type"), "application/octet-stream"), task.Path)
	if err != nil {
		log.Printf("generation task persist response payload failed: task=%s err=%v", task.ID, err)
		return failExecutingTask(task, "AI 结果保存失败")
	}
	fields := map[string]any{"response_status": resp.StatusCode, "response_header": string(headerJSON), "response_file_id": responseFile.File.ID, "finished_at": now}
	if err := repository.UpdateGenerationTaskStatus(task.ID, model.GenerationTaskSucceeded, fields); err != nil {
		log.Printf("generation task persist succeeded response failed: task=%s err=%v", task.ID, err)
	}
	return resp, nil
}

func failExecutingTask(task model.GenerationTask, message string) (AIProxyResponse, error) {
	now := time.Now().Format(time.RFC3339)
	if updateErr := repository.UpdateGenerationTaskStatus(task.ID, model.GenerationTaskFailed, map[string]any{"error": message, "finished_at": now}); updateErr != nil {
		log.Printf("generation task mark failed failed before refund: task=%s err=%v", task.ID, updateErr)
		return AIProxyResponse{}, safeMessageError{message: message}
	}
	if refundErr := RefundUserCredits(task.UserID, task.Model, task.Credits, task.Path); refundErr != nil {
		log.Printf("generation task refund failed: task=%s err=%v", task.ID, refundErr)
	}
	return AIProxyResponse{}, safeMessageError{message: message}
}

func recoverExecutingTasks() error {
	items, err := repository.MarkExecutingTasksFailed("服务重启，任务已中断")
	if err != nil {
		return err
	}
	for _, item := range items {
		if err := RefundUserCredits(item.UserID, item.Model, item.Credits, item.Path); err != nil {
			log.Printf("generation task startup refund failed: task=%s err=%v", item.ID, err)
		}
	}
	return nil
}

func cleanupOldGenerationTasks() error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	before := time.Now().Add(-time.Duration(queue.TaskRetentionHours) * time.Hour).Format(time.RFC3339)
	tasks, err := repository.ListOldGenerationTasks(before, 100)
	if err != nil {
		return err
	}
	for _, task := range tasks {
		ids := []string{}
		if task.RequestFileID != "" {
			ids = append(ids, task.RequestFileID)
		}
		if task.ResponseFileID != "" {
			ids = append(ids, task.ResponseFileID)
		}
		if len(ids) > 0 {
			files, err := repository.ListCloudFilesByIDs(ids)
			if err != nil {
				return err
			}
			if err := DeleteCloudFiles(files); err != nil {
				return err
			}
		}
		if err := repository.DeleteGenerationTask(task.ID); err != nil {
			return err
		}
	}
	return nil
}

func generationTaskView(task model.GenerationTask) model.GenerationTaskView {
	ahead := 0
	if task.Status == model.GenerationTaskQueued && task.QueuePosition > 0 {
		ahead = task.QueuePosition - 1
	}
	return model.GenerationTaskView{ID: task.ID, Model: task.Model, Path: task.Path, Status: string(task.Status), QueuePosition: task.QueuePosition, AheadCount: ahead, Credits: task.Credits, Error: task.Error, CreatedAt: task.CreatedAt, StartedAt: task.StartedAt, FinishedAt: task.FinishedAt, ResultAvailable: task.Status == model.GenerationTaskSucceeded && task.ResponseFileID != "", ResponseStatus: task.ResponseStatus}
}

func canDispatchModel(modelName string, queue model.AIQueueSetting) (bool, error) {
	remaining, err := remainingCapacity(modelName, queue)
	return remaining > 0, err
}

func remainingCapacity(modelName string, queue model.AIQueueSetting) (int, error) {
	limit := modelRateLimit(modelName, queue)
	if limit <= 0 {
		return 0, nil
	}
	count, err := repository.CountDispatchedGenerationTasks(modelName, minuteWindowStart())
	if err != nil {
		return 0, err
	}
	return limit - int(count), nil
}

func modelRateLimit(modelName string, queue model.AIQueueSetting) int {
	for _, item := range queue.ModelPerMinute {
		if item.Model == modelName && item.PerMinute > 0 {
			return item.PerMinute
		}
	}
	return queue.DefaultPerMinute
}

func minuteWindowStart() string {
	return time.Now().Truncate(time.Minute).Format(time.RFC3339)
}

func nextQueuePosition(modelName string) (int, error) {
	count, err := repository.CountQueuedModelTasks(modelName)
	return int(count) + 1, err
}

func ReadAIRequest(body io.Reader, contentType string) ([]byte, string, error) {
	payload, err := readLimited(body, maxAIRequestBytes, "AI 请求内容过大")
	if err != nil {
		return nil, "", err
	}
	modelName := ""
	if strings.HasPrefix(contentType, "multipart/form-data") {
		modelName = readMultipartValue(payload, contentType, "model")
	} else {
		var data struct {
			Model string `json:"model"`
		}
		_ = json.Unmarshal(payload, &data)
		modelName = data.Model
	}
	if strings.TrimSpace(modelName) == "" {
		return nil, "", safeMessageError{message: "缺少模型名称"}
	}
	return payload, strings.TrimSpace(modelName), nil
}

func RewriteAIRequestModel(body []byte, contentType string, modelName string) ([]byte, string, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return body, contentType, nil
	}
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return rewriteMultipartModel(body, contentType, modelName)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, contentType, err
	}
	payload["model"] = modelName
	next, err := json.Marshal(payload)
	if err != nil {
		return nil, contentType, err
	}
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/json"
	}
	return next, contentType, nil
}

func rewriteMultipartModel(body []byte, contentType string, modelName string) ([]byte, string, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, contentType, err
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
	if err != nil {
		return nil, contentType, err
	}
	defer form.RemoveAll()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	wroteModel := false
	for key, values := range form.Value {
		for _, value := range values {
			if key == "model" {
				value = modelName
				wroteModel = true
			}
			if err := writer.WriteField(key, value); err != nil {
				return nil, contentType, err
			}
		}
	}
	if !wroteModel {
		if err := writer.WriteField("model", modelName); err != nil {
			return nil, contentType, err
		}
	}
	for key, files := range form.File {
		for _, fileHeader := range files {
			src, err := fileHeader.Open()
			if err != nil {
				return nil, contentType, err
			}
			part, err := writer.CreateFormFile(key, fileHeader.Filename)
			if err == nil {
				_, err = io.Copy(part, src)
			}
			_ = src.Close()
			if err != nil {
				return nil, contentType, err
			}
		}
	}
	if err := writer.Close(); err != nil {
		return nil, contentType, err
	}
	return buffer.Bytes(), writer.FormDataContentType(), nil
}

func ReadAIRequestCount(body []byte, contentType string) int {
	count := 1
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if value := readMultipartValue(body, contentType, "n"); value != "" {
			_, _ = fmt.Sscan(value, &count)
		}
	} else {
		var payload struct {
			N int `json:"n"`
		}
		_ = json.Unmarshal(body, &payload)
		count = payload.N
	}
	if count < 1 {
		return 1
	}
	return count
}

func readMultipartValue(body []byte, contentType string, key string) string {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return ""
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
	if err != nil {
		return ""
	}
	defer form.RemoveAll()
	if values := form.Value[key]; len(values) > 0 {
		return values[0]
	}
	return ""
}

func StoreTaskPayload(ctx context.Context, user model.AuthUser, filename string, body []byte, contentType string, source string) (CloudObjectResult, error) {
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	return storeObject(ctx, CloudObjectUpload{
		User:        user,
		FileType:    model.CloudFileTypeTask,
		Purpose:     model.CloudFilePurposeTemp,
		Filename:    sanitizeFilename(strings.TrimSuffix(filename, filepath.Ext(filename))) + filepath.Ext(filename),
		ContentType: contentType,
		Source:      source,
		Body:        body,
		ExpiresAt:   taskPayloadExpiresAt(),
	})
}

func deleteTaskPayload(fileID string) error {
	if strings.TrimSpace(fileID) == "" {
		return nil
	}
	files, err := repository.ListCloudFilesByIDs([]string{fileID})
	if err != nil {
		return err
	}
	return DeleteCloudFiles(files)
}

func taskPayloadExpiresAt() string {
	settings, err := repository.GetSettings()
	if err != nil {
		return time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	return time.Now().Add(time.Duration(queue.TaskRetentionHours) * time.Hour).Format(time.RFC3339)
}
