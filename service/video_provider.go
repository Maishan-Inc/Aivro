package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/basketikun/aivro/model"
)

type videoProviderResult struct {
	Code int `json:"code"`
	ID string `json:"id"`
	TaskID string `json:"task_id"`
	RequestID string `json:"request_id"`
	Status json.RawMessage `json:"status"`
	State string `json:"state"`
	FileID string `json:"file_id"`
	Error json.RawMessage `json:"error"`
	ErrCode string `json:"err_code"`
	BaseResp struct { StatusCode int `json:"status_code"` } `json:"base_resp"`
	Data struct {
		TaskID string `json:"task_id"`
		TaskStatus string `json:"task_status"`
		Status string `json:"status"`
		VideoURL string `json:"video_url"`
		TaskResult struct { Videos []struct { URL string `json:"url"` } `json:"videos"` } `json:"task_result"`
	} `json:"data"`
	Output struct { TaskID string `json:"task_id"`; TaskStatus string `json:"task_status"`; VideoURL string `json:"video_url"` } `json:"output"`
	Content struct { VideoURL string `json:"video_url"` } `json:"content"`
	Video struct { URL string `json:"url"` } `json:"video"`
	File struct { DownloadURL string `json:"download_url"` } `json:"file"`
	Creations []struct { URL string `json:"url"` } `json:"creations"`
}

func (r videoProviderResult) validate(adapter string) error {
	expectedCode := 0
	if adapter == model.VideoAdapterJimeng { expectedCode = 10000 }
	if r.Code != expectedCode || r.BaseResp.StatusCode != 0 || r.ErrCode != "" || (len(r.Error) > 0 && string(r.Error) != "null" && string(r.Error) != "\"\"") { return SafeAIError("视频上游任务失败或已取消") }
	return nil
}

func requestAdaptedVideo(ctx context.Context, user model.AuthUser, route ModelChannelRoute, input VideoGenerationInput) (string, string, error) {
	images := make([]string, 0, len(input.Images))
	for _, reference := range input.Images {
		imageURL, err := videoReferenceURL(ctx, user, reference)
		if err != nil { return "", "", err }
		images = append(images, imageURL)
	}
	path, payload := videoProviderInput(route, input, images)
	var created videoProviderResult
	delay, err := videoJSON(ctx, route, http.MethodPost, path, payload, &created, false)
	if err != nil { return "", "", err }
	if err := created.validate(route.Adapter); err != nil { return "", "", err }
	id := firstNonEmpty(created.TaskID, created.Data.TaskID, created.Output.TaskID, created.ID)
	if strings.HasPrefix(route.Adapter, "fal-") { id = created.RequestID }
	if !validModel3DTaskID(id) { return "", "", SafeAIError("上游未返回有效视频任务编号") }
	queryPath := "/task/"+url.PathEscape(id)
	fal := strings.HasPrefix(route.Adapter, "fal-")
	if fal {
		parts := strings.Split(route.UpstreamModel, "/")
		queryPath = "/"+strings.Join(parts[:2], "/")+"/requests/"+url.PathEscape(id)
	}
	if route.Adapter == model.VideoAdapterArkSeedance { queryPath = "/api/v3/contents/generations/tasks/"+url.PathEscape(id) }
	for {
		if err := waitModel3D(ctx, delay); err != nil { return id, "", err }
		var result videoProviderResult
		statusPath := queryPath
		if fal { statusPath += "/status" }
		delay, err = videoJSON(ctx, route, http.MethodGet, statusPath, nil, &result, true)
		if err != nil { return id, "", err }
		if err := result.validate(route.Adapter); err != nil { return id, "", err }
		var rootStatus string
		_ = json.Unmarshal(result.Status, &rootStatus)
		status := strings.ToLower(firstNonEmpty(result.Data.TaskStatus, result.Data.Status, result.Output.TaskStatus, rootStatus, result.State))
		switch status {
		case "submitted", "pending", "running", "processing", "queueing", "queued", "created", "in_queue", "in_progress", "generating": continue
		case "succeed", "succeeded", "success", "done", "completed":
		case "failed", "fail", "canceled", "cancelled", "expired", "not_found": return id, "", SafeAIError("视频上游任务失败或已取消")
		default: return id, "", SafeAIError("视频接口返回格式错误")
		}
		if fal {
			if _, err := videoJSON(ctx, route, http.MethodGet, queryPath, nil, &result, true); err != nil { return id, "", err }
			if err := result.validate(route.Adapter); err != nil { return id, "", err }
		}
		if route.Adapter == model.VideoAdapterHailuo {
			if result.FileID == "" { return id, "", SafeAIError("上游未返回有效视频文件") }
			if _, err := videoJSON(ctx, route, http.MethodGet, "/task/minimax/v1/files/retrieve?file_id="+url.QueryEscape(result.FileID), nil, &result, true); err != nil { return id, "", err }
			if err := result.validate(route.Adapter); err != nil { return id, "", err }
		}
		videoURL := firstNonEmpty(result.Data.VideoURL, result.Output.VideoURL, result.Content.VideoURL, result.Video.URL, result.File.DownloadURL)
		if len(result.Data.TaskResult.Videos) > 0 { videoURL = result.Data.TaskResult.Videos[0].URL }
		if len(result.Creations) > 0 { videoURL = result.Creations[0].URL }
		if !IsPublicHTTPURL(videoURL) { return id, "", SafeAIError("上游未返回有效视频地址") }
		return id, videoURL, nil
	}
}

