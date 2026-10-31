package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
)

type hunyuanModel3DTask struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
	Output struct { FileURL string `json:"file_url"` } `json:"output"`
}

func validateHunyuanModel3DInput(input Model3DGenerationInput) error {
	if input.Mode != "image" || len(input.Images) != 1 || input.Quantity != 1 {
		return SafeAIError("当前 3D 接口仅支持单张图片生成一个模型")
	}
	if input.PBREnabled || input.TargetFaceCount != 500000 {
		return SafeAIError("当前 3D 接口不支持 PBR 材质或自定义目标面数")
	}
	return nil
}

func requestHunyuanModel3D(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	if err := validateHunyuanModel3DInput(input); err != nil { return Model3DGenerationResult{}, err }
	image, contentType, err := readModel3DReference(ctx, user, input.Images[0])
	if err != nil { return Model3DGenerationResult{}, err }
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	steps, resolution := "5", "128"
	switch input.MeshQuality {
	case "high": steps, resolution = "20", "256"
	case "ultra": steps, resolution = "50", "400"
	}
	fields := map[string]string{
		"model": route.UpstreamModel, "texture": fmt.Sprint(input.TextureEnabled),
		"num_inference_steps": steps, "octree_resolution": resolution,
		"guidance_scale": "5", "seed": "1234",
	}
	if route.UpstreamModel == "Hunyuan3D-2" { fields["type"] = "glb" } else { fields["file_format"] = "glb" }
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil { return Model3DGenerationResult{}, err }
	}
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {mime.FormatMediaType("form-data", map[string]string{"name": "image", "filename": "reference" + mediaExtension(contentType, ".png")})},
		"Content-Type": {contentType},
	})
	if err != nil { return Model3DGenerationResult{}, err }
	if _, err := part.Write(image); err != nil { return Model3DGenerationResult{}, err }
	if err := writer.Close(); err != nil { return Model3DGenerationResult{}, err }
	task, err := requestHunyuanModel3DTask(ctx, route.Channel, http.MethodPost, "/task/gi/image-to-3d", &body, writer.FormDataContentType())
	if err != nil { return Model3DGenerationResult{}, err }
	id := strings.TrimSpace(task.TaskID)
	if id == "" || strings.ContainsAny(id, "/\\?#") || id == "." || id == ".." {
		return Model3DGenerationResult{}, SafeAIError("上游未返回有效 3D 任务编号")
	}
	ticker := time.NewTicker(2500 * time.Millisecond)
	defer ticker.Stop()
	for {
		switch strings.ToLower(strings.TrimSpace(task.Status)) {
		case "success":
			if strings.TrimSpace(task.Output.FileURL) == "" { return Model3DGenerationResult{}, SafeAIError("上游未返回可下载的 3D 模型，请稍后重试") }
			asset, err := storeRemoteModel3D(ctx, user, task.Output.FileURL, input.Model)
			if err != nil { return Model3DGenerationResult{}, err }
			return Model3DGenerationResult{ProviderTaskID: id, EnergyCost: credits, Results: []Model3DGeneratedAsset{asset}}, nil
		case "failed", "failure", "error", "canceled", "cancelled":
			return Model3DGenerationResult{}, SafeAIError("3D 上游任务失败或已取消")
		case "":
			return Model3DGenerationResult{}, SafeAIError("3D 接口返回格式错误")
		}
		select {
		case <-ctx.Done(): return Model3DGenerationResult{}, ctx.Err()
		case <-ticker.C:
		}
		task, err = requestHunyuanModel3DTask(ctx, route.Channel, http.MethodGet, "/task/"+url.PathEscape(id), nil, "")
		if err != nil { return Model3DGenerationResult{}, err }
	}
}

func requestHunyuanModel3DTask(ctx context.Context, channel model.ModelChannel, method, path string, body io.Reader, contentType string) (hunyuanModel3DTask, error) {
	// GPT.GE 的任务接口位于 /task，不能追加 OpenAI 的 /v1。
	endpoint, err := url.Parse(normalizeModelChannelBaseURL(channel.BaseURL))
	if err != nil { return hunyuanModel3DTask{}, err }
	endpoint.Path = strings.TrimSuffix(strings.TrimRight(endpoint.Path, "/"), "/v1")
	endpoint.RawPath = ""
	request, err := http.NewRequestWithContext(ctx, method, endpoint.JoinPath(path).String(), body)
	if err != nil { return hunyuanModel3DTask{}, err }
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	if contentType != "" { request.Header.Set("Content-Type", contentType) }
	failure := "3D 生成请求失败"
	if method == http.MethodGet { failure = "3D 任务查询失败" }
	response, err := AIHTTPClientForContext(ctx).Do(request)
	if err != nil { return hunyuanModel3DTask{}, SafeAIError(failure) }
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		log.Printf("model3d upstream error: method=%s status=%d", method, response.StatusCode)
		return hunyuanModel3DTask{}, SafeAIError(fmt.Sprintf("%s（HTTP %d）", failure, response.StatusCode))
	}
	payload, err := readLimited(response.Body, 4<<20, "3D 接口响应过大")
	if err != nil { return hunyuanModel3DTask{}, err }
	var task hunyuanModel3DTask
	if err := json.Unmarshal(payload, &task); err != nil { return task, SafeAIError("3D 接口返回格式错误") }
	return task, nil
}

func readModel3DReference(ctx context.Context, user model.AuthUser, reference Model3DGenerationReference) ([]byte, string, error) {
	id := cloudID("", reference.StorageKey)
	if id == "" {
		if parsed, err := url.Parse(reference.URL); err == nil && strings.HasPrefix(parsed.Path, "/api/files/") && strings.HasSuffix(parsed.Path, "/content") {
			id = strings.TrimSuffix(strings.TrimPrefix(parsed.Path, "/api/files/"), "/content")
		}
	}
	if id != "" {
		file, reader, err := GetFileContent(ctx, user, id, "")
		if err != nil { return nil, "", err }
		defer reader.Close()
		if file.FileType != model.CloudFileTypeImage { return nil, "", SafeAIError("请上传参考图片") }
		body, err := readLimited(reader, maxUserUploadBytes, "参考图片文件过大")
		return body, file.ContentType, err
	}
	body, contentType, _, err := imageItemBytes(ctx, map[string]any{"url": reference.URL})
	if err != nil { return nil, "", err }
	if len(body) == 0 || !strings.HasPrefix(contentType, "image/") { return nil, "", SafeAIError("请上传参考图片") }
	return body, contentType, nil
}
