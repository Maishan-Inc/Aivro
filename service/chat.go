package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/gin-contrib/sse"
)

type chatUsageContextKey struct{}
type chatUsageCollection struct { UnitCredits int; Tokens int }

// RequestChatCompletion shares reservation and usage settlement across chat entry points.
func RequestChatCompletion(ctx context.Context, userID string, body []byte, modelName string, path string, meta RequestLogMeta, consume func(*http.Response) ([]byte, error)) (resultBody []byte, requestErr error) {
	collection, collecting := ctx.Value(chatUsageContextKey{}).(*chatUsageCollection)
	if !collecting {
		finish, err := beginLoggedAIRequest(userID, modelName, path, body, &meta)
		if err != nil { return nil, err }
		defer func() { finish(requestErr) }()
	}
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
	meta.Parameters, _ = ReadAIRequestParameters(body, "application/json")
	billingBody := body
	if path == "/prompt-reverse" { billingBody, _ = json.Marshal(meta.Parameters) }
	if len(body) > 8<<20 { return nil, safeMessageError{message: "对话内容过大"} }
	billing := model.ModelCost{BillingType: model.BillingTypeToken}
	var err error
	if collecting { billing.Credits = collection.UnitCredits } else { billing, err = RequestModelBilling(ctx, modelName) }
	if err != nil { return nil, err }
	if path == "/prompt-reverse" && billing.BillingType != model.BillingTypeToken { return nil, SafeAIError("提示词反推需要按词元计费的文本模型") }
	routes, err := SelectModelChannelRoutes(modelName)
	if err != nil { return nil, err }
	reserved := canvasAgentReserveCredits(billingBody, maxTokens, billing)
	if collecting { reserved = 0 } else if err := ConsumeUserCreditsWithMeta(userID, modelName, reserved, path, meta); err != nil { return nil, err }
	ctx, cancel := context.WithTimeout(ctx, AIRequestTimeoutForPath("/chat/completions"))
	defer cancel()
	lastError := "AI 对话请求失败"
	for _, route := range ModelChannelRouteAttempts(routes) {
		payload["model"] = route.UpstreamModel
		requestBody, _ := json.Marshal(payload)
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(route.Channel, "/chat/completions"), bytes.NewReader(requestBody))
		if err != nil { continue }
		request.Header.Set("Authorization", "Bearer "+route.Channel.APIKey)
		request.Header.Set("Content-Type", "application/json")
		response, err := AIHTTPClientForContext(ctx).Do(request)
		if err != nil { continue }
		if response.StatusCode < 200 || response.StatusCode >= 300 { lastError = fmt.Sprintf("AI 接口请求失败：%d", response.StatusCode); _ = response.Body.Close(); continue }
		var result []byte
		if consume == nil { result, err = readLimited(response.Body, 8<<20, "对话响应过大") } else { result, err = consume(response) }
		_ = response.Body.Close()
		if err != nil && len(result) == 0 {
			_ = RefundUserCreditsWithMeta(userID, modelName, reserved, path, meta)
			return nil, err
		}
		usage := chatResponseUsage(result, response.Header.Get("Content-Type"))
		if path == "/prompt-reverse" && usage.TotalTokens <= 0 && firstPositive(usage.InputTokens, usage.PromptTokens)+firstPositive(usage.OutputTokens, usage.CompletionTokens) <= 0 {
			if err := RefundUserCreditsWithMeta(userID, modelName, reserved, path, meta); err != nil { return nil, err }
			return nil, SafeAIError("模型未返回词元用量，本次反推未扣费")
		}
		if collecting {
			collection.Tokens = usage.TotalTokens
			if collection.Tokens <= 0 { collection.Tokens = firstPositive(usage.InputTokens, usage.PromptTokens) + firstPositive(usage.OutputTokens, usage.CompletionTokens) }
			return result, err
		}
		_, billErr := billAIUsage(userID, modelName, billing, reserved, usage, billingBody, result, meta, path)
		if billErr != nil { return nil, billErr }
		return result, err
	}
	if err := RefundUserCreditsWithMeta(userID, modelName, reserved, path, meta); err != nil { return nil, err }
	return nil, safeMessageError{message: lastError}
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

