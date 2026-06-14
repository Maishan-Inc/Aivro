package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
)

const model3DPath = "/model-3d/generations"

type Model3DGenerationInput struct {
	Model            string                         `json:"model"`
	Mode             string                         `json:"mode"`
	Prompt           string                         `json:"prompt"`
	Images           []Model3DGenerationReference   `json:"images"`
	TextureEnabled   bool                           `json:"textureEnabled"`
	PBREnabled       bool                           `json:"pbrEnabled"`
	MeshQuality      string                         `json:"meshQuality"`
	TargetFaceCount  int                            `json:"targetFaceCount"`
	Quantity         int                            `json:"quantity"`
	AdvancedOptions  map[string]any                 `json:"advancedOptions"`
}

type Model3DGenerationReference struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	URL        string `json:"url"`
	StorageKey string `json:"storageKey"`
}

type Model3DGenerationResult struct {
	ID              string                      `json:"id"`
	ProviderTaskID  string                      `json:"providerTaskId"`
	Status          string                      `json:"status"`
	Model           string                      `json:"model"`
	Mode            string                      `json:"mode"`
	Prompt          string                      `json:"prompt"`
	EnergyCost      int                         `json:"energyCost"`
	Results         []Model3DGeneratedAsset     `json:"results"`
	Config          map[string]string           `json:"config"`
	References      []model.GenerationHistoryReference `json:"references"`
	DurationMs      int64                       `json:"durationMs"`
	Error           string                      `json:"error"`
	CreatedAt       string                      `json:"createdAt"`
	CompletedAt     string                      `json:"completedAt"`
}

type Model3DGeneratedAsset struct {
	ID          string `json:"id"`
	URL         string `json:"url"`
	StorageKey  string `json:"storageKey"`
	CloudFileID string `json:"cloudFileId"`
	Bytes       int64  `json:"bytes"`
	MimeType    string `json:"mimeType"`
	ThumbnailURL string `json:"thumbnailUrl"`
	Vertices    int    `json:"vertices"`
	Faces       int    `json:"faces"`
	ExpiresAt   string `json:"expiresAt"`
}

func CreateModel3DGeneration(ctx context.Context, user model.AuthUser, input Model3DGenerationInput) (Model3DGenerationResult, error) {
	input = normalizeModel3DInput(input)
	if err := validateModel3DInput(input); err != nil {
		return Model3DGenerationResult{}, err
	}
	started := time.Now()
	credits, err := Model3DCredits(input)
	if err != nil {
		return Model3DGenerationResult{}, err
	}
	if err := ConsumeUserCredits(user.ID, input.Model, credits, model3DPath); err != nil {
		return Model3DGenerationResult{}, err
	}
	result, err := requestHunyuanModel3D(ctx, user, input, credits)
	if err != nil {
		_ = RefundUserCredits(user.ID, input.Model, credits, model3DPath)
		return Model3DGenerationResult{}, err
	}
	if result.ID == "" {
		result.ID = newID("model3d")
	}
	result.Status = firstNonEmpty(result.Status, "completed")
	result.Model = input.Model
	result.Mode = input.Mode
	result.Prompt = input.Prompt
	result.EnergyCost = credits
	result.Config = model3DConfig(input, result)
	result.References = model3DReferences(input.Images)
	result.DurationMs = time.Since(started).Milliseconds()
	result.CreatedAt = started.Format(time.RFC3339)
	result.CompletedAt = time.Now().Format(time.RFC3339)
	return result, nil
}

func GetModel3DGeneration(user model.AuthUser, id string) (Model3DGenerationResult, error) {
	return Model3DGenerationResult{}, safeMessageError{message: "3D 模型任务已由创建接口直接返回结果，请从生成历史查看"}
}

func Model3DCredits(input Model3DGenerationInput) (int, error) {
	base, err := ModelCost(input.Model)
	if err != nil {
		return 0, err
	}
	if base <= 0 {
		base = 30
	}
	qualityMultiplier := 1.0
	switch input.MeshQuality {
	case "high":
		qualityMultiplier = 1.6
	case "ultra":
		qualityMultiplier = 2.5
	}
	materialMultiplier := 1.0
	if input.TextureEnabled {
		materialMultiplier += 0.2
	}
	if input.PBREnabled {
		materialMultiplier += 0.3
	}
	faceMultiplier := 1.0 + float64(maxInt(0, input.TargetFaceCount-500000))/1000000.0
	credits := int(float64(base*input.Quantity) * qualityMultiplier * materialMultiplier * faceMultiplier)
	if credits < 1 {
		credits = 1
	}
	return credits, nil
}

