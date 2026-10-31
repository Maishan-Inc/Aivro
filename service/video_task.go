package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func GetVideoGeneration(user model.AuthUser, id string) (model.GenerationTaskView, error) {
	task, err := GetGenerationTask(user, id)
	if err != nil { return task, err }
	if task.Path != "/videos" { return model.GenerationTaskView{}, SafeAIError("视频任务不存在或无权访问") }
	return task, nil
}

func GetVideoGenerationContent(ctx context.Context, user model.AuthUser, id string) (model.CloudFile, io.ReadCloser, error) {
	if _, err := GetVideoGeneration(user, id); err != nil { return model.CloudFile{}, nil, err }
	result, err := GetGenerationTaskResult(ctx, user, id)
	if err != nil { return model.CloudFile{}, nil, err }
	defer result.Content.Close()
	var payload struct { File struct { StorageKey string `json:"storageKey"` } `json:"file"` }
	if err := json.NewDecoder(result.Content).Decode(&payload); err != nil { return model.CloudFile{}, nil, err }
	return GetFileContent(ctx, user, cloudID("", payload.File.StorageKey), "")
}

type videoTaskStatus struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Error  struct { Message string `json:"message"` } `json:"error"`
}

func readVideoTaskStatus(body []byte) (videoTaskStatus, error) {
	var payload struct {
		videoTaskStatus
		Data *videoTaskStatus `json:"data"`
		Code int `json:"code"`
		Msg string `json:"msg"`
	}
	if err := json.Unmarshal(body, &payload); err != nil { return videoTaskStatus{}, err }
	if payload.Code != 0 { return videoTaskStatus{}, safeMessageError{message: "视频接口请求失败"} }
	if payload.Data != nil { return *payload.Data, nil }
	return payload.videoTaskStatus, nil
}

// completeVideoTask 将站内视频轮询与转存包含在同一个后台执行期限内。
func completeVideoTask(ctx context.Context, user model.AuthUser, body []byte) ([]byte, error) {
	created, err := readVideoTaskStatus(body)
	if err != nil { return nil, err }
	task, channel, err := UserVideoRoute(user.ID, created.ID)
	if err != nil { return nil, err }
	path := "/videos/" + task.ProviderID
	ticker := time.NewTicker(2500 * time.Millisecond)
	defer ticker.Stop()
	for {
		response, err := getVideoResponse(ctx, channel, path)
		if err != nil { return nil, err }
		payload, err := readLimited(response.Body, 1<<20, "视频响应过大")
		_ = response.Body.Close()
		if err != nil { return nil, err }
		status, err := readVideoTaskStatus(payload)
		if err != nil { return nil, err }
		if status.Status == "completed" { break }
		if status.Status == "failed" || status.Status == "cancelled" || status.Status == "canceled" { return nil, safeMessageError{message: "视频生成失败"} }
		select {
		case <-ctx.Done(): return nil, ctx.Err()
		case <-ticker.C:
		}
	}
	response, err := getVideoResponse(ctx, channel, path+"/content")
	if err != nil { return nil, err }
	defer response.Body.Close()
	stored, err := StoreVideoReaderToCloud(ctx, user, response.Body, response.Header.Get("Content-Type"), path+"/content")
	if err != nil { return nil, err }
	var payload struct { Data json.RawMessage `json:"data"` }
	if err := json.Unmarshal(stored, &payload); err != nil { return nil, err }
	return json.Marshal(map[string]any{"id": task.ID, "status": "completed", "file": payload.Data})
}

func getVideoResponse(ctx context.Context, channel model.ModelChannel, path string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, BuildModelChannelURL(channel, path), nil)
	if err != nil { return nil, err }
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	response, err := AIHTTPClientForContext(ctx).Do(request)
	if err != nil { return nil, err }
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_ = response.Body.Close()
		return nil, safeMessageError{message: "视频接口请求失败"}
	}
	return response, nil
}

func RecordVideoTask(user model.AuthUser, route ModelChannelRoute, body []byte) ([]byte, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil { return nil, err }
	data := payload
	if nested, ok := payload["data"].(map[string]any); ok { data = nested }
	id, _ := data["id"].(string)
	if strings.TrimSpace(id) == "" || strings.ContainsAny(id, "/\\?#") || id == "." || id == ".." {
		return nil, safeMessageError{message: "上游未返回有效视频任务"}
	}
	task := model.VideoTask{ID: newID("video"), UserID: user.ID, ProviderID: id, Model: route.PublicModel, ChannelBaseURL: route.Channel.BaseURL, ChannelKeyHash: videoChannelKeyHash(route.Channel.APIKey), CreatedAt: now()}
	if err := repository.CreateVideoTask(task); err != nil { return nil, err }
	data["id"] = task.ID
	return json.Marshal(payload)
}

func UserVideoRoute(userID string, id string) (model.VideoTask, model.ModelChannel, error) {
	task, err := repository.GetUserVideoTask(userID, id)
	if err != nil { return task, model.ModelChannel{}, safeMessageError{message: "视频任务不存在或无权访问"} }
	settings, err := repository.GetSettings()
	if err != nil { return task, model.ModelChannel{}, err }
	for _, channel := range normalizePrivateSetting(settings.Private).Channels {
		if channel.Enabled && channel.BaseURL == task.ChannelBaseURL && videoChannelKeyHash(channel.APIKey) == task.ChannelKeyHash {
			return task, channel, nil
		}
	}
	return task, model.ModelChannel{}, safeMessageError{message: "视频原渠道不可用，请联系管理员"}
}

func videoChannelKeyHash(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}
