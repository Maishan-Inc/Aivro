package handler

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

var aiProxyExecutorOnce sync.Once

func ensureAIProxyExecutor() {
	aiProxyExecutorOnce.Do(func() {
		service.RegisterAIProxyExecutor(ExecuteAIProxyTask)
	})
}

func AIImagesGenerations(w http.ResponseWriter, r *http.Request) {
	ensureAIProxyExecutor()
	proxyAIRequest(w, r, "/images/generations")
}

func AIImagesEdits(w http.ResponseWriter, r *http.Request) {
	ensureAIProxyExecutor()
	proxyAIRequest(w, r, "/images/edits")
}

func AIChatCompletions(w http.ResponseWriter, r *http.Request) {
	ensureAIProxyExecutor()
	proxyAIRequest(w, r, "/chat/completions")
}

func AIVideos(w http.ResponseWriter, r *http.Request) {
	ensureAIProxyExecutor()
	proxyAIRequest(w, r, "/videos")
}

func AIVideo(w http.ResponseWriter, r *http.Request, id string) {
	proxyAIGetRequest(w, r, "/videos/"+id)
}

func AIVideoContent(w http.ResponseWriter, r *http.Request, id string) {
	proxyAIGetRequest(w, r, "/videos/"+id+"/content")
}

func proxyAIGetRequest(w http.ResponseWriter, r *http.Request, path string) {
	modelName := r.URL.Query().Get("model")
	if strings.TrimSpace(modelName) == "" {
		modelName = "grok-imagine-video"
	}
	channel, err := service.SelectModelChannel(modelName)
	if err != nil {
		log.Printf("AI proxy select channel failed: model=%s err=%v", modelName, err)
		Fail(w, "AI 接口请求失败")
		return
	}
	request, err := http.NewRequest(http.MethodGet, service.BuildModelChannelURL(channel, path), nil)
	if err != nil {
		Fail(w, "AI 接口请求失败")
		return
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	user, _ := service.UserFromContext(r.Context())
	copyAIResponse(w, request, nil, aiProxyContext{Request: r, User: user, Path: path})
}

func proxyAIRequest(w http.ResponseWriter, r *http.Request, path string) {
	ensureAIProxyExecutor()
	contentType := r.Header.Get("Content-Type")
	body, modelName, err := service.ReadAIRequest(r.Body, contentType)
	if err != nil {
		log.Printf("AI proxy request read failed: %v", err)
		Fail(w, "AI 接口请求失败")
		return
	}
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if !service.AIQueueEnabled() || path == "/chat/completions" {
		directAIProxyRequest(w, r, user, body, contentType, modelName, path)
		return
	}
	queued, response, err := service.SubmitAITask(r.Context(), user, body, contentType, modelName, path)
	if err != nil {
		FailError(w, err)
		return
	}
	if queued.Queued {
		OK(w, queued)
		return
	}
	if response == nil {
		Fail(w, "AI 接口请求失败")
		return
	}
	writeAIProxyResponse(w, *response)
}

func directAIProxyRequest(w http.ResponseWriter, r *http.Request, user model.AuthUser, body []byte, contentType string, modelName string, path string) {
	credits, err := service.ModelCost(modelName)
	if err != nil {
		log.Printf("AI proxy read model cost failed: model=%s err=%v", modelName, err)
		Fail(w, "AI 接口请求失败")
		return
	}
	credits *= service.ReadAIRequestCount(body, contentType)
	channel, err := service.SelectModelChannel(modelName)
	if err != nil {
		log.Printf("AI proxy select channel failed: model=%s err=%v", modelName, err)
		Fail(w, "AI 接口请求失败")
		return
	}
	request, err := http.NewRequestWithContext(r.Context(), http.MethodPost, service.BuildModelChannelURL(channel, path), bytes.NewReader(body))
	if err != nil {
		log.Printf("AI proxy build request failed: url=%s err=%v", service.BuildModelChannelURL(channel, path), err)
		Fail(w, "AI 接口请求失败")
		return
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	if err := service.ConsumeUserCredits(user.ID, modelName, credits, path); err != nil {
		FailError(w, err)
		return
	}
	copyAIResponse(w, request, func() {
		if err := service.RefundUserCredits(user.ID, modelName, credits, path); err != nil {
			log.Printf("AI proxy refund credits failed: user=%s model=%s credits=%d err=%v", user.ID, modelName, credits, err)
		}
	}, aiProxyContext{Request: r, User: user, Path: path})
}

// ExecuteAIProxyTask executes an upstream AI POST request and returns the response body.
// It is registered with service generation queue so synchronous and queued requests share the same path.
// body is streamed directly to the upstream request to avoid buffering large payloads in memory.
func ExecuteAIProxyTask(ctx context.Context, user model.AuthUser, body io.Reader, contentType string, modelName string, path string) (service.AIProxyResponse, error) {
	channel, err := service.SelectModelChannel(modelName)
	if err != nil {
		log.Printf("AI proxy select channel failed: model=%s err=%v", modelName, err)
		return service.AIProxyResponse{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, service.BuildModelChannelURL(channel, path), body)
	if err != nil {
		log.Printf("AI proxy build request failed: url=%s err=%v", service.BuildModelChannelURL(channel, path), err)
		return service.AIProxyResponse{}, err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		log.Printf("AI proxy request failed: path=%s err=%v", request.URL.Path, err)
		return service.AIProxyResponse{}, err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		log.Printf("AI upstream error: path=%s status=%d body=%s", request.URL.Path, response.StatusCode, strings.TrimSpace(string(payload)))
		return service.AIProxyResponse{}, service.SafeAIError("AI 接口请求失败")
	}

	payload, err := service.ReadAIProxyResponseBody(response.Body, path)
	if err != nil {
		log.Printf("AI proxy read response failed: path=%s err=%v", path, err)
		return service.AIProxyResponse{}, err
	}
	payload, header, statusCode, err := rewriteCloudAIResponseBody(ctx, user, path, payload, response.Header, response.StatusCode)
	if err != nil {
		log.Printf("AI proxy cloud rewrite failed: path=%s err=%v", path, err)
		return service.AIProxyResponse{}, err
	}
	return service.AIProxyResponse{StatusCode: statusCode, Header: header, Body: payload}, nil
}

func rewriteCloudAIResponseBody(ctx context.Context, user model.AuthUser, path string, body []byte, header http.Header, statusCode int) ([]byte, http.Header, int, error) {
	if _, _, err := service.CloudStorageEnabled(); err != nil {
		return body, cloneHeader(header), statusCode, nil
	}
	if user.ID == "" {
		return body, cloneHeader(header), statusCode, nil
	}
	isImageResponse := path == "/images/generations" || path == "/images/edits"
	if !isImageResponse {
		return body, cloneHeader(header), statusCode, nil
	}
	rewritten, err := service.StoreImageResponseToCloud(ctx, user, body, path)
	if err != nil {
		return nil, nil, 0, err
	}
	resultHeader := cloneHeader(header)
	resultHeader.Set("Content-Type", "application/json")
	return rewritten, resultHeader, statusCode, nil
}

type aiProxyContext struct {
	Request *http.Request
	User    model.AuthUser
	Path    string
}

func copyAIResponse(w http.ResponseWriter, request *http.Request, onFailure func(), proxyContext aiProxyContext) {
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		log.Printf("AI proxy request failed: path=%s err=%v", request.URL.Path, err)
		if onFailure != nil {
			onFailure()
		}
		Fail(w, "AI 接口请求失败")
		return
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		log.Printf("AI upstream error: path=%s status=%d body=%s", request.URL.Path, response.StatusCode, strings.TrimSpace(string(payload)))
		if onFailure != nil {
			onFailure()
		}
		Fail(w, "AI 接口请求失败")
		return
	}

	if cloudResponse, ok := rewriteCloudAIResponse(w, response, proxyContext, onFailure); ok {
		_, _ = w.Write(cloudResponse)
		return
	}

	for key, values := range response.Header {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(response.StatusCode)
	_, _ = io.Copy(w, response.Body)
}

func rewriteCloudAIResponse(w http.ResponseWriter, response *http.Response, proxyContext aiProxyContext, onFailure func()) ([]byte, bool) {
	if _, _, err := service.CloudStorageEnabled(); err != nil {
		return nil, false
	}
	if proxyContext.User.ID == "" {
		return nil, false
	}
	isImageResponse := proxyContext.Path == "/images/generations" || proxyContext.Path == "/images/edits"
	isVideoContent := strings.HasPrefix(proxyContext.Path, "/videos/") && strings.HasSuffix(proxyContext.Path, "/content")
	if !isImageResponse && !isVideoContent {
		return nil, false
	}
	if isVideoContent {
		rewritten, err := service.StoreVideoReaderToCloud(proxyContext.Request.Context(), proxyContext.User, response.Body, response.Header.Get("Content-Type"), proxyContext.Path)
		if err != nil {
			log.Printf("AI video cloud transfer failed: path=%s err=%v", proxyContext.Path, err)
			if onFailure != nil {
				onFailure()
			}
			Fail(w, "云存储转存失败")
			return nil, true
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		return rewritten, true
	}
	body, readErr := service.ReadAIProxyResponseBody(response.Body, proxyContext.Path)
	if readErr != nil {
		log.Printf("AI proxy read cloud response failed: path=%s err=%v", proxyContext.Path, readErr)
		if onFailure != nil {
			onFailure()
		}
		Fail(w, "云存储转存失败")
		return nil, true
	}
	if isImageResponse {
		rewritten, err := service.StoreImageResponseToCloud(proxyContext.Request.Context(), proxyContext.User, body, proxyContext.Path)
		if err != nil {
			log.Printf("AI image cloud transfer failed: path=%s err=%v", proxyContext.Path, err)
			if onFailure != nil {
				onFailure()
			}
			Fail(w, "云存储转存失败")
			return nil, true
		}
		copyResponseHeaders(w, response.Header)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(response.StatusCode)
		return rewritten, true
	}
	return nil, false
}

func writeAIProxyResponse(w http.ResponseWriter, response service.AIProxyResponse) {
	copyResponseHeaders(w, response.Header)
	if response.StatusCode > 0 {
		w.WriteHeader(response.StatusCode)
	}
	_, _ = w.Write(response.Body)
}

func copyResponseHeaders(w http.ResponseWriter, header http.Header) {
	for key, values := range header {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
}

func cloneHeader(header http.Header) http.Header {
	result := http.Header{}
	for key, values := range header {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			result.Add(key, value)
		}
	}
	return result
}
