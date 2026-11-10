package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
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
	UsageTokens int
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
	queueWorkerID = newID("worker")
	proxyExecutor AIProxyExecutor
)

func RegisterAIProxyExecutor(executor AIProxyExecutor) {
	proxyExecutor = executor
}

func AIQueueEnabled() bool {
	settings, err := repository.GetSettings()
	if err != nil {
		log.Printf("read AI queue setting failed: type=%T", err)
		return true
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	return queue.Enabled != nil && *queue.Enabled
}

func SubmitAITask(ctx context.Context, user model.AuthUser, body []byte, contentType string, modelName string, path string, meta RequestLogMeta) (submitted model.GenerationTaskSubmitResult, response *AIProxyResponse, submitErr error) {
	parameters, err := ReadAIRequestParameters(body, contentType)
	if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	section := generationSource(path, meta.Section)
	free, isFree := ctx.Value(freeImageContextKey{}).(freeImageReservation)
	if isFree { section = model.UserSectionFreeImage }
	meta.Parameters, meta.TaskID = parameters, newID("task")
	submittedAt := now()
	defer func() {
		if submitErr == nil { return }
		previous, exists, err := repository.GetGenerationTask(meta.TaskID)
		if err != nil || (exists && previous.Status != model.GenerationTaskSubmitting) { return }
		message := "生成任务提交失败"
		if safe, ok := submitErr.(interface{ SafeMessage() string }); ok { message = safe.SafeMessage() }
		for index := range previous.Items { previous.Items[index].Status, previous.Items[index].Error = "failed", message }
		_, err = repository.SaveGenerationTask(model.GenerationTask{Items: previous.Items, ID: meta.TaskID, UserID: user.ID, Username: user.Username, Model: modelName, Path: path, Section: string(section), Prompt: parameterPrompt(parameters), Parameters: parameters, ContentType: contentType, Status: model.GenerationTaskFailed, Stage: "failed", Error: message, ErrorDetail: submitErr.Error(), CreatedAt: submittedAt, FinishedAt: now(), UpdatedAt: now()})
		if err != nil { log.Printf("generation task rejection record failed: task=%s errorType=%T", meta.TaskID, err) }
		if err == nil && path == "/prompt-reverse" {
			task, _, _ := repository.GetGenerationTask(meta.TaskID)
			history := reverseTaskHistory(task, "失败", message)
			if _, err := repository.SaveGenerationHistory(history, nil); err != nil { log.Printf("reverse rejection history failed: task=%s errorType=%T", task.ID, err) }
		}
	}()
	initialItems := []model.PromptReverseItem{}
	if path == "/prompt-reverse" {
		var input PromptReverseInput
		if json.Unmarshal(body, &input) == nil { for _, image := range input.Images { initialItems = append(initialItems, model.PromptReverseItem{Name: image.Name, Status: "queued"}) } }
	}
	if _, err := repository.SaveGenerationTask(model.GenerationTask{Items: initialItems, ID: meta.TaskID, UserID: user.ID, Username: user.Username, Model: modelName, Path: path, Section: string(section), Prompt: parameterPrompt(parameters), Parameters: parameters, ContentType: contentType, Status: model.GenerationTaskSubmitting, Stage: "submitting", CreatedAt: submittedAt, UpdatedAt: submittedAt, LeaseExpiresAt: time.Now().Add(AIRequestTimeoutForPath(path) + time.Minute).Format(time.RFC3339)}); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	if err := CheckSectionAccess(user, section); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	validationPath := path
	if path == "/prompt-reverse" { validationPath = "/chat/completions" }
	if err := ValidateModelRequest(modelName, validationPath); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	retention, err := UserGenerationRetention(user.ID)
	if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	if err := CheckSectionAccess(user, generationSection(path)); err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queue := normalizeAIQueueSetting(settings.Private.AIQueue)
	var videoInput VideoGenerationInput
	var billing model.ModelCost
	if path == "/videos" {
		videoInput, body, err = prepareVideoGeneration(ctx, user, body, contentType, modelName)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		contentType = "application/json"
		var effective map[string]any
		effective, err = ReadAIRequestParameters(body, contentType)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		parameters["effective"] = effective
		billing, err = videoModelBilling(ctx, modelName, videoInput.BillingType)
	} else { billing, err = RequestModelBilling(ctx, modelName) }
	if err != nil {
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	var reverseItems []model.PromptReverseItem
	if path == "/prompt-reverse" {
		reverseItems, err = preparePromptReverse(user, body, billing)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	}
	credits := billing.Credits
	if path == "/images/generations" || path == "/images/edits" {
		if err := ValidateImageResolution(parameters, billing.Resolutions); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	}
	requestCount, err := ReadAIRequestCount(body, contentType)
	if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	if credits < 0 || credits > int(^uint(0)>>1)/requestCount { return model.GenerationTaskSubmitResult{}, nil, safeMessageError{message: "模型计费配置无效"} }
	credits *= requestCount
	if path == "/videos" && videoInput.BillingType == model.BillingTypeSecond {
		seconds, _ := strconv.Atoi(videoInput.Seconds.String())
		if credits > int(^uint(0)>>1)/seconds { return model.GenerationTaskSubmitResult{}, nil, SafeAIError("模型计费配置无效") }
		credits *= seconds
	}
	if path == model3DPath {
		var input Model3DGenerationInput
		if err := json.Unmarshal(body, &input); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		if err := validateModel3DInput(input); err != nil {
			return model.GenerationTaskSubmitResult{}, nil, err
		}
		route, err := SelectModelChannelRoute(input.Model)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		caps := model3DCapabilities(route)
		if input.TargetFaceCount <= 0 { input.TargetFaceCount = caps.DefaultFaces }
		if route.Adapter == "" && input.TargetFaceCount > 1000000 { input.TargetFaceCount = 1000000 }
		if err := validateModel3DAdapterInput(route, input); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		body, err = json.Marshal(input)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		effective, err := ReadAIRequestParameters(body, contentType)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		parameters["effective"] = effective
		credits, err = Model3DCredits(input, billing.Credits)
		if err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
		requestCount = input.Quantity
	}
	if isFree || path == "/prompt-reverse" { credits = 0 }
	if path != "/prompt-reverse" {
		if err := ConsumeUserCreditsWithMeta(user.ID, modelName, credits, path, meta); err != nil { return model.GenerationTaskSubmitResult{}, nil, err }
	}
	refund := func() {
		if err := RefundUserCreditsWithMeta(user.ID, modelName, credits, path, meta); err != nil {
			log.Printf("generation task refund failed: user=%s model=%s credits=%d errorType=%T", user.ID, modelName, credits, err)
		}
	}

	requestFile, err := StoreTaskPayload(ctx, user, "request-"+newID("file")+".bin", body, contentType, path)
	if err != nil {
		refund()
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queueMu.Lock()
	if *queue.Enabled {
		if count, err := repository.CountQueuedUserTasks(user.ID); err != nil {
			queueMu.Unlock()
			refund()
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, err
		} else if int(count) >= queue.MaxQueuedPerUser {
			queueMu.Unlock()
			refund()
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, safeMessageError{message: "排队任务过多，请稍后再试"}
		}
	}
	now := time.Now().Format(time.RFC3339)
	meta = normalizeRequestLogMeta(meta)
	task := model.GenerationTask{
		Items: reverseItems,
		CampaignID: free.CampaignID,
		QuotaLimit: free.Limit,
		AgreementAcceptedAt: free.AcceptedAt,
		AgreementVersion: free.Agreement,
		ID:            meta.TaskID,
		UserID:        user.ID,
		Username:      user.Username,
		Model:         modelName,
		Path:          path,
		Section:       string(section),
		Prompt:        parameterPrompt(parameters),
		Parameters:    parameters,
		RetentionDays: retention.Days[string(section)],
		Stage:         "queued",
		ContentType:   contentType,
		RequestFileID: requestFile.File.ID,
		Credits:       credits,
		IP:            meta.IP,
		Country:       meta.Country,
		RequestCount:  requestCount,
		Status:        model.GenerationTaskQueued,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if IsAPIKeyRequest(ctx) { task.APIBillingType, task.APIUnitCredits = billing.BillingType, billing.Credits }
	if path == "/prompt-reverse" { task.APIUnitCredits, task.RequestCount = billing.Credits, len(reverseItems) }
	if path == "/videos" {
		task.VideoBillingType, task.VideoUnitCredits = videoInput.BillingType, billing.Credits
		task.VideoSeconds, _ = strconv.Atoi(videoInput.Seconds.String())
	}
	canRun, err := canDispatchModel(modelName, queue)
	if err != nil {
		queueMu.Unlock()
		refund()
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	if !*queue.Enabled || canRun {
		timeout := aiTimeout(settings.Private.AITimeouts, path)
		if path == "/prompt-reverse" { timeout *= time.Duration(task.RequestCount) }
		task.Status = model.GenerationTaskExecuting
		task.StartedAt = now
		task.WorkerID = queueWorkerID
		task.LeaseExpiresAt = time.Now().Add(timeout + time.Minute).Format(time.RFC3339)
		saved, err := repository.SaveGenerationTask(task)
		queueMu.Unlock()
		if err != nil {
			refund()
			_ = deleteTaskPayload(requestFile.File.ID)
			return model.GenerationTaskSubmitResult{}, nil, err
		}
		if !IsAPIKeyRequest(ctx) || path == "/videos" {
			go runGenerationTask(saved, timeout)
			return model.GenerationTaskSubmitResult{BillingType: saved.VideoBillingType, Seconds: saved.VideoSeconds, UnitCredits: saved.VideoUnitCredits, EnergyCost: saved.Credits, Queued: true, TaskID: saved.ID, Status: string(saved.Status), Model: modelName, Path: path}, nil, nil
		}
		resp, execErr := executeTask(ctx, user, saved, timeout)
		if execErr != nil {
			return model.GenerationTaskSubmitResult{}, nil, execErr
		}
		return model.GenerationTaskSubmitResult{}, &resp, nil
	}
	position, err := nextQueuePosition(modelName)
	if err != nil {
		queueMu.Unlock()
		refund()
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	task.QueuePosition = position
	if _, err := repository.SaveGenerationTask(task); err != nil {
		queueMu.Unlock()
		refund()
		_ = deleteTaskPayload(requestFile.File.ID)
		return model.GenerationTaskSubmitResult{}, nil, err
	}
	queueMu.Unlock()
	return model.GenerationTaskSubmitResult{BillingType: task.VideoBillingType, Seconds: task.VideoSeconds, UnitCredits: task.VideoUnitCredits, EnergyCost: task.Credits, Queued: true, TaskID: task.ID, Status: string(task.Status), QueuePosition: position, AheadCount: position - 1, Model: modelName, Path: path}, nil, nil
}

func GetGenerationTask(user model.AuthUser, id string) (model.GenerationTaskView, error) {
	task, ok, err := repository.GetGenerationTask(id)
	if err != nil {
		return model.GenerationTaskView{}, err
	}
	if !ok || task.UserID != user.ID {
		return model.GenerationTaskView{}, safeMessageError{message: "任务不存在或无权限访问"}
	}
	if err := checkGenerationTaskAccess(user, task); err != nil {
		return model.GenerationTaskView{}, err
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
		if checkGenerationTaskAccess(user, item) != nil {
			continue
		}
		for index := range item.Items { item.Items[index].Result = nil }
		result = append(result, generationTaskView(item))
	}
	return result, nil
}

func GetGenerationTaskResult(ctx context.Context, user model.AuthUser, id string) (GenerationTaskResultStream, error) {
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
	if err := checkGenerationTaskAccess(user, task); err != nil {
		return GenerationTaskResultStream{}, err
	}
	header := http.Header{}
	_ = json.Unmarshal([]byte(task.ResponseHeader), &header)
	_, content, err := GetFileContent(ctx, user, task.ResponseFileID, "")
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
	if err := checkGenerationTaskAccess(user, task); err != nil {
		return err
	}
	now := time.Now().Format(time.RFC3339)
	changed, err := repository.FinishGenerationTask(task, model.GenerationTaskCanceled, map[string]any{"canceled_at": now, "finished_at": now, "error": "用户已撤销", "stage": "canceled", "queue_position": 0, "credits": 0}, taskRefundLog(task))
	if err != nil { return err }
	if !changed { return safeMessageError{message: "任务状态已变化，无法撤销"} }

	if err := deleteTaskPayload(task.RequestFileID); err != nil {
		log.Printf("generation task request payload delete failed after cancel: task=%s errorType=%T", task.ID, err)
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
		recoveryTicker := time.NewTicker(30 * time.Second)
		defer recoveryTicker.Stop()
		defer ticker.Stop()
		defer cleanupTicker.Stop()
		for range ticker.C {
			if err := dispatchQueuedTasks(); err != nil {
				log.Printf("generation queue dispatch failed: type=%T", err)
			}
			select {
			case <-recoveryTicker.C:
				_ = recoverExecutingTasks()
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
			timeout := aiTimeout(settings.Private.AITimeouts, task.Path)
			if task.Path == "/prompt-reverse" { timeout *= time.Duration(task.RequestCount) }
			lease := time.Now().Add(timeout + time.Minute).Format(time.RFC3339)
			changed, err := repository.MarkQueuedTaskExecuting(task.ID, startedAt, queueWorkerID, lease)
			if err != nil {
				return err
			}
			if !changed {
				continue
			}
			task.Status = model.GenerationTaskExecuting
			task.StartedAt = startedAt
			task.WorkerID, task.LeaseExpiresAt = queueWorkerID, lease
			task.QueuePosition = 0
			go runGenerationTask(task, timeout)
		}
		if err := repository.RecalculateGenerationTaskPositions(modelName); err != nil {
			return err
		}
	}
	return nil
}

func runGenerationTask(task model.GenerationTask, timeout time.Duration) {
	user := model.AuthUser{ID: task.UserID, Username: task.Username}
	if _, err := executeTask(context.Background(), user, task, timeout); err != nil {
		log.Printf("queued AI task failed: id=%s errorType=%T", task.ID, err)
	}
}

func executeTask(ctx context.Context, user model.AuthUser, task model.GenerationTask, timeout time.Duration) (AIProxyResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	ctx = context.WithValue(ctx, generationTaskContextKey{}, task)
	_ = repository.UpdateGenerationTaskProgress(task, map[string]any{"stage": "executing", "updated_at": now()})
	if proxyExecutor == nil {
		return failExecutingTask(task, "AI 执行器未初始化")
	}
	if strings.TrimSpace(task.RequestFileID) == "" {
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	file, content, err := GetFileContent(ctx, user, task.RequestFileID, "")
	if err != nil {
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	if file.FileType != model.CloudFileTypeTask {
		_ = content.Close()
		return failExecutingTask(task, "AI 请求内容读取失败")
	}
	var resp AIProxyResponse
	if task.Path == "/prompt-reverse" {
		defer content.Close()
		return executePromptReverse(ctx, user, task, content)
	}
	if task.Path == model3DPath {
		resp, err = executeModel3DTask(ctx, user, task, content)
	} else if task.Path == "/videos" {
		resp, err = executeVideoGeneration(ctx, user, task, content)
	} else {
		resp, err = proxyExecutor(ctx, user, content, task.ContentType, task.Model, task.Path)
	}
	_ = content.Close()
	now := time.Now().Format(time.RFC3339)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded { return failExecutingTask(task, "生成任务已超过执行时限，请核实上游结果后再重试") }
		RecordGenerationTaskDiagnostic(ctx, err.Error())
		if safe, ok := err.(interface{ SafeMessage() string }); ok { return failExecutingTask(task, safe.SafeMessage()) }
		return failExecutingTask(task, "AI 接口请求失败")
	}
	resp.Header = SafeResponseHeaders(resp.Header)
	files, err := repository.ListGenerationTaskFiles(task.ID)
	if err != nil { return failExecutingTask(task, "AI 结果保存失败") }
	if len(files) == 0 { return failExecutingTask(task, "生成接口未返回可用结果") }
	headerJSON, _ := json.Marshal(resp.Header)
	responseFile, err := StoreTaskPayload(ctx, user, "response-"+newID("file")+".bin", resp.Body, firstNonEmpty(resp.Header.Get("Content-Type"), "application/octet-stream"), task.Path)
	if err != nil {
		log.Printf("generation task persist response payload failed: task=%s errorType=%T", task.ID, err)
		return failExecutingTask(task, "AI 结果保存失败")
	}
	fields := map[string]any{"response_status": resp.StatusCode, "response_header": string(headerJSON), "response_file_id": responseFile.File.ID, "finished_at": now, "stage": "succeeded", "progress": 100, "error_detail": ""}
	var settlement *model.CreditLog
	if task.APIBillingType == model.BillingTypeToken {
		actual := apiUsageCredits(task.APIUnitCredits, task.Credits, resp.UsageTokens)
		fields["credits"] = actual
		if delta := task.Credits-actual; delta != 0 {
			settlement = taskRefundLog(task)
			settlement.Amount, settlement.Remark = delta, "API 用量结算"
			if delta < 0 { settlement.Type, settlement.Category = model.CreditLogTypeAIConsume, creditLogCategory(model.CreditLogTypeAIConsume) }
		}
	}
	histories := []model.GenerationHistory{}
	if task.CampaignID != "" { histories = append(histories, freeImageHistory(task, files)) }
	changed, err := repository.FinishGenerationTask(task, model.GenerationTaskSucceeded, fields, settlement, histories...)
	if err != nil { return failExecutingTask(task, "AI 结果保存失败") }
	if !changed { return AIProxyResponse{}, safeMessageError{message: "任务已结束，请刷新任务列表"} }
	return resp, nil
}

func taskRefundLog(task model.GenerationTask) *model.CreditLog {
	meta := normalizeRequestLogMeta(RequestLogMeta{IP: task.IP, Country: task.Country})
	extra, _ := json.Marshal(map[string]string{"model": task.Model, "path": task.Path, "ip": meta.IP, "country": meta.Country})
	return &model.CreditLog{ID: newID("credit"), UserID: task.UserID, Type: model.CreditLogTypeAIRefund, Category: creditLogCategory(model.CreditLogTypeAIRefund), Model: task.Model, Path: task.Path, Amount: task.Credits, RelatedID: task.ID, Parameters: task.Parameters, Remark: "生成任务失败或撤销退款", IP: meta.IP, Country: meta.Country, Extra: string(extra), CreatedAt: now()}
}

func failExecutingTask(task model.GenerationTask, message string) (AIProxyResponse, error) {
	histories := []model.GenerationHistory{}
	fields := map[string]any{"error": message, "stage": "failed", "finished_at": now(), "credits": 0}
	if task.Path == "/prompt-reverse" {
		for index := range task.Items {
			task.Items[index].Result = nil
			if task.Items[index].Status != "failed" { task.Items[index].Status, task.Items[index].Error, task.Items[index].Credits = "failed", message, 0 }
		}
		items, _ := json.Marshal(task.Items)
		fields["items"] = string(items)
		histories = append(histories, reverseTaskHistory(task, "失败", message))
	}
	_, err := repository.FinishGenerationTask(task, model.GenerationTaskFailed, fields, taskRefundLog(task), histories...)
	if err != nil { log.Printf("generation task settlement failed: task=%s errorType=%T", task.ID, err) }
	return AIProxyResponse{}, safeMessageError{message: message}
}

func recoverExecutingTasks() error {
	items, err := repository.ListExpiredExecutingTasks(now())
	if err != nil { return err }
	for _, item := range items {
		if item.Status == model.GenerationTaskSubmitting || item.Path == "/chat/completions" || strings.HasPrefix(item.Path, "/canvas-assistant/") || strings.HasPrefix(item.Path, "/canvas-agent/") {
			credits, err := repository.GenerationTaskChargedCredits(item.ID)
			if err != nil { continue }
			item.Credits = credits
		}
		_, _ = failExecutingTask(item, "任务执行超时或执行实例已离线")
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
		if err := repository.ClearGenerationTaskPayloads(task.ID); err != nil {
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
	for index := range task.Items {
		if task.Status != model.GenerationTaskSucceeded { task.Items[index].Result = nil }
		if task.Items[index].Media != nil && task.Items[index].Media.ExpiresAt <= now() { task.Items[index].Media = nil; task.Items[index].Result = nil }
	}
	return model.GenerationTaskView{Items: task.Items, Stage: task.Stage, Progress: task.Progress, BillingType: task.VideoBillingType, Seconds: task.VideoSeconds, UnitCredits: task.VideoUnitCredits, ID: task.ID, Model: task.Model, Path: task.Path, Status: string(task.Status), QueuePosition: task.QueuePosition, AheadCount: ahead, Credits: task.Credits, Error: task.Error, CreatedAt: task.CreatedAt, StartedAt: task.StartedAt, FinishedAt: task.FinishedAt, ResultAvailable: task.Status == model.GenerationTaskSucceeded && task.ResponseFileID != "", ResponseStatus: task.ResponseStatus}
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
		modelName, err = readMultipartValue(payload, contentType, "model")
		if err != nil { return nil, "", err }
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
	for _, files := range form.File {
		for _, fileHeader := range files {
			src, err := fileHeader.Open()
			if err != nil {
				return nil, contentType, err
			}
			part, err := writer.CreatePart(fileHeader.Header)
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

func ReadAIRequestCount(body []byte, contentType string) (int, error) {
	count := 1
	invalid := safeMessageError{message: "生成数量需为 1–10 的整数"}
	if strings.HasPrefix(contentType, "multipart/form-data") {
		value, err := readMultipartValue(body, contentType, "n")
		if err != nil { return 0, invalid }
		if value != "" {
			count, err = strconv.Atoi(value)
			if err != nil { return 0, invalid }
		}
	} else {
		var payload map[string]json.RawMessage
		if err := json.Unmarshal(body, &payload); err != nil { return 0, invalid }
		if value, ok := payload["n"]; ok {
			if string(value) == "null" || json.Unmarshal(value, &count) != nil { return 0, invalid }
		}
	}
	if count < 1 || count > 10 { return 0, invalid }
	return count, nil
}

func readMultipartValue(body []byte, contentType string, key string) (string, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil { return "", err }
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
	if err != nil { return "", err }
	defer form.RemoveAll()
	values := form.Value[key]
	if len(values) > 1 || len(form.File[key]) > 0 || (len(values) == 1 && strings.TrimSpace(values[0]) == "") {
		return "", safeMessageError{message: "请求字段重复或格式无效"}
	}
	if len(values) == 1 { return values[0], nil }
	return "", nil
}

func StoreTaskPayload(ctx context.Context, user model.AuthUser, filename string, body []byte, contentType string, source string) (CloudObjectResult, error) {
	contentType = "application/octet-stream"
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