func normalizeModel3DInput(input Model3DGenerationInput) Model3DGenerationInput {
	input.Model = strings.TrimSpace(input.Model)
	if input.Model == "" {
		input.Model = "hunyuan3d"
	}
	input.Mode = strings.TrimSpace(input.Mode)
	if input.Mode == "" {
		input.Mode = "image"
	}
	input.Mode = strings.ReplaceAll(input.Mode, "-", "_")
	input.Prompt = strings.TrimSpace(input.Prompt)
	input.MeshQuality = strings.TrimSpace(input.MeshQuality)
	if input.MeshQuality == "" {
		input.MeshQuality = "standard"
	}
	if input.TargetFaceCount <= 0 {
		input.TargetFaceCount = 500000
	}
	if input.TargetFaceCount > 1000000 {
		input.TargetFaceCount = 1000000
	}
	if input.Quantity <= 0 {
		input.Quantity = 1
	}
	if input.Quantity > 4 {
		input.Quantity = 4
	}
	return input
}

func validateModel3DInput(input Model3DGenerationInput) error {
	if input.Mode != "image" && input.Mode != "multi_image" && input.Mode != "text" {
		return safeMessageError{message: "生成模式不支持"}
	}
	if input.Mode == "text" && input.Prompt == "" {
		return safeMessageError{message: "请输入文字描述"}
	}
	if input.Mode != "text" && len(input.Images) == 0 {
		return safeMessageError{message: "请上传参考图片"}
	}
	if input.MeshQuality != "standard" && input.MeshQuality != "high" && input.MeshQuality != "ultra" {
		return safeMessageError{message: "网格质量不支持"}
	}
	return nil
}

func requestHunyuanModel3D(ctx context.Context, user model.AuthUser, input Model3DGenerationInput, credits int) (Model3DGenerationResult, error) {
	channel, err := SelectModelChannel(input.Model)
	if err != nil || strings.TrimSpace(channel.BaseURL) == "" {
		log.Printf("model3d channel unavailable, returning preview placeholder: model=%s err=%v", input.Model, err)
		return mockModel3DResult(input, credits), nil
	}
	payload, _ := json.Marshal(input)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(channel, "/model-3d/generations"), bytes.NewReader(payload))
	if err != nil {
		return Model3DGenerationResult{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(channel.APIKey) != "" {
		request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return Model3DGenerationResult{}, SafeAIError("腾讯混元 3D 生成请求失败")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return Model3DGenerationResult{}, err
	}
	if response.StatusCode >= http.StatusBadRequest {
		log.Printf("model3d upstream error: status=%d body=%s", response.StatusCode, strings.TrimSpace(string(body)))
		return Model3DGenerationResult{}, SafeAIError("腾讯混元 3D 生成请求失败")
	}
	return normalizeModel3DProviderResponse(ctx, user, input, body)
}

func normalizeModel3DProviderResponse(ctx context.Context, user model.AuthUser, input Model3DGenerationInput, body []byte) (Model3DGenerationResult, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return Model3DGenerationResult{}, err
	}
	data := payload
	if nested, ok := payload["data"].(map[string]any); ok {
		data = nested
	}
	result := Model3DGenerationResult{ID: stringValue(data, "id"), ProviderTaskID: stringValue(data, "task_id"), Status: firstNonEmpty(stringValue(data, "status"), "completed")}
	modelURL := firstNonEmpty(stringValue(data, "model_url"), stringValue(data, "modelUrl"), stringValue(data, "url"))
	if modelURL != "" {
		asset, err := storeRemoteModel3D(ctx, user, modelURL, input.Model)
		if err != nil {
			return Model3DGenerationResult{}, err
		}
		asset.Vertices = intValue(data, "vertices")
		asset.Faces = intValue(data, "faces")
		result.Results = []Model3DGeneratedAsset{asset}
	}
	if len(result.Results) == 0 {
		result = mockModel3DResult(input, 0)
	}
	return result, nil
}

