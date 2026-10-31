package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/basketikun/aivro/model"
)

type VideoGenerationInput struct {
	Model string `json:"model"`
	Prompt string `json:"prompt"`
	Seconds json.Number `json:"seconds"`
	Size string `json:"size"`
	Resolution string `json:"resolution_name"`
	BillingType string `json:"billingType"`
	Images []Model3DGenerationReference `json:"images"`
}

func prepareVideoGeneration(ctx context.Context, user model.AuthUser, body []byte, contentType, modelName string) (VideoGenerationInput, []byte, error) {
	var input VideoGenerationInput
	if strings.HasPrefix(contentType, "multipart/form-data") {
		_, params, err := mime.ParseMediaType(contentType)
		if err != nil { return input, nil, SafeAIError("视频请求格式错误") }
		form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(8 << 20)
		if err != nil { return input, nil, SafeAIError("视频请求格式错误") }
		defer form.RemoveAll()
		values := map[string]string{}
		for key, entries := range form.Value {
			if len(entries) != 1 { return input, nil, SafeAIError("视频请求参数不能重复") }
			if !slices.Contains([]string{"model", "prompt", "seconds", "size", "resolution_name", "billingType"}, key) { return input, nil, SafeAIError("视频请求包含不支持的参数") }
			values[key] = entries[0]
		}
		input = VideoGenerationInput{Model: modelName, Prompt: values["prompt"], Seconds: json.Number(values["seconds"]), Size: values["size"], Resolution: values["resolution_name"], BillingType: values["billingType"]}
		if len(form.File) > 1 { return input, nil, SafeAIError("视频参考图片字段不能混用") }
		for field, files := range form.File {
			if field != "input_reference" && field != "input_reference[]" { return input, nil, SafeAIError("视频参考图片字段不支持") }
			if len(files) > 7 { return input, nil, SafeAIError("视频参考图片过多") }
			for _, file := range files {
				if file.Size > 10<<20 { return input, nil, SafeAIError("视频参考图片不能超过 10MB") }
				reader, err := file.Open()
				if err != nil { return input, nil, err }
				stored, err := StoreUserFileReader(ctx, user, file.Filename, reader, file.Header.Get("Content-Type"), "/videos", model.CloudFilePurposeTemp)
				_ = reader.Close()
				if err != nil { return input, nil, err }
				input.Images = append(input.Images, Model3DGenerationReference{URL: stored.URL, StorageKey: stored.StorageKey})
			}
		}
	} else {
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil { return input, nil, SafeAIError("视频请求格式错误或包含不支持的参数") }
		if decoder.Decode(new(any)) != io.EOF { return input, nil, SafeAIError("视频请求格式错误") }
	}
	input.Model, input.Prompt = modelName, strings.TrimSpace(input.Prompt)
	route, err := SelectModelChannelRoute(modelName)
	if err != nil { return input, nil, err }
	input, err = normalizeVideoInput(input, route)
	if err != nil { return input, nil, err }
	normalized, err := json.Marshal(input)
	return input, normalized, err
}

func normalizeVideoInput(input VideoGenerationInput, route ModelChannelRoute) (VideoGenerationInput, error) {
	if route.Capability != "video" { return input, SafeAIError("该模型未开放此功能") }
	caps, err := videoCapabilities(route)
	if err != nil { return input, err }
	if input.BillingType == "" { input.BillingType = model.BillingTypeFixed }
	if input.BillingType != model.BillingTypeFixed && input.BillingType != model.BillingTypeSecond { return input, SafeAIError("视频计费方式仅支持按次或按秒") }
	if input.Seconds == "" {
		if input.BillingType == model.BillingTypeSecond { return input, SafeAIError("按秒计费必须传入 seconds") }
		input.Seconds = json.Number(strconv.Itoa(caps.Durations[0]))
	}
	seconds, err := strconv.Atoi(input.Seconds.String())
	if err != nil || !slices.Contains(caps.Durations, seconds) { return input, SafeAIError("当前视频模型不支持此时长") }
	input.Seconds = json.Number(strconv.Itoa(seconds))
	if input.Resolution == "" { input.Resolution = caps.Resolutions[0] }
	if !slices.Contains(caps.Resolutions, input.Resolution) { return input, SafeAIError("当前视频模型不支持此清晰度") }
	if input.Size == "" { input.Size = caps.AspectRatios[0] }
	if ratio := map[string]string{"1280x720": "16:9", "1920x1080": "16:9", "720x1280": "9:16", "1080x1920": "9:16", "1024x1024": "1:1"}[input.Size]; ratio != "" { input.Size = ratio }
	if !slices.Contains(caps.AspectRatios, input.Size) { return input, SafeAIError("当前视频模型不支持此画面比例") }
	if len(input.Images) < caps.MinImages || len(input.Images) > caps.MaxImages { return input, SafeAIError("参考图数量不符合当前视频模型要求") }
	if input.Prompt == "" { return input, SafeAIError("请输入视频描述") }
	// Seedance 的旧提示词参数会覆盖生成规格，禁止绕开本站时长与计费。
	if (route.Adapter == model.VideoAdapterSeedance || route.Adapter == model.VideoAdapterArkSeedance) && strings.Contains(input.Prompt, "--") { return input, SafeAIError("请通过视频参数设置规格，描述中不要使用 -- 参数") }
	if route.Adapter == model.VideoAdapterHailuo && input.Resolution == "1080p" && seconds != 6 { return input, SafeAIError("1080p 海螺视频仅支持 6 秒") }
	if route.Adapter == model.VideoAdapterFalVeo && input.Resolution != "720p" && seconds != 8 { return input, SafeAIError("Veo 高清视频请使用 8 秒时长") }
	return input, nil
}

