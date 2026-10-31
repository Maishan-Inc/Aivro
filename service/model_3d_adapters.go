package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/basketikun/aivro/model"
)

func model3DCapabilities(route ModelChannelRoute) model.Model3DCapabilities {
	c := model.Model3DCapabilities{Modes: []string{"text", "image", "multi_image"}, MaxImages: 4, MaxQuantity: 1, Texture: true, PBR: true, Qualities: []string{"standard"}, DefaultFaces: 500000, PromptMaxLength: 1024, ImageMaxBytes: 10 << 20}
	switch route.Adapter {
	case "":
		c.MaxQuantity, c.MaxImages, c.MinFaces, c.MaxFaces = 4, 0, 500000, 1000000
		c.Qualities = []string{"standard", "high", "ultra"}
	case model.Model3DAdapterHunyuan:
		c.Modes, c.MaxImages, c.PBR = []string{"image"}, 1, false
		c.Qualities, c.PromptMaxLength, c.ImageMaxBytes = []string{"standard", "high", "ultra"}, 0, maxUserUploadBytes
	case model.Model3DAdapterMeshy:
		c.MinFaces, c.MaxFaces, c.DefaultFaces, c.PromptMaxLength = 100, 300000, 30000, 800
		switch route.UpstreamModel {
		case "latest", "meshy-7.1": c.Qualities = []string{"standard", "high"}
		case "meshy-t2", "meshy-t2.5":
			c.Modes, c.MaxImages, c.MaxFaces, c.DefaultFaces = []string{"text", "image"}, 1, 30000, 15000
			if route.UpstreamModel == "meshy-t2" { c.MaxFaces, c.DefaultFaces = 15000, 4000 }
		}
	case model.Model3DAdapterTripo:
		c.MinFaces, c.MaxFaces = 1000, 1000000
		c.Qualities, c.ReferenceViews = []string{"standard", "ultra"}, []string{"front", "left", "back", "right"}
		if route.UpstreamModel == "P1-20260311" { c.MinFaces, c.MaxFaces, c.DefaultFaces, c.Qualities = 48, 20000, 4000, []string{"standard"} }
	case model.Model3DAdapterRodin:
		c.MaxImages, c.MinFaces, c.MaxFaces = 5, 500, 1000000
		if route.UpstreamModel == "Gen-2.5-High" || route.UpstreamModel == "Gen-2.5-Extreme-High" { c.MaxFaces = 2000000 }
	case model.Model3DAdapterFalHunyuan:
		c.MaxImages, c.MinFaces, c.MaxFaces, c.ImageMaxBytes = 8, 40000, 1500000, 6 << 20
		c.ReferenceViews = []string{"front", "left", "back", "right", "top", "bottom", "left_front", "right_front"}
	case model.Model3DAdapterFalTrellis:
		c.Modes, c.MaxImages, c.Texture, c.PBR, c.AlwaysTexture = []string{"image"}, 1, false, false, true
		c.Qualities, c.PromptMaxLength = []string{"standard", "high", "ultra"}, 0
	}
	return c
}

