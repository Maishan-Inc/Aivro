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
	"strings"
	"sync"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

type AIProxyResponse struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

type AIProxyExecutor func(ctx context.Context, user model.AuthUser, body []byte, contentType string, modelName string, path string) (AIProxyResponse, error)

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

func SubmitAITask(ctx context.Context, user model.AuthUser, body []byte, contentType string, modelName string, path string) (model.GenerationTaskSubmitResult, *AIProxyResponse, error) {
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

	queueMu.Lock()
	if *queue.Enabled {
		if count, err := repository.CountQueuedUserTasks(user.ID); err != nil {
			queueMu.Unlock()
			return model.GenerationTaskSubmitResult{}, nil, err
		} else if int(count) >= queue.MaxQueuedPerUser {
			queueMu.Unlock()
			return model.GenerationTaskSubmitResult{}, nil, safeMessageError{message: "排队任务过多，请稍后再试"}
		}
	}
	if err := ConsumeUserCredits(user.ID, modelName, credits, path); err != nil {
		queueMu.Unlock()
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	now := time.Now().Format(time.RFC3339)
	task := model.GenerationTask{
		ID:           newID("task"),
		UserID:       user.ID,
		Username:     user.Username,
		Model:        modelName,
		Path:         path,
		ContentType:  contentType,
		RequestBody:  body,
		Credits:      credits,
		RequestCount: requestCount,
		Status:       model.GenerationTaskQueued,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	canRun, err := canDispatchModel(modelName, queue)
	if err != nil {
		queueMu.Unlock()
		_ = RefundUserCredits(user.ID, modelName, credits, path)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	if !*queue.Enabled || canRun {
		task.Status = model.GenerationTaskExecuting
		task.StartedAt = now
		saved, err := repository.SaveGenerationTask(task)
		queueMu.Unlock()
		if err != nil {
			_ = RefundUserCredits(user.ID, modelName, credits, path)
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
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	task.QueuePosition = position
	if _, err := repository.SaveGenerationTask(task); err != nil {
		queueMu.Unlock()
		_ = RefundUserCredits(user.ID, modelName, credits, path)
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

func GetGenerationTaskResult(user model.AuthUser, id string) (AIProxyResponse, error) {
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil {
		return AIProxyResponse{}, err
	}
	if !ok || task.UserID != user.ID {
		return AIProxyResponse{}, safeMessageError{message: "任务不存在或无权限访问"}
	}
	if task.Status != model.GenerationTaskSucceeded || len(task.ResponseBody) == 0 {
		return AIProxyResponse{}, safeMessageError{message: "任务结果尚未生成"}
	}
	header := http.Header{}
	_ = json.Unmarshal([]byte(task.ResponseHeader), &header)
	return AIProxyResponse{StatusCode: task.ResponseStatus, Header: header, Body: task.ResponseBody}, nil
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
		defer ticker.Stop()
		for range ticker.C {
			if err := dispatchQueuedTasks(); err != nil {
				log.Printf("generation queue dispatch failed: %v", err)
			}
			_ = cleanupOldGenerationTasks()
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
		return AIProxyResponse{}, safeMessageError{message: "AI 执行器未初始化"}
	}
	resp, err := proxyExecutor(ctx, user, task.RequestBody, task.ContentType, task.Model, task.Path)
	now := time.Now().Format(time.RFC3339)
	if err != nil {
		message := "AI 接口请求失败"
		if updateErr := repository.UpdateGenerationTaskStatus(task.ID, model.GenerationTaskFailed, map[string]any{"error": message, "finished_at": now}); updateErr != nil {
			log.Printf("generation task mark failed failed before refund: task=%s err=%v", task.ID, updateErr)
			return AIProxyResponse{}, safeMessageError{message: message}
		}
		if refundErr := RefundUserCredits(task.UserID, task.Model, task.Credits, task.Path); refundErr != nil {
			log.Printf("generation task refund failed: task=%s err=%v", task.ID, refundErr)
		}
		return AIProxyResponse{}, safeMessageError{message: message}
	}
	headerJSON, _ := json.Marshal(resp.Header)
	if err := repository.UpdateGenerationTaskStatus(task.ID, model.GenerationTaskSucceeded, map[string]any{"response_status": resp.StatusCode, "response_header": string(headerJSON), "response_body": resp.Body, "finished_at": now}); err != nil {
		log.Printf("generation task persist succeeded response failed: task=%s err=%v", task.ID, err)
	}
	return resp, nil
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
	return repository.DeleteOldGenerationTasks(before)
}

func generationTaskView(task model.GenerationTask) model.GenerationTaskView {
	ahead := 0
	if task.Status == model.GenerationTaskQueued && task.QueuePosition > 0 {
		ahead = task.QueuePosition - 1
	}
	return model.GenerationTaskView{ID: task.ID, Model: task.Model, Path: task.Path, Status: string(task.Status), QueuePosition: task.QueuePosition, AheadCount: ahead, Credits: task.Credits, Error: task.Error, CreatedAt: task.CreatedAt, StartedAt: task.StartedAt, FinishedAt: task.FinishedAt, ResultAvailable: task.Status == model.GenerationTaskSucceeded && len(task.ResponseBody) > 0, ResponseStatus: task.ResponseStatus}
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
	items, err := repository.ListQueuedGenerationTasks(modelName, 100000)
	if err != nil {
		return 0, err
	}
	return len(items) + 1, nil
}

func ReadAIRequest(body io.Reader, contentType string) ([]byte, string, error) {
	payload, err := io.ReadAll(body)
	if err != nil {
		return nil, "", err
	}
	modelName := ""
	if strings.HasPrefix(contentType, "multipart/form-data") {
		modelName = readMultipartValue(payload, contentType, "model")
	} else {
		var data struct{ Model string `json:"model"` }
		_ = json.Unmarshal(payload, &data)
		modelName = data.Model
	}
	if strings.TrimSpace(modelName) == "" {
		return nil, "", safeMessageError{message: "缺少模型名称"}
	}
	return payload, strings.TrimSpace(modelName), nil
}

func ReadAIRequestCount(body []byte, contentType string) int {
	count := 1
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if value := readMultipartValue(body, contentType, "n"); value != "" {
			_, _ = fmt.Sscan(value, &count)
		}
	} else {
		var payload struct{ N int `json:"n"` }
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
