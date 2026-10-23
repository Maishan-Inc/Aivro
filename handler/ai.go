package handler

import (
	"bytes"
	"context"
	"fmt"
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
	user, _ := service.UserFromContext(r.Context())
	id := strings.TrimSuffix(strings.TrimPrefix(path, "/videos/"), "/content")
	task, channel, err := service.UserVideoRoute(user.ID, id)
	if err != nil { FailError(w, err); return }
	upstreamPath := "/videos/" + task.ProviderID
	if strings.HasSuffix(path, "/content") { upstreamPath += "/content" }
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, service.BuildModelChannelURL(channel, upstreamPath), nil)
	if err != nil { Fail(w, "AI 接口请求失败"); return }
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	copyAIResponse(w, request, nil, aiProxyContext{Request: r, User: user, Path: path})
}

func proxyAIRequest(w http.ResponseWriter, r *http.Request, path string) {
	ensureAIProxyExecutor()
	contentType := r.Header.Get("Content-Type")
	body, modelName, err := service.ReadAIRequest(r.Body, contentType)
	if err != nil {
		log.Printf("AI proxy request read failed: type=%T", err)
		Fail(w, "AI 接口请求失败")
		return
	}
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.ValidateModelRequest(modelName, path); err != nil {
		FailError(w, err)
		return
	}
	if !service.AIQueueEnabled() || path == "/chat/completions" {
		directAIProxyRequest(w, r, user, body, contentType, modelName, path)
		return
	}
	queued, response, err := service.SubmitAITask(r.Context(), user, body, contentType, modelName, path, service.RequestLogMetaFromRequest(r))
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
	if path == "/chat/completions" {
		started := false
		_, err := service.RequestChatCompletion(r.Context(), user.ID, body, modelName, path, service.RequestLogMetaFromRequest(r), func(response *http.Response) ([]byte, error) {
			started = true
			copyResponseHeaders(w, response.Header)
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Accel-Buffering", "no")
			var captured bytes.Buffer
			_, err := io.Copy(flushResponseWriter{w}, io.TeeReader(io.LimitReader(response.Body, (8<<20)+1), &captured))
			if captured.Len() > 8<<20 { err = service.SafeAIError("对话响应过大") }
			return captured.Bytes(), err
		})
		if err != nil { if !started { FailError(w, err) } else { log.Printf("chat settlement failed: type=%T", err) } }
		return
	}
	credits, err := service.ModelCost(modelName)
	if err != nil {
		log.Printf("AI proxy read model cost failed: model=%s errorType=%T", modelName, err)
		Fail(w, "AI 接口请求失败")
		return
	}
	count, err := service.ReadAIRequestCount(body, contentType)
	if err != nil { FailError(w, err); return }
	if credits < 0 || credits > int(^uint(0)>>1)/count { Fail(w, "模型计费配置无效"); return }
	credits *= count
	routes, err := service.SelectModelChannelRoutes(modelName)
	if err != nil {
		log.Printf("AI proxy select channel failed: model=%s errorType=%T", modelName, err)
		Fail(w, "AI 接口请求失败")
		return
	}
	meta := service.RequestLogMetaFromRequest(r)
	if err := service.ConsumeUserCreditsWithMeta(user.ID, modelName, credits, path, meta); err != nil {
		FailError(w, err)
		return
	}
	copyAIResponseFromRoutes(w, r.Context(), routes, body, contentType, path, func() {
		if err := service.RefundUserCreditsWithMeta(user.ID, modelName, credits, path, meta); err != nil {
			log.Printf("AI proxy refund credits failed: user=%s model=%s credits=%d errorType=%T", user.ID, modelName, credits, err)
		}
	}, aiProxyContext{Request: r, User: user, Path: path})
}