func storeRemoteModel3D(ctx context.Context, user model.AuthUser, rawURL string, source string) (Model3DGeneratedAsset, error) {
	if !IsPublicHTTPURL(rawURL) {
		return Model3DGeneratedAsset{}, safeMessageError{message: "上游模型地址不安全"}
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	response, err := publicHTTPClient().Do(request)
	if err != nil {
		return Model3DGeneratedAsset{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return Model3DGeneratedAsset{}, safeMessageError{message: "下载上游模型失败"}
	}
	tmp, size, err := spoolLimited(response.Body, maxUpstreamModel3DBytes, "上游 3D 模型文件过大")
	if err != nil {
		return Model3DGeneratedAsset{}, err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	contentType := response.Header.Get("Content-Type")
	ext := strings.ToLower(filepath.Ext(response.Request.URL.Path))
	if ext == "" {
		ext = ".glb"
	}
	stored, err := StoreModel3DReaderToCloud(ctx, user, "model-"+newID("file")+ext, tmp, size, contentType, source)
	if err != nil {
		return Model3DGeneratedAsset{}, err
	}
	return Model3DGeneratedAsset{ID: stored.CloudFileID, URL: stored.URL, StorageKey: stored.StorageKey, CloudFileID: stored.CloudFileID, Bytes: stored.Bytes, MimeType: stored.MimeType, ExpiresAt: stored.ExpiresAt}, nil
}

func StoreModel3DContentToCloud(ctx context.Context, user model.AuthUser, filename string, body []byte, contentType string, source string) (StoredFileResult, error) {
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType == "" || mediaType == "application/octet-stream" {
		if len(body) >= 4 && string(body[:4]) == "glTF" {
			mediaType = "model/gltf-binary"
		} else if strings.EqualFold(filepath.Ext(filename), ".gltf") {
			mediaType = "model/gltf+json"
		} else {
			mediaType = "application/octet-stream"
		}
	}
	contentType, fileType, ext, err := validateStoredContent(filename, body, mediaType, maxUpstreamModel3DBytes, "3D 模型文件不能超过 100MB")
	if err != nil {
		return StoredFileResult{}, err
	}
	if fileType != model.CloudFileTypeModel3D {
		return StoredFileResult{}, safeMessageError{message: "只支持 3D 模型文件"}
	}
	result, err := storeObject(ctx, CloudObjectUpload{User: user, FileType: fileType, Purpose: model.CloudFilePurposeTemp, Filename: sanitizeFilename(strings.TrimSuffix(filename, filepath.Ext(filename))) + ext, ContentType: contentType, Source: source, Body: body, ExpiresAt: defaultTempExpiresAt(model.CloudFileTypeModel3D)})
	if err != nil {
		return StoredFileResult{}, err
	}
	return storedFileResult(result.File, 0, 0), nil
}

func StoreModel3DReaderToCloud(ctx context.Context, user model.AuthUser, filename string, file *os.File, size int64, contentType string, source string) (StoredFileResult, error) {
	contentType, fileType, ext, err := validateStoredFile(filename, file, size, contentType, maxUpstreamModel3DBytes, "3D 模型文件不能超过 100MB")
	if err != nil {
		return StoredFileResult{}, err
	}
	if fileType != model.CloudFileTypeModel3D {
		return StoredFileResult{}, safeMessageError{message: "只支持 3D 模型文件"}
	}
	result, err := storeObject(ctx, CloudObjectUpload{User: user, FileType: fileType, Purpose: model.CloudFilePurposeTemp, Filename: sanitizeFilename(strings.TrimSuffix(filename, filepath.Ext(filename))) + ext, ContentType: contentType, Source: source, Reader: file, Size: size, ExpiresAt: defaultTempExpiresAt(model.CloudFileTypeModel3D)})
	if err != nil {
		return StoredFileResult{}, err
	}
	return storedFileResult(result.File, 0, 0), nil
}

func mockModel3DResult(input Model3DGenerationInput, credits int) Model3DGenerationResult {
	faces := input.TargetFaceCount
	if faces <= 0 {
		faces = 500000
	}
	vertices := maxInt(1, int(float64(faces)*0.56))
	return Model3DGenerationResult{ID: newID("model3d"), Status: "completed", ProviderTaskID: "preview-placeholder", Results: []Model3DGeneratedAsset{{ID: "preview-placeholder", Vertices: vertices, Faces: faces, MimeType: "model/gltf-binary"}}}
}

func model3DConfig(input Model3DGenerationInput, result Model3DGenerationResult) map[string]string {
	config := map[string]string{
		"mode":             input.Mode,
		"textureEnabled":   strconv.FormatBool(input.TextureEnabled),
		"pbrEnabled":       strconv.FormatBool(input.PBREnabled),
		"meshQuality":      input.MeshQuality,
		"targetFaceCount":  strconv.Itoa(input.TargetFaceCount),
		"quantity":         strconv.Itoa(input.Quantity),
		"energyCost":       strconv.Itoa(result.EnergyCost),
	}
	if len(result.Results) > 0 {
		config["vertices"] = strconv.Itoa(result.Results[0].Vertices)
		config["faces"] = strconv.Itoa(result.Results[0].Faces)
	}
	return config
}

func model3DReferences(items []Model3DGenerationReference) []model.GenerationHistoryReference {
	refs := make([]model.GenerationHistoryReference, 0, len(items))
	for _, item := range items {
		refs = append(refs, model.GenerationHistoryReference{Name: item.Name, Type: item.Type, URL: item.URL, StorageKey: item.StorageKey})
	}
	return refs
}

func stringValue(data map[string]any, key string) string {
	if value, ok := data[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func intValue(data map[string]any, key string) int {
	switch value := data[key].(type) {
	case float64:
		return int(value)
	case int:
		return value
	case string:
		parsed, _ := strconv.Atoi(value)
		return parsed
	default:
		return 0
	}
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
