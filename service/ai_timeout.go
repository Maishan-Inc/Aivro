package service

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func normalizeAITimeouts(setting model.AITimeoutSetting) model.AITimeoutSetting {
	for value, fallback := range map[*int]int{&setting.ImageMinutes: 10, &setting.VideoMinutes: 15, &setting.Model3DMinutes: 30, &setting.TextMinutes: 5} {
		if *value <= 0 { *value = fallback }
		if *value > 120 { *value = 120 }
	}
	return setting
}

func aiTimeout(setting model.AITimeoutSetting, path string) time.Duration {
	setting = normalizeAITimeouts(setting)
	minutes := setting.TextMinutes
	switch {
	case strings.HasPrefix(path, "/images/"):
		minutes = setting.ImageMinutes
	case path == "/videos" || strings.HasPrefix(path, "/videos/"):
		minutes = setting.VideoMinutes
	case strings.HasPrefix(path, "/model-3d/"):
		minutes = setting.Model3DMinutes
	}
	return time.Duration(minutes) * time.Minute
}

func AIRequestTimeoutForPath(path string) time.Duration {
	settings, _ := repository.GetSettings()
	return aiTimeout(settings.Private.AITimeouts, path)
}

// AIHTTPClientForContext 复用安全传输配置；生成请求由上下文的执行期限控制。
func AIHTTPClientForContext(ctx context.Context) *http.Client {
	client := *AIHTTPClient
	if _, ok := ctx.Deadline(); ok { client.Timeout = 0 }
	return &client
}

func generationDownloadClient(ctx context.Context) *http.Client {
	client := *publicHTTPClient()
	if _, ok := ctx.Deadline(); ok { client.Timeout = 0 }
	return &client
}

func SaveAITimeouts(setting model.AITimeoutSetting) (model.AITimeoutSetting, error) {
	for _, minutes := range []int{setting.ImageMinutes, setting.VideoMinutes, setting.Model3DMinutes, setting.TextMinutes} {
		if minutes < 1 || minutes > 120 { return setting, safeMessageError{message: "生成超时必须为 1–120 分钟的整数"} }
	}
	return setting, repository.SaveAITimeouts(setting, now())
}