func videoModelBilling(ctx context.Context, name, unit string) (model.ModelCost, error) {
	billing, err := ModelBilling(name)
	if err != nil { return billing, err }
	if unit == model.BillingTypeSecond {
		if billing.VideoSecondPrice == nil { return billing, SafeAIError("该视频模型尚未配置按秒价格") }
		billing.Credits, billing.APICredits = billing.VideoSecondPrice.Credits, billing.VideoSecondPrice.APICredits
	}
	if IsAPIKeyRequest(ctx) {
		multiplier := billing.ApiMultiplier
		if multiplier <= 0 { multiplier = model.DefaultAPIMultiplier }
		if billing.APICredits <= 0 && billing.Credits > int(^uint(0)>>1)/multiplier { return billing, SafeAIError("模型计费配置无效") }
		billing.Credits = billing.APICost()
	}
	billing.BillingType = unit
	return billing, nil
}

func executeVideoGeneration(ctx context.Context, user model.AuthUser, task model.GenerationTask, reader io.Reader) (AIProxyResponse, error) {
	var input VideoGenerationInput
	if err := json.NewDecoder(reader).Decode(&input); err != nil { return AIProxyResponse{}, err }
	route, err := SelectModelChannelRoute(task.Model)
	if err != nil { return AIProxyResponse{}, err }
	input, err = normalizeVideoInput(input, route)
	if err != nil { return AIProxyResponse{}, err }
	var result []byte
	if route.Adapter == "" {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		for key, value := range map[string]string{"model": route.UpstreamModel, "prompt": input.Prompt, "seconds": input.Seconds.String(), "size": videoPixelSize(input.Size, input.Resolution), "resolution_name": input.Resolution, "preset": "normal"} {
			if err := writer.WriteField(key, value); err != nil { return AIProxyResponse{}, err }
		}
		for _, reference := range input.Images {
			image, contentType, err := readModel3DReference(ctx, user, reference)
			if err != nil { return AIProxyResponse{}, err }
			if err := writeModel3DImage(writer, "input_reference[]", contentType, image); err != nil { return AIProxyResponse{}, err }
		}
		if err := writer.Close(); err != nil { return AIProxyResponse{}, err }
		var created json.RawMessage
		if _, err := videoProviderRequest(ctx, route, http.MethodPost, "/v1/videos", body.Bytes(), writer.FormDataContentType(), &created, false); err != nil { return AIProxyResponse{}, err }
		created, err = RecordVideoTask(user, route, created)
		if err == nil { result, err = completeVideoTask(ctx, user, created) }
	} else {
		var providerID, videoURL string
		providerID, videoURL, err = requestAdaptedVideo(ctx, user, route, input)
		if err == nil {
			var stored []byte
			stored, err = storeProviderVideo(ctx, user, videoURL)
			if err == nil {
				var payload struct { Data json.RawMessage `json:"data"` }
				if err = json.Unmarshal(stored, &payload); err == nil { result, err = json.Marshal(map[string]any{"id": task.ID, "providerTaskId": providerID, "status": "completed", "file": payload.Data}) }
			}
		}
	}
	if err != nil { return AIProxyResponse{}, err }
	var payload map[string]any
	if err := json.Unmarshal(result, &payload); err != nil { return AIProxyResponse{}, err }
	payload["id"], payload["billingType"], payload["seconds"], payload["unitCredits"], payload["energyCost"] = task.ID, task.VideoBillingType, task.VideoSeconds, task.VideoUnitCredits, task.Credits
	result, err = json.Marshal(payload)
	return AIProxyResponse{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: result}, err
}

func videoReferenceURL(ctx context.Context, user model.AuthUser, reference Model3DGenerationReference) (string, error) {
	id := cloudID("", reference.StorageKey)
	if id == "" {
		if parsed, err := url.Parse(reference.URL); err == nil && strings.HasPrefix(parsed.Path, "/api/files/") && strings.HasSuffix(parsed.Path, "/content") { id = strings.TrimSuffix(strings.TrimPrefix(parsed.Path, "/api/files/"), "/content") }
	}
	if id != "" {
		file, reader, err := GetFileContent(ctx, user, id, "")
		if err != nil { return "", err }
		_ = reader.Close()
		if file.FileType != model.CloudFileTypeImage { return "", SafeAIError("请上传参考图片") }
		if file.Size > 10<<20 { return "", SafeAIError("视频参考图片不能超过 10MB") }
		origin := normalizedConfiguredOrigin()
		if !IsPublicHTTPURL(origin) { return "", SafeAIError("请配置可供视频渠道访问的站点公网地址") }
		return origin + fileContentURL(file.ID, file.AccessToken), nil
	}
	if !IsPublicHTTPURL(reference.URL) { return "", SafeAIError("视频参考图片必须使用本站文件或公网地址") }
	return reference.URL, nil
}

func storeProviderVideo(ctx context.Context, user model.AuthUser, videoURL string) ([]byte, error) {
	if !IsPublicHTTPURL(videoURL) { return nil, SafeAIError("上游未返回有效视频地址") }
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, videoURL, nil)
	if err != nil { return nil, err }
	response, err := generationDownloadClient(ctx).Do(request)
	if err != nil { return nil, err }
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 { return nil, SafeAIError("下载上游视频失败") }
	return StoreVideoReaderToCloud(ctx, user, response.Body, response.Header.Get("Content-Type"), "/videos")
}
