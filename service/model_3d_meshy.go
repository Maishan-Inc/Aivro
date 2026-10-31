package service

import (
	"context"
	"net/http"
	"net/url"
	"strings"

	"github.com/basketikun/aivro/model"
)

type meshyModel3DTask struct {
	ID string `json:"id"`
	Status string `json:"status"`
	ModelURLs struct { GLB string `json:"glb"` } `json:"model_urls"`
}

func requestMeshyModel3D(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	path := "/openapi/v2/text-to-3d"
	payload := map[string]any{"ai_model": route.UpstreamModel, "topology": "triangle", "target_polycount": input.TargetFaceCount, "should_remesh": true}
	if strings.HasPrefix(route.UpstreamModel, "meshy-t2") { payload["model_type"] = "smart-topology" }
	if input.MeshQuality == "high" { payload["geometry_resolution"] = "2k" }
	if input.Mode == "text" {
		payload["mode"], payload["prompt"] = "preview", input.Prompt
	} else {
		images := make([]string, 0, len(input.Images))
		for _, reference := range input.Images {
			image, err := model3DReferenceDataURI(ctx, user, route, reference)
			if err != nil { return Model3DGenerationResult{}, err }
			images = append(images, image)
		}
		path, payload["image_url"] = "/openapi/v1/image-to-3d", images[0]
		if input.Mode == "multi_image" { path = "/openapi/v1/multi-image-to-3d"; delete(payload, "image_url"); payload["image_urls"] = images }
		payload["should_texture"], payload["enable_pbr"] = input.TextureEnabled, input.PBREnabled
		if input.TextureEnabled && input.Prompt != "" { payload["texture_prompt"] = input.Prompt }
	}
	task, err := createMeshyModel3DTask(ctx, route, path, payload)
	if err != nil { return Model3DGenerationResult{}, err }
	if input.Mode == "text" && input.TextureEnabled {
		// Meshy 的文本接口先生成形状，再以 preview_task_id 创建纹理任务。
		task, err = createMeshyModel3DTask(ctx, route, path, map[string]any{"mode": "refine", "preview_task_id": task.ID, "enable_pbr": input.PBREnabled})
		if err != nil { return Model3DGenerationResult{}, err }
	}
	return model3DStoredResult(ctx, user, input, credits, task.ID, task.ModelURLs.GLB)
}

func createMeshyModel3DTask(ctx context.Context, route ModelChannelRoute, path string, input any) (meshyModel3DTask, error) {
	var created struct { Result string `json:"result"` }
	delay, err := model3DJSON(ctx, route, http.MethodPost, path, input, &created, false)
	if err != nil { return meshyModel3DTask{}, err }
	if !validModel3DTaskID(created.Result) { return meshyModel3DTask{}, SafeAIError("上游未返回有效 3D 任务编号") }
	for {
		if err := waitModel3D(ctx, delay); err != nil { return meshyModel3DTask{}, err }
		var task meshyModel3DTask
		delay, err = model3DJSON(ctx, route, http.MethodGet, path+"/"+url.PathEscape(created.Result), nil, &task, true)
		if err != nil { return task, err }
		switch task.Status {
		case "SUCCEEDED": task.ID = created.Result; return task, nil
		case "PENDING", "IN_PROGRESS":
		case "FAILED", "CANCELED": return task, SafeAIError("3D 上游任务失败或已取消")
		default: return task, SafeAIError("3D 接口返回格式错误")
		}
	}
}