// ExecuteAIProxyTask executes an upstream AI POST request and returns the response body.
// It is registered with service generation queue so synchronous and queued requests share the same path.
// body is streamed directly to the upstream request to avoid buffering large payloads in memory.
func ExecuteAIProxyTask(ctx context.Context, user model.AuthUser, body io.Reader, contentType string, modelName string, path string) (service.AIProxyResponse, error) {
	routes, err := service.SelectModelChannelRoutes(modelName)
	if err != nil {
		log.Printf("AI proxy select channel failed: model=%s errorType=%T", modelName, err)
		return service.AIProxyResponse{}, err
	}
	payload, err := io.ReadAll(body)
	if err != nil {
		return service.AIProxyResponse{}, err
	}
	var lastStatus int
	var lastErr error
	for _, route := range service.ModelChannelRouteAttempts(routes) {
		requestBody, requestContentType, err := service.RewriteAIRequestModel(payload, contentType, route.UpstreamModel)
		if err != nil {
			lastErr = err
			continue
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, service.BuildModelChannelURL(route.Channel, path), bytes.NewReader(requestBody))
		if err != nil {
			log.Printf("AI proxy build request failed: type=%T", err)
			lastErr = err
			continue
		}
		request.Header.Set("Authorization", "Bearer "+route.Channel.APIKey)
		if requestContentType != "" {
			request.Header.Set("Content-Type", requestContentType)
		}
		response, err := service.AIHTTPClient.Do(request)
		if err != nil {
			log.Printf("AI proxy request failed: path=%s errorType=%T", request.URL.Path, err)
			lastErr = err
			continue
		}
		if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
			_ = response.Body.Close()
			lastStatus = response.StatusCode
			log.Printf("AI upstream error: status=%d", response.StatusCode)
			continue
		}
		responseBody, err := service.ReadAIProxyResponseBody(response.Body, path)
		_ = response.Body.Close()
		if err != nil {
			log.Printf("AI proxy read response failed: path=%s errorType=%T", path, err)
			lastErr = err
			continue
		}
		if path == "/videos" {
			responseBody, err = service.RecordVideoTask(user, route, responseBody)
			if err != nil { return service.AIProxyResponse{}, err }
		}
		responseBody, header, statusCode, err := rewriteCloudAIResponseBody(ctx, user, path, responseBody, response.Header, response.StatusCode)
		if err != nil {
			log.Printf("AI proxy cloud rewrite failed: path=%s errorType=%T", path, err)
			return service.AIProxyResponse{}, err
		}
		return service.AIProxyResponse{StatusCode: statusCode, Header: header, Body: responseBody}, nil
	}
	if lastStatus > 0 {
		return service.AIProxyResponse{}, service.SafeAIError(fmt.Sprintf("AI 接口请求失败：%d", lastStatus))
	}
	if lastErr != nil {
		return service.AIProxyResponse{}, lastErr
	}
	return service.AIProxyResponse{}, service.SafeAIError("AI 接口请求失败")
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
	response, err := service.AIHTTPClient.Do(request)
	if err != nil {
		log.Printf("AI proxy request failed: path=%s errorType=%T", request.URL.Path, err)
		if onFailure != nil {
			onFailure()
		}
		Fail(w, "AI 接口请求失败")
		return
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		log.Printf("AI upstream error: status=%d", response.StatusCode)
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

	copyResponseHeaders(w, response.Header)
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
			log.Printf("AI video cloud transfer failed: path=%s errorType=%T", proxyContext.Path, err)
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
		log.Printf("AI proxy read cloud response failed: path=%s errorType=%T", proxyContext.Path, readErr)
		if onFailure != nil {
			onFailure()
		}
		Fail(w, "云存储转存失败")
		return nil, true
	}
	if isImageResponse {
		rewritten, err := service.StoreImageResponseToCloud(proxyContext.Request.Context(), proxyContext.User, body, proxyContext.Path)
		if err != nil {
			log.Printf("AI image cloud transfer failed: path=%s errorType=%T", proxyContext.Path, err)
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

func copyAIResponseFromRoutes(w http.ResponseWriter, ctx context.Context, routes []service.ModelChannelRoute, body []byte, contentType string, path string, onFailure func(), proxyContext aiProxyContext) {
	var lastStatus int
	var lastErr error
	for _, route := range service.ModelChannelRouteAttempts(routes) {
		requestBody, requestContentType, err := service.RewriteAIRequestModel(body, contentType, route.UpstreamModel)
		if err != nil {
			lastErr = err
			continue
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, service.BuildModelChannelURL(route.Channel, path), bytes.NewReader(requestBody))
		if err != nil {
			log.Printf("AI proxy build request failed: type=%T", err)
			lastErr = err
			continue
		}
		request.Header.Set("Authorization", "Bearer "+route.Channel.APIKey)
		if requestContentType != "" {
			request.Header.Set("Content-Type", requestContentType)
		}
		response, err := service.AIHTTPClient.Do(request)
		if err != nil {
			log.Printf("AI proxy request failed: path=%s errorType=%T", request.URL.Path, err)
			lastErr = err
			continue
		}
		if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
			_ = response.Body.Close()
			lastStatus = response.StatusCode
			log.Printf("AI upstream error: status=%d", response.StatusCode)
			continue
		}
		if path == "/videos" {
			payload, err := service.ReadAIProxyResponseBody(response.Body, path)
			_ = response.Body.Close()
			if err == nil { payload, err = service.RecordVideoTask(proxyContext.User, route, payload) }
			if err != nil { if onFailure != nil { onFailure() }; FailError(w, err); return }
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(payload)
			return
		}
		if cloudResponse, ok := rewriteCloudAIResponse(w, response, proxyContext, onFailure); ok {
			_ = response.Body.Close()
			_, _ = w.Write(cloudResponse)
			return
		}
		copyResponseHeaders(w, response.Header)
		w.WriteHeader(response.StatusCode)
		_, _ = io.Copy(w, response.Body)
		_ = response.Body.Close()
		return
	}
	if onFailure != nil {
		onFailure()
	}
	if lastStatus > 0 {
		Fail(w, fmt.Sprintf("AI 接口请求失败：%d", lastStatus))
		return
	}
	if lastErr != nil {
		log.Printf("AI proxy all routes failed: type=%T", lastErr)
	}
	Fail(w, "AI 接口请求失败")
}

func copyResponseHeaders(w http.ResponseWriter, header http.Header) {
	for key, values := range service.SafeResponseHeaders(header) {
		w.Header()[key] = values
	}
}

func cloneHeader(header http.Header) http.Header {
	return service.SafeResponseHeaders(header)
}

type flushResponseWriter struct { http.ResponseWriter }

func (w flushResponseWriter) Write(body []byte) (int, error) {
	n, err := w.ResponseWriter.Write(body)
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok { flusher.Flush() }
	return n, err
}
