package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/basketikun/aivro/model"
)

func requestFalModel3D(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	endpoint := route.UpstreamModel
	payload := map[string]any{}
	if route.Adapter == model.Model3DAdapterFalTrellis {
		image, err := model3DReferenceDataURI(ctx, user, route, input.Images[0])
		if err != nil { return Model3DGenerationResult{}, err }
		payload["image_url"] = image
		payload["resolution"] = map[string]string{"standard": "512", "high": "1024", "ultra": "1536"}[input.MeshQuality]
	} else {
		payload["generate_type"], payload["enable_pbr"], payload["face_count"] = "Normal", input.PBREnabled, input.TargetFaceCount
		if !input.TextureEnabled { payload["generate_type"] = "Geometry" }
		if input.Mode == "text" {
			endpoint += "/text-to-3d"
			payload["prompt"] = input.Prompt
		} else {
			endpoint += "/image-to-3d"
			fields := []string{"input_image_url", "left_image_url", "back_image_url", "right_image_url", "top_image_url", "bottom_image_url", "left_front_image_url", "right_front_image_url"}
			for index, reference := range input.Images {
				image, err := model3DReferenceDataURI(ctx, user, route, reference)
				if err != nil { return Model3DGenerationResult{}, err }
				payload[fields[index]] = image
			}
		}
	}
	var created struct { RequestID string `json:"request_id"` }
	delay, err := model3DJSON(ctx, route, http.MethodPost, "/"+endpoint, payload, &created, false)
	if err != nil { return Model3DGenerationResult{}, err }
	if !validModel3DTaskID(created.RequestID) { return Model3DGenerationResult{}, SafeAIError("上游未返回有效 3D 任务编号") }
	// fal 的队列查询使用两段模型根路径，鉴权仅发送至已配置的渠道。
	parts := strings.Split(route.UpstreamModel, "/")
	resultPath := "/"+strings.Join(parts[:2], "/")+"/requests/"+url.PathEscape(created.RequestID)
	for {
		if err := waitModel3D(ctx, delay); err != nil { return Model3DGenerationResult{}, err }
		var status struct { Status string `json:"status"`; Error json.RawMessage `json:"error"` }
		delay, err = model3DJSON(ctx, route, http.MethodGet, resultPath+"/status", nil, &status, true)
		if err != nil { return Model3DGenerationResult{}, err }
		if len(status.Error) > 0 && string(status.Error) != "null" && string(status.Error) != "\"\"" { return Model3DGenerationResult{}, SafeAIError("3D 上游任务失败或已取消") }
		switch status.Status {
		case "COMPLETED":
		case "IN_QUEUE", "IN_PROGRESS": continue
		default: return Model3DGenerationResult{}, SafeAIError("3D 接口返回格式错误")
		}
		break
	}
	var result struct {
		ModelGLB struct { URL string `json:"url"` } `json:"model_glb"`
		ModelURLs struct { GLB struct { URL string `json:"url"` } `json:"glb"` } `json:"model_urls"`
	}
	if _, err := model3DJSON(ctx, route, http.MethodGet, resultPath, nil, &result, true); err != nil { return Model3DGenerationResult{}, err }
	return model3DStoredResult(ctx, user, input, credits, created.RequestID, firstNonEmpty(result.ModelGLB.URL, result.ModelURLs.GLB.URL))
}
