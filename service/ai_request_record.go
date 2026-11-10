package service

import (
	"log"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

// 同步文本请求也先登记任务；重试和用量结算沿用同一编号。
func beginLoggedAIRequest(userID, modelName, path string, body []byte, meta *RequestLogMeta) (func(error), error) {
	meta.TaskID = newID("task")
	meta.Parameters, _ = ReadAIRequestParameters(body, "application/json")
	user, _, err := repository.GetUserByID(userID)
	if err != nil { return nil, err }
	if path == "/canvas-agent/plan" || path == "/canvas-assistant/chat" { meta.Section = "workflow" }
	task := model.GenerationTask{ID: meta.TaskID, UserID: userID, Username: user.Username, Model: modelName, Path: path, Section: meta.Section, Parameters: meta.Parameters, Prompt: parameterPrompt(meta.Parameters), RequestCount: 1, Status: model.GenerationTaskExecuting, Stage: "executing", StartedAt: now(), CreatedAt: now(), UpdatedAt: now(), WorkerID: queueWorkerID, LeaseExpiresAt: time.Now().Add(AIRequestTimeoutForPath(path)+time.Minute).Format(time.RFC3339)}
	if _, err := repository.SaveGenerationTask(task); err != nil { return nil, err }
	return func(requestErr error) {
		status, message, detail := model.GenerationTaskSucceeded, "", ""
		if requestErr != nil {
			status, message, detail = model.GenerationTaskFailed, "AI 接口请求失败", requestErr.Error()
			if safe, ok := requestErr.(interface{ SafeMessage() string }); ok { message = safe.SafeMessage() }
		}
		credits, err := repository.GenerationTaskChargedCredits(task.ID)
		if err == nil { _, err = repository.FinishGenerationTask(task, status, map[string]any{"credits": credits, "stage": string(status), "error": message, "error_detail": detail, "finished_at": now()}, nil) }
		if err != nil { log.Printf("AI request record settlement failed: task=%s errorType=%T", task.ID, err) }
	}, nil
}
