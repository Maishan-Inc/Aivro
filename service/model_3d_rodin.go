package service

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
)

func requestRodinModel3D(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	material := "None"
	if input.TextureEnabled { material = "Shaded" }
	if input.PBREnabled { material = "PBR" }
	fields := map[string]string{"tier": route.UpstreamModel, "geometry_file_format": "glb", "mesh_mode": "Raw", "material": material, "quality_override": strconv.Itoa(input.TargetFaceCount)}
	if input.Mode == "text" { fields["prompt"] = input.Prompt }
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil { return Model3DGenerationResult{}, err }
	}
	if input.Mode != "text" {
		for _, reference := range input.Images {
			image, contentType, err := model3DReferenceBytes(ctx, user, route, reference)
			if err != nil { return Model3DGenerationResult{}, err }
			if err := writeModel3DImage(writer, "images", contentType, image); err != nil { return Model3DGenerationResult{}, err }
		}
	}
	if err := writer.Close(); err != nil { return Model3DGenerationResult{}, err }
	var created struct {
		UUID string `json:"uuid"`
		Error string `json:"error"`
		Jobs struct { SubscriptionKey string `json:"subscription_key"` } `json:"jobs"`
	}
	delay, err := model3DRequest(ctx, route, http.MethodPost, "/api/v2/rodin", body.Bytes(), writer.FormDataContentType(), &created, false)
	if err != nil { return Model3DGenerationResult{}, err }
	if created.Error != "" { return Model3DGenerationResult{}, SafeAIError("3D 生成请求失败") }
	if !validModel3DTaskID(created.UUID) || created.Jobs.SubscriptionKey == "" { return Model3DGenerationResult{}, SafeAIError("上游未返回有效 3D 任务编号") }
	interval := 5 * time.Second
	for {
		if err := waitModel3D(ctx, max(interval, delay)); err != nil { return Model3DGenerationResult{}, err }
		var status struct {
			Error string `json:"error"`
			Jobs []struct { Status string `json:"status"` } `json:"jobs"`
		}
		delay, err = model3DJSON(ctx, route, http.MethodPost, "/api/v2/status", map[string]string{"subscription_key": created.Jobs.SubscriptionKey}, &status, true)
		if err != nil { return Model3DGenerationResult{}, err }
		if status.Error != "" { return Model3DGenerationResult{}, SafeAIError("3D 任务查询失败") }
		done := len(status.Jobs) > 0
		for _, job := range status.Jobs {
			switch job.Status {
			case "Done":
			case "Waiting", "Generating": done = false
			case "Failed": return Model3DGenerationResult{}, SafeAIError("3D 上游任务失败或已取消")
			default: return Model3DGenerationResult{}, SafeAIError("3D 接口返回格式错误")
			}
		}
		if done { break }
		interval = min(interval+5*time.Second, 30*time.Second)
	}
	var download struct {
		Error string `json:"error"`
		List []struct { Name string `json:"name"`; URL string `json:"url"` } `json:"list"`
	}
	if _, err := model3DJSON(ctx, route, http.MethodPost, "/api/v2/download", map[string]string{"task_uuid": created.UUID}, &download, true); err != nil { return Model3DGenerationResult{}, err }
	if download.Error != "" { return Model3DGenerationResult{}, SafeAIError("3D 任务查询失败") }
	for _, file := range download.List {
		if strings.HasSuffix(strings.ToLower(file.Name), ".glb") { return model3DStoredResult(ctx, user, input, credits, created.UUID, file.URL) }
	}
	return Model3DGenerationResult{}, SafeAIError("上游未返回可下载的 3D 模型，请稍后重试")
}
