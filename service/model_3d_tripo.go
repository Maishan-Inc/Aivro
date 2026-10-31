package service

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/url"

	"github.com/basketikun/aivro/model"
)

type tripoModel3DResponse struct {
	Code int `json:"code"`
	Data struct {
		TaskID string `json:"task_id"`
		ImageToken string `json:"image_token"`
		Status string `json:"status"`
		Output struct {
			Model string `json:"model"`
			PBRModel string `json:"pbr_model"`
			BaseModel string `json:"base_model"`
		} `json:"output"`
	} `json:"data"`
}

func requestTripoModel3D(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	payload := map[string]any{"type": "text_to_model", "model_version": route.UpstreamModel, "face_limit": input.TargetFaceCount, "texture": input.TextureEnabled, "pbr": input.PBREnabled}
	if route.UpstreamModel != "P1-20260311" {
		payload["geometry_quality"] = "standard"
		if input.MeshQuality == "ultra" { payload["geometry_quality"] = "detailed" }
	}
	if input.Mode == "text" { payload["prompt"] = input.Prompt } else {
		files := make([]map[string]string, 0, len(input.Images))
		for _, reference := range input.Images {
			image, contentType, err := model3DReferenceBytes(ctx, user, route, reference)
			if err != nil { return Model3DGenerationResult{}, err }
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			if err := writeModel3DImage(writer, "file", contentType, image); err != nil { return Model3DGenerationResult{}, err }
			if err := writer.Close(); err != nil { return Model3DGenerationResult{}, err }
			var uploaded tripoModel3DResponse
			if _, err := model3DRequest(ctx, route, http.MethodPost, "/v2/openapi/upload/sts", body.Bytes(), writer.FormDataContentType(), &uploaded, false); err != nil { return Model3DGenerationResult{}, err }
			if uploaded.Code != 0 || uploaded.Data.ImageToken == "" { return Model3DGenerationResult{}, SafeAIError("3D 参考图片上传失败") }
			files = append(files, map[string]string{"type": map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[contentType], "file_token": uploaded.Data.ImageToken})
		}
		payload["type"], payload["file"] = "image_to_model", files[0]
		if input.Mode == "multi_image" {
			// 顺序固定为正面、左侧、背面、右侧，缺少的末尾视角用空对象占位。
			for len(files) < 4 { files = append(files, map[string]string{}) }
			payload["type"], payload["files"] = "multiview_to_model", files
			delete(payload, "file")
		}
	}
	var created tripoModel3DResponse
	delay, err := model3DJSON(ctx, route, http.MethodPost, "/v2/openapi/task", payload, &created, false)
	if err != nil { return Model3DGenerationResult{}, err }
	if created.Code != 0 || !validModel3DTaskID(created.Data.TaskID) { return Model3DGenerationResult{}, SafeAIError("上游未返回有效 3D 任务编号") }
	for {
		if err := waitModel3D(ctx, delay); err != nil { return Model3DGenerationResult{}, err }
		var task tripoModel3DResponse
		delay, err = model3DJSON(ctx, route, http.MethodGet, "/v2/openapi/task/"+url.PathEscape(created.Data.TaskID), nil, &task, true)
		if err != nil { return Model3DGenerationResult{}, err }
		if task.Code != 0 { return Model3DGenerationResult{}, SafeAIError("3D 任务查询失败") }
		switch task.Data.Status {
		case "success":
			modelURL := task.Data.Output.Model
			if input.PBREnabled { modelURL = firstNonEmpty(task.Data.Output.PBRModel, modelURL) }
			if !input.TextureEnabled { modelURL = firstNonEmpty(task.Data.Output.BaseModel, modelURL) }
			return model3DStoredResult(ctx, user, input, credits, created.Data.TaskID, modelURL)
		case "queued", "running":
		case "failed", "banned", "expired", "cancelled", "unknown": return Model3DGenerationResult{}, SafeAIError("3D 上游任务失败或已取消")
		default: return Model3DGenerationResult{}, SafeAIError("3D 接口返回格式错误")
		}
	}
}
