package service

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-contrib/sse"
)

// RequestChatCompletion shares reservation and usage settlement across chat entry points.
func RequestChatCompletion(ctx context.Context, userID string, body []byte, modelName string, path string, meta RequestLogMeta, consume func(*http.Response) ([]byte, error)) ([]byte, error) {
	if err := ValidateModelRequest(modelName, "/chat/completions"); err != nil { return nil, err }
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil { return nil, safeMessageError{message: "对话请求格式无效"} }
	if n, ok := payload["n"]; ok && n != float64(1) { return nil, safeMessageError{message: "对话请求每次只支持一条回复"} }
	if stream, ok := payload["stream"]; ok {
		if _, valid := stream.(bool); !valid { return nil, safeMessageError{message: "stream 必须为布尔值"} }
	}
	maxTokens := 4096
	tokenField := "max_tokens"
	if _, ok := payload["max_completion_tokens"]; ok { tokenField = "max_completion_tokens"; delete(payload, "max_tokens") }
	if value, ok := payload[tokenField]; ok {
		n, valid := value.(float64)
		if !valid || n < 1 || n > 32768 || n != float64(int(n)) { return nil, safeMessageError{message: "对话输出上限需为 1–32768 的整数"} }
		maxTokens = int(n)
	}
	payload[tokenField] = maxTokens
	if streaming, _ := payload["stream"].(bool); streaming { payload["stream_options"] = map[string]bool{"include_usage": true} }
	body, _ = json.Marshal(payload)
	if len(body) > 8<<20 { return nil, safeMessageError{message: "对话内容过大"} }
	billing, err := ModelBilling(modelName)
	if err != nil { return nil, err }
	routes, err := SelectModelChannelRoutes(modelName)
	if err != nil { return nil, err }
	reserved := canvasAgentReserveCredits(body, maxTokens, billing)
	if err := ConsumeUserCreditsWithMeta(userID, modelName, reserved, path, meta); err != nil { return nil, err }
	ctx, cancel := context.WithTimeout(ctx, AIRequestTimeout)
	defer cancel()
	for _, route := range ModelChannelRouteAttempts(routes) {
		payload["model"] = route.UpstreamModel
		requestBody, _ := json.Marshal(payload)
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(route.Channel, "/chat/completions"), bytes.NewReader(requestBody))
		if err != nil { continue }
		request.Header.Set("Authorization", "Bearer "+route.Channel.APIKey)
		request.Header.Set("Content-Type", "application/json")
		response, err := AIHTTPClient.Do(request)
		if err != nil { continue }
		if response.StatusCode < 200 || response.StatusCode >= 300 { _ = response.Body.Close(); continue }
		var result []byte
		if consume == nil { result, err = readLimited(response.Body, 8<<20, "对话响应过大") } else { result, err = consume(response) }
		_ = response.Body.Close()
		if err != nil && len(result) == 0 {
			_ = RefundUserCreditsWithMeta(userID, modelName, reserved, path, meta)
			return nil, err
		}
		usage := chatResponseUsage(result, response.Header.Get("Content-Type"))
		_, billErr := billAIUsage(userID, modelName, billing, reserved, usage, body, result, meta, path)
		if billErr != nil { return nil, billErr }
		return result, err
	}
	if err := RefundUserCreditsWithMeta(userID, modelName, reserved, path, meta); err != nil { return nil, err }
	return nil, safeMessageError{message: "AI 对话请求失败"}
}

func chatResponseUsage(body []byte, contentType string) canvasAgentResponseUsage {
	var payload struct { Usage canvasAgentResponseUsage `json:"usage"` }
	if !strings.Contains(contentType, "text/event-stream") {
		_ = json.Unmarshal(body, &payload)
		return payload.Usage
	}
	events, _ := sse.Decode(bytes.NewReader(bytes.ReplaceAll(body, []byte("\r\n"), []byte("\n"))))
	for _, event := range events {
		text, _ := event.Data.(string)
		var item struct { Usage canvasAgentResponseUsage `json:"usage"` }
		if json.Unmarshal([]byte(text), &item) == nil && (item.Usage.TotalTokens > 0 || item.Usage.PromptTokens > 0 || item.Usage.InputTokens > 0) { payload = item }
	}
	return payload.Usage
}