func videoProviderInput(route ModelChannelRoute, input VideoGenerationInput, images []string) (string, map[string]any) {
	seconds, _ := input.Seconds.Int64()
	payload := map[string]any{"model": route.UpstreamModel, "prompt": input.Prompt, "duration": seconds}
	path := ""
	switch route.Adapter {
	case model.VideoAdapterKling:
		path = "/task/kling/v1/videos/text2video"
		payload = map[string]any{"model_name": route.UpstreamModel, "prompt": input.Prompt, "duration": input.Seconds.String(), "mode": "std", "aspect_ratio": input.Size}
		if len(images) > 0 {
			path = "/task/kling/v1/videos/image2video"
			delete(payload, "model_name"); delete(payload, "aspect_ratio")
			payload["model"], payload["image"] = route.UpstreamModel, images[0]
		}
	case model.VideoAdapterJimeng:
		path = "/task/jimeng/text2video"
		payload = map[string]any{"req_key": route.UpstreamModel, "prompt": input.Prompt, "seed": -1, "frames": seconds*24+1, "aspect_ratio": input.Size}
		if len(images) > 0 { path = "/task/jimeng/image2video"; payload["image_urls"] = images; delete(payload, "aspect_ratio") }
	case model.VideoAdapterBailian:
		path = "/task/bailian/v1/videos"
		content := map[string]any{"prompt": input.Prompt}
		if len(images) > 0 {
			media := make([]map[string]string, 0, len(images))
			kind := "first_frame"
			if strings.HasSuffix(route.UpstreamModel, "-r2v") { kind = "reference_image" }
			for _, image := range images { media = append(media, map[string]string{"type": kind, "url": image}) }
			content["media"] = media
		}
		parameters := map[string]any{"resolution": strings.ToUpper(input.Resolution), "ratio": input.Size, "duration": seconds}
		if strings.HasSuffix(route.UpstreamModel, "-i2v") { delete(parameters, "ratio") }
		payload = map[string]any{"model": route.UpstreamModel, "input": content, "parameters": parameters}
	case model.VideoAdapterVidu:
		path = "/task/vidu/v2/text2video"
		payload["resolution"], payload["aspect_ratio"], payload["style"] = input.Resolution, input.Size, "general"
		if len(images) > 0 {
			path = "/task/vidu/v2/img2video"
			if len(images) == 2 { path = "/task/vidu/v2/start-end2video" }
			if len(images) > 2 { path = "/task/vidu/v2/reference2video" }
			payload["images"] = images
			delete(payload, "style"); delete(payload, "aspect_ratio")
		}
	case model.VideoAdapterSeedance, model.VideoAdapterArkSeedance:
		path = "/task/volces/seedance"
		if route.Adapter == model.VideoAdapterArkSeedance { path = "/api/v3/contents/generations/tasks" }
		content := []map[string]any{{"type": "text", "text": input.Prompt}}
		for i, image := range images {
			role := "first_frame"
			if i == 1 { role = "last_frame" }
			content = append(content, map[string]any{"type": "image_url", "image_url": map[string]string{"url": image}, "role": role})
		}
		payload = map[string]any{"model": route.UpstreamModel, "content": content, "duration": seconds, "resolution": input.Resolution, "ratio": input.Size}
	case model.VideoAdapterHailuo:
		path = "/task/minimax/v1/video_generation"
		payload["resolution"] = strings.ToUpper(input.Resolution)
		if len(images) > 0 { payload["first_frame_image"] = images[0] }
		if len(images) > 1 { payload["last_frame_image"] = images[1] }
	default:
		path = "/"+route.UpstreamModel
		delete(payload, "model")
		payload["aspect_ratio"], payload["resolution"] = input.Size, input.Resolution
		if route.Adapter == model.VideoAdapterFalVeo {
			payload["duration"] = input.Seconds.String()+"s"
			if len(images) == 0 { payload["auto_fix"] = false }
		} else {
			if len(images) == 0 { path += "/text-to-video" }
			if route.Adapter != model.VideoAdapterFalGrok { payload["duration"] = input.Seconds.String() }
		}
		if route.Adapter == model.VideoAdapterFalKling { delete(payload, "resolution") }
		if len(images) > 0 {
			path += "/image-to-video"
			if route.Adapter == model.VideoAdapterFalKling {
				payload["start_image_url"] = images[0]
				if len(images) > 1 { payload["end_image_url"] = images[1] }
			} else { payload["image_url"] = images[0] }
			if route.Adapter == model.VideoAdapterFalKling || route.Adapter == model.VideoAdapterFalWan { delete(payload, "aspect_ratio") }
		}
	}
	return path, payload
}