func validateModel3DAdapterInput(route ModelChannelRoute, input Model3DGenerationInput) error {
	if route.Adapter == "" { return nil }
	validModel := false
	switch route.Adapter {
	case model.Model3DAdapterHunyuan: validModel = slices.Contains([]string{"Hunyuan3D-2", "Hi3DGen", "Step1X-3D"}, route.UpstreamModel)
	case model.Model3DAdapterMeshy: validModel = slices.Contains([]string{"latest", "meshy-7.1", "meshy-6", "meshy-6-lite", "meshy-t2", "meshy-t2.5"}, route.UpstreamModel)
	case model.Model3DAdapterTripo: validModel = slices.Contains([]string{"v3.1-20260211", "v3.0-20250812", "P1-20260311"}, route.UpstreamModel)
	case model.Model3DAdapterRodin: validModel = slices.Contains([]string{"Gen-2.5-Extreme-Low", "Gen-2.5-Low", "Gen-2.5-Medium", "Gen-2.5-High", "Gen-2.5-Extreme-High"}, route.UpstreamModel)
	case model.Model3DAdapterFalHunyuan: validModel = route.UpstreamModel == "fal-ai/hunyuan-3d/v3.1/pro"
	case model.Model3DAdapterFalTrellis: validModel = route.UpstreamModel == "fal-ai/trellis-2"
	}
	if !validModel { return SafeAIError("3D 适配方式与上游模型不匹配，请检查渠道配置") }
	c := model3DCapabilities(route)
	if !slices.Contains(c.Modes, input.Mode) { return SafeAIError("当前 3D 模型不支持此生成模式") }
	if input.Quantity != 1 { return SafeAIError("当前 3D 接口每次只能生成一个模型") }
	if input.Mode == "image" && len(input.Images) != 1 || input.Mode == "multi_image" && (len(input.Images) < 2 || len(input.Images) > c.MaxImages) {
		maxImages := c.MaxImages
		if input.Mode == "image" { maxImages = 1 }
		return SafeAIError(fmt.Sprintf("当前模式的参考图片数量不符合要求（最多 %d 张）", maxImages))
	}
	if !slices.Contains(c.Qualities, input.MeshQuality) { return SafeAIError("当前 3D 模型不支持此网格质量") }
	if !c.Texture && input.TextureEnabled != c.AlwaysTexture || input.PBREnabled && (!c.PBR || !input.TextureEnabled) {
		return SafeAIError("当前 3D 模型不支持此纹理或 PBR 设置")
	}
	if c.MaxFaces == 0 && input.TargetFaceCount != c.DefaultFaces || c.MaxFaces > 0 && (input.TargetFaceCount < c.MinFaces || input.TargetFaceCount > c.MaxFaces) {
		return SafeAIError("目标面数超出当前 3D 模型的支持范围")
	}
	if c.PromptMaxLength > 0 && (input.Mode == "text" || route.Adapter == model.Model3DAdapterMeshy && input.TextureEnabled) && utf8.RuneCountInString(input.Prompt) > c.PromptMaxLength {
		return SafeAIError(fmt.Sprintf("模型描述不能超过 %d 个字符", c.PromptMaxLength))
	}
	return nil
}

func model3DProviderURL(route ModelChannelRoute, path string) string {
	base := normalizeModelChannelBaseURL(route.Channel.BaseURL)
	endpoint, err := url.Parse(base)
	if err != nil { return base }
	endpoint.Path = strings.TrimRight(endpoint.Path, "/")
	var suffixes []string
	switch route.Adapter {
	case model.Model3DAdapterMeshy: suffixes = []string{"/openapi/v2", "/openapi/v1", "/openapi"}
	case model.Model3DAdapterTripo: suffixes = []string{"/v2/openapi"}
	case model.Model3DAdapterRodin: suffixes = []string{"/api/v2"}
	}
	for _, suffix := range suffixes { if strings.HasSuffix(endpoint.Path, suffix) { endpoint.Path = strings.TrimSuffix(endpoint.Path, suffix); break } }
	endpoint.Path, endpoint.RawPath = strings.TrimSuffix(endpoint.Path, "/v1"), ""
	if strings.HasPrefix(route.Adapter, "fal-") && endpoint.Host == "fal.run" { endpoint.Host = "queue.fal.run" }
	return endpoint.JoinPath(path).String()
}

func model3DJSON(ctx context.Context, route ModelChannelRoute, method, path string, input, output any, polling bool) (time.Duration, error) {
	var body []byte
	var err error
	if input != nil { body, err = json.Marshal(input); if err != nil { return 0, err } }
	return model3DRequest(ctx, route, method, path, body, "application/json", output, polling)
}

