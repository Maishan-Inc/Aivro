package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

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