func model3DRequest(ctx context.Context, route ModelChannelRoute, method, path string, body []byte, contentType string, output any, polling bool) (time.Duration, error) {
	failure := "3D 生成请求失败"
	if polling { failure = "3D 任务查询失败" }
	for {
		request, err := http.NewRequestWithContext(ctx, method, model3DProviderURL(route, path), bytes.NewReader(body))
		if err != nil { return 0, err }
		scheme := "Bearer "
		if strings.HasPrefix(route.Adapter, "fal-") { scheme = "Key " }
		request.Header.Set("Authorization", scheme+route.Channel.APIKey)
		if len(body) > 0 { request.Header.Set("Content-Type", contentType) }
		response, err := AIHTTPClientForContext(ctx).Do(request)
		delay := 5 * time.Second
		if err != nil {
			if !polling { return 0, SafeAIError(failure) }
			if err := waitModel3D(ctx, delay); err != nil { return 0, err }
			continue
		}
		if seconds, err := strconv.Atoi(response.Header.Get("Retry-After")); err == nil && seconds > 0 { delay = time.Duration(seconds) * time.Second
		} else if retryAt, err := http.ParseTime(response.Header.Get("Retry-After")); err == nil && time.Until(retryAt) > delay { delay = time.Until(retryAt) }
		if polling && (response.StatusCode == http.StatusTooManyRequests || response.StatusCode >= 500) {
			_ = response.Body.Close()
			if err := waitModel3D(ctx, delay); err != nil { return 0, err }
			continue
		}
		payload, readErr := readLimited(response.Body, 4<<20, "3D 接口响应过大")
		_ = response.Body.Close()
		if response.StatusCode < 200 || response.StatusCode >= 300 { return 0, SafeAIError(fmt.Sprintf("%s（HTTP %d）", failure, response.StatusCode)) }
		if readErr != nil { return 0, readErr }
		if err := json.Unmarshal(payload, output); err != nil { return 0, SafeAIError("3D 接口返回格式错误") }
		return delay, nil
	}
}

func waitModel3D(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select { case <-ctx.Done(): return ctx.Err(); case <-timer.C: return nil }
}

func validModel3DTaskID(id string) bool { return id != "" && id != "." && id != ".." && !strings.ContainsAny(id, "/\\?#\r\n") }

func model3DReferenceBytes(ctx context.Context, user model.AuthUser, route ModelChannelRoute, reference Model3DGenerationReference) ([]byte, string, error) {
	body, contentType, err := readModel3DReference(ctx, user, reference)
	if err != nil { return nil, "", err }
	if int64(len(body)) > model3DCapabilities(route).ImageMaxBytes { return nil, "", SafeAIError("参考图片超过当前 3D 接口的大小限制") }
	if !slices.Contains([]string{"image/png", "image/jpeg", "image/webp"}, contentType) { return nil, "", SafeAIError("当前 3D 接口仅支持 PNG、JPEG 或 WebP 图片") }
	return body, contentType, nil
}

func model3DReferenceDataURI(ctx context.Context, user model.AuthUser, route ModelChannelRoute, reference Model3DGenerationReference) (string, error) {
	body, contentType, err := model3DReferenceBytes(ctx, user, route, reference)
	if err != nil { return "", err }
	return "data:"+contentType+";base64,"+base64.StdEncoding.EncodeToString(body), nil
}

func writeModel3DImage(writer *multipart.Writer, field, contentType string, body []byte) error {
	part, err := writer.CreatePart(textproto.MIMEHeader{"Content-Disposition": {mime.FormatMediaType("form-data", map[string]string{"name": field, "filename": "reference"+mediaExtension(contentType, ".png")})}, "Content-Type": {contentType}})
	if err != nil { return err }
	_, err = part.Write(body)
	return err
}

func model3DStoredResult(ctx context.Context, user model.AuthUser, input Model3DGenerationInput, credits int, id, modelURL string) (Model3DGenerationResult, error) {
	if strings.TrimSpace(modelURL) == "" { return Model3DGenerationResult{}, SafeAIError("上游未返回可下载的 3D 模型，请稍后重试") }
	asset, err := storeRemoteModel3D(ctx, user, modelURL, input.Model)
	if err != nil { return Model3DGenerationResult{}, err }
	return Model3DGenerationResult{ProviderTaskID: id, EnergyCost: credits, Results: []Model3DGeneratedAsset{asset}}, nil
}
