package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const maxUserUploadBytes = 5 << 20

type CloudObjectUpload struct {
	User        model.AuthUser
	FileType    model.CloudFileType
	Purpose     model.CloudFilePurpose
	WorkflowID  string
	HistoryID   string
	Filename    string
	ContentType string
	Source      string
	Body        []byte
	ExpiresAt   string
}

type CloudObjectResult struct {
	File      model.CloudFile
	PublicURL string
}

type StoredFileResult struct {
	URL         string `json:"url"`
	StorageKey  string `json:"storageKey"`
	Bytes       int64  `json:"bytes"`
	MimeType    string `json:"mimeType"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	CloudFileID string `json:"cloudFileId"`
	ExpiresAt   string `json:"expiresAt"`
}

type CloudStorageService struct {
	setting model.CloudStorageSetting
	client  *s3.Client
}

func NewCloudStorageService(setting model.CloudStorageSetting) (*CloudStorageService, error) {
	setting = normalizeCloudStorageSetting(setting)
	if strings.TrimSpace(setting.Endpoint) == "" {
		return nil, safeMessageError{message: "缺少 Endpoint"}
	}
	if strings.TrimSpace(setting.AccessKeyID) == "" || strings.TrimSpace(setting.SecretAccessKey) == "" {
		return nil, safeMessageError{message: "缺少 Access Key ID 或 Secret Access Key"}
	}
	if strings.TrimSpace(setting.Bucket) == "" {
		return nil, safeMessageError{message: "缺少 Bucket"}
	}
	region := strings.TrimSpace(setting.Region)
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(setting.AccessKeyID, setting.SecretAccessKey, "")),
	)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(strings.TrimRight(setting.Endpoint, "/"))
		options.UsePathStyle = setting.PathStyleEndpoint != nil && *setting.PathStyleEndpoint
	})
	return &CloudStorageService{setting: setting, client: client}, nil
}

func (storage *CloudStorageService) UploadObject(ctx context.Context, request CloudObjectUpload) (CloudObjectResult, error) {
	objectKey := storage.ObjectKey(request.FileType, request.User.Username, request.Filename, time.Now())
	_, err := storage.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(storage.setting.Bucket),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(request.Body),
		ContentType: aws.String(request.ContentType),
	})
	if err != nil {
		return CloudObjectResult{}, err
	}
	file := model.CloudFile{
		ID:          newID("cloud"),
		UserID:      request.User.ID,
		Username:    request.User.Username,
		Provider:    storage.setting.Provider,
		FileType:    request.FileType,
		Purpose:     firstPurpose(request.Purpose),
		WorkflowID:  request.WorkflowID,
		HistoryID:   request.HistoryID,
		Bucket:      storage.setting.Bucket,
		ObjectKey:   objectKey,
		PublicURL:   "",
		AccessToken: mustRandomToken(24),
		ContentType: request.ContentType,
		Size:        int64(len(request.Body)),
		Source:      request.Source,
		ExpiresAt:   firstNonEmpty(request.ExpiresAt, cloudExpiresAt(storage.setting, request.FileType)),
		CreatedAt:   now(),
		UpdatedAt:   now(),
	}
	file.PublicURL = fileContentURL(file.ID, file.AccessToken)
	saved, err := repository.SaveCloudFile(file)
	if err != nil {
		return CloudObjectResult{}, err
	}
	return CloudObjectResult{File: saved, PublicURL: saved.PublicURL}, nil
}

func StoreUserFile(ctx context.Context, user model.AuthUser, filename string, body []byte, contentType string, source string, purpose model.CloudFilePurpose) (StoredFileResult, error) {
	contentType, fileType, ext, err := validateUploadContent(filename, body, contentType)
	if err != nil {
		return StoredFileResult{}, err
	}
	result, err := storeObject(ctx, CloudObjectUpload{
		User:        user,
		FileType:    fileType,
		Purpose:     purpose,
		Filename:    sanitizeFilename(strings.TrimSuffix(filename, filepath.Ext(filename))) + ext,
		ContentType: contentType,
		Source:      source,
		Body:        body,
		ExpiresAt:   defaultTempExpiresAt(),
	})
	if err != nil {
		return StoredFileResult{}, err
	}
	return storedFileResult(result.File, 0, 0), nil
}

func storeObject(ctx context.Context, request CloudObjectUpload) (CloudObjectResult, error) {
	setting, enabled, err := CloudStorageEnabled()
	if err != nil {
		return CloudObjectResult{}, err
	}
	if enabled {
		storage, err := NewCloudStorageService(setting)
		if err != nil {
			return CloudObjectResult{}, err
		}
		return storage.UploadObject(ctx, request)
	}
	return storeLocalObject(request)
}

func storeLocalObject(request CloudObjectUpload) (CloudObjectResult, error) {
	objectKey := localObjectKey(request.FileType, request.User.Username, request.Filename, time.Now())
	fullPath := filepath.Join(config.Cfg.LocalFileDir, filepath.FromSlash(objectKey))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return CloudObjectResult{}, err
	}
	if err := os.WriteFile(fullPath, request.Body, 0644); err != nil {
		return CloudObjectResult{}, err
	}
	file := model.CloudFile{
		ID:          newID("cloud"),
		UserID:      request.User.ID,
		Username:    request.User.Username,
		Provider:    "local",
		FileType:    request.FileType,
		Purpose:     firstPurpose(request.Purpose),
		WorkflowID:  request.WorkflowID,
		HistoryID:   request.HistoryID,
		ObjectKey:   objectKey,
		AccessToken: mustRandomToken(24),
		ContentType: request.ContentType,
		Size:        int64(len(request.Body)),
		Source:      request.Source,
		ExpiresAt:   request.ExpiresAt,
		CreatedAt:   now(),
		UpdatedAt:   now(),
	}
	file.PublicURL = fileContentURL(file.ID, file.AccessToken)
	saved, err := repository.SaveCloudFile(file)
	if err != nil {
		return CloudObjectResult{}, err
	}
	return CloudObjectResult{File: saved, PublicURL: saved.PublicURL}, nil
}

func GetFileContent(user model.AuthUser, id string, accessToken string) (model.CloudFile, io.ReadCloser, error) {
	file, ok, err := repository.GetCloudFile(strings.TrimSpace(id))
	if err != nil || !ok {
		if err != nil {
			return file, nil, err
		}
		return file, nil, safeMessageError{message: "文件不存在或已删除"}
	}
	if file.AccessToken == "" || accessToken != file.AccessToken {
		if user.ID == "" || user.ID != file.UserID {
			return file, nil, safeMessageError{message: "无权访问文件"}
		}
	}
	if file.ExpiresAt != "" && file.ExpiresAt <= now() {
		return file, nil, safeMessageError{message: "文件已过期"}
	}
	if file.Provider == "local" {
		reader, err := os.Open(filepath.Join(config.Cfg.LocalFileDir, filepath.FromSlash(file.ObjectKey)))
		return file, reader, err
	}
	settings, _, err := CloudStorageEnabled()
	if err != nil {
		return file, nil, err
	}
	storage, err := NewCloudStorageService(settings)
	if err != nil {
		return file, nil, err
	}
	result, err := storage.client.GetObject(context.Background(), &s3.GetObjectInput{Bucket: aws.String(firstNonEmpty(file.Bucket, settings.Bucket)), Key: aws.String(file.ObjectKey)})
	if err != nil {
		return file, nil, err
	}
	return file, result.Body, nil
}

func BindCloudFiles(userID string, ids []string, purpose model.CloudFilePurpose, workflowID string, historyID string, expiresAt string) error {
	return repository.UpdateCloudFilesPurpose(uniqueStrings(ids), userID, purpose, workflowID, historyID, expiresAt)
}

func DeleteCloudFiles(files []model.CloudFile) error {
	settings, _, err := CloudStorageEnabled()
	if err != nil {
		return err
	}
	for _, file := range files {
		if file.DeletedAt != "" {
			continue
		}
		if err := deleteStoredFile(file, settings); err != nil {
			return err
		}
		if err := repository.MarkCloudFileDeleted(file.ID, now()); err != nil {
			return err
		}
	}
	return nil
}

func DeleteWorkflowCloudFiles(userID string, workflowID string) error {
	files, err := repository.ListCloudFilesByWorkflow(userID, workflowID)
	if err != nil {
		return err
	}
	return DeleteCloudFiles(files)
}

func DeleteHistoryCloudFiles(userID string, historyID string) error {
	files, err := repository.ListCloudFilesByHistory(userID, historyID)
	if err != nil {
		return err
	}
	return DeleteCloudFiles(files)
}

func (storage *CloudStorageService) DeleteObject(ctx context.Context, bucket string, objectKey string) error {
	if strings.TrimSpace(bucket) == "" {
		bucket = storage.setting.Bucket
	}
	_, err := storage.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(objectKey)})
	return err
}

func (storage *CloudStorageService) BuildPublicURL(objectKey string) string {
	base := strings.TrimRight(strings.TrimSpace(storage.setting.PublicBaseURL), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(storage.setting.Endpoint), "/") + "/" + strings.Trim(strings.TrimSpace(storage.setting.Bucket), "/")
	}
	return base + "/" + escapeObjectKey(objectKey)
}

func (storage *CloudStorageService) TestConnection(ctx context.Context) error {
	_, err := storage.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(storage.setting.Bucket)})
	return err
}

func CloudStorageEnabled() (model.CloudStorageSetting, bool, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.CloudStorageSetting{}, false, err
	}
	setting := normalizeCloudStorageSetting(settings.Private.CloudStorage)
	return setting, setting.Enabled, nil
}

func AdminTestCloudStorage(setting model.CloudStorageSetting) (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	setting = normalizeCloudStorageSetting(setting)
	saved := normalizeCloudStorageSetting(settings.Private.CloudStorage)
	if strings.TrimSpace(setting.SecretAccessKey) == "" {
		setting.SecretAccessKey = saved.SecretAccessKey
	}
	storage, err := NewCloudStorageService(setting)
	if err != nil {
		return "", err
	}
	if err := storage.TestConnection(context.Background()); err != nil {
		return "", err
	}
	return "连接成功，Bucket 可访问", nil
}

func StoreImageResponseToCloud(ctx context.Context, user model.AuthUser, body []byte, source string) ([]byte, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return body, nil
	}
	items, ok := payload["data"].([]any)
	if !ok {
		return body, nil
	}
	for index, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		content, contentType, ext, err := imageItemBytes(ctx, item)
		if err != nil {
			return nil, err
		}
		if len(content) == 0 {
			continue
		}
		result, err := storeObject(ctx, CloudObjectUpload{
			User:        user,
			FileType:    model.CloudFileTypeImage,
			Purpose:     model.CloudFilePurposeTemp,
			Filename:    "image-" + newID("file") + "-" + strconv.Itoa(index+1) + ext,
			ContentType: contentType,
			Source:      source,
			Body:        content,
			ExpiresAt:   defaultTempExpiresAt(),
		})
		if err != nil {
			return nil, err
		}
		delete(item, "b64_json")
		item["url"] = result.PublicURL
		item["storage_key"] = "cloud:" + result.File.ID
		item["cloud_file_id"] = result.File.ID
		item["content_type"] = result.File.ContentType
		item["size"] = result.File.Size
		item["expires_at"] = result.File.ExpiresAt
		items[index] = item
	}
	payload["data"] = items
	return json.Marshal(payload)
}

func StoreVideoContentToCloud(ctx context.Context, user model.AuthUser, body []byte, contentType string, source string) ([]byte, error) {
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType == "" || mediaType == "application/octet-stream" {
		mediaType = http.DetectContentType(body)
	}
	if !strings.HasPrefix(mediaType, "video/") {
		mediaType = "video/mp4"
	}
	result, err := storeObject(ctx, CloudObjectUpload{
		User:        user,
		FileType:    model.CloudFileTypeVideo,
		Purpose:     model.CloudFilePurposeTemp,
		Filename:    "video-" + newID("file") + mediaExtension(mediaType, ".mp4"),
		ContentType: mediaType,
		Source:      source,
		Body:        body,
		ExpiresAt:   defaultTempExpiresAt(),
	})
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]any{
		"code": 0,
		"msg":  "",
		"data": map[string]any{
			"url":         result.PublicURL,
			"storageKey":  "cloud:" + result.File.ID,
			"bytes":       result.File.Size,
			"mimeType":    result.File.ContentType,
			"width":       1280,
			"height":      720,
			"cloudFileId": result.File.ID,
			"expiresAt":   result.File.ExpiresAt,
		},
	})
}

func StartCloudStorageCleanupScheduler() {
	go func() {
		timer := time.NewTimer(time.Minute)
		defer timer.Stop()
		for {
			<-timer.C
			if err := CleanupExpiredGenerationHistories(); err != nil {
				log.Printf("generation history cleanup failed: %v", err)
			}
			if err := CleanupExpiredCloudFiles(); err != nil {
				log.Printf("cloud storage cleanup failed: %v", err)
			}
			timer.Reset(time.Hour)
		}
	}()
}

func CleanupExpiredCloudFiles() error {
	settings, _, err := CloudStorageEnabled()
	if err != nil || settings.AutoCleanupEnabled == nil || !*settings.AutoCleanupEnabled {
		return err
	}
	items, err := repository.ListExpiredCloudFiles(now(), 100)
	if err != nil || len(items) == 0 {
		return err
	}
	for _, item := range items {
		if err := deleteStoredFile(item, settings); err != nil {
			log.Printf("cloud file delete failed: id=%s key=%s err=%v", item.ID, item.ObjectKey, err)
			continue
		}
		if err := repository.MarkCloudFileDeleted(item.ID, now()); err != nil {
			log.Printf("cloud file mark deleted failed: id=%s err=%v", item.ID, err)
		}
	}
	return nil
}

func normalizeCloudStorageSetting(setting model.CloudStorageSetting) model.CloudStorageSetting {
	setting.Provider = strings.TrimSpace(setting.Provider)
	if setting.Provider == "" {
		setting.Provider = "r2"
	}
	setting.Endpoint = strings.TrimRight(strings.TrimSpace(setting.Endpoint), "/")
	setting.Region = strings.TrimSpace(setting.Region)
	if setting.Region == "" {
		setting.Region = "auto"
	}
	setting.AccessKeyID = strings.TrimSpace(setting.AccessKeyID)
	setting.SecretAccessKey = strings.TrimSpace(setting.SecretAccessKey)
	setting.Bucket = strings.TrimSpace(setting.Bucket)
	setting.PublicBaseURL = strings.TrimRight(strings.TrimSpace(setting.PublicBaseURL), "/")
	if strings.TrimSpace(setting.ImagePathTemplate) == "" {
		setting.ImagePathTemplate = "{username}/images/{yyyy}/{mm}/{dd}/{filename}"
	}
	if strings.TrimSpace(setting.VideoPathTemplate) == "" {
		setting.VideoPathTemplate = "{username}/videos/{yyyy}/{mm}/{dd}/{filename}"
	}
	if setting.ImageExpireDays <= 0 {
		setting.ImageExpireDays = 7
	}
	if setting.VideoExpireDays <= 0 {
		setting.VideoExpireDays = 7
	}
	if setting.AutoCleanupEnabled == nil {
		enabled := true
		setting.AutoCleanupEnabled = &enabled
	}
	if setting.PathStyleEndpoint == nil {
		enabled := true
		setting.PathStyleEndpoint = &enabled
	}
	return setting
}

func (storage *CloudStorageService) ObjectKey(fileType model.CloudFileType, username string, filename string, t time.Time) string {
	template := storage.setting.ImagePathTemplate
	if fileType == model.CloudFileTypeVideo {
		template = storage.setting.VideoPathTemplate
	}
	username = sanitizePathPart(username)
	if username == "" {
		username = "user"
	}
	replacer := strings.NewReplacer(
		"{username}", username,
		"{yyyy}", t.Format("2006"),
		"{mm}", t.Format("01"),
		"{dd}", t.Format("02"),
		"{filename}", sanitizeFilename(filename),
	)
	return strings.Trim(path.Clean(strings.TrimLeft(replacer.Replace(template), "/")), ".")
}

func imageItemBytes(ctx context.Context, item map[string]any) ([]byte, string, string, error) {
	if value, ok := item["b64_json"].(string); ok && value != "" {
		content, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, "", "", err
		}
		return content, "image/png", ".png", nil
	}
	if value, ok := item["url"].(string); ok && strings.HasPrefix(value, "http") {
		if !IsPublicHTTPURL(value) {
			return nil, "", "", errors.New("上游图片地址不安全")
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, value, nil)
		resp, err := publicHTTPClient().Do(req)
		if err != nil {
			return nil, "", "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
			return nil, "", "", errors.New("下载上游图片失败")
		}
		content, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
		if err != nil {
			return nil, "", "", err
		}
		contentType := resp.Header.Get("Content-Type")
		mediaType, _, _ := mime.ParseMediaType(contentType)
		if !strings.HasPrefix(mediaType, "image/") {
			mediaType = http.DetectContentType(content)
		}
		return content, mediaType, mediaExtension(mediaType, ".png"), nil
	}
	return nil, "", "", nil
}

func cloudExpiresAt(setting model.CloudStorageSetting, fileType model.CloudFileType) string {
	days := setting.ImageExpireDays
	if fileType == model.CloudFileTypeVideo {
		days = setting.VideoExpireDays
	}
	return time.Now().Add(time.Duration(days) * 24 * time.Hour).Format(time.RFC3339)
}

func mediaExtension(contentType string, fallback string) string {
	extensions, _ := mime.ExtensionsByType(contentType)
	if len(extensions) > 0 {
		return extensions[0]
	}
	return fallback
}

func validateUploadContent(filename string, body []byte, contentType string) (string, model.CloudFileType, string, error) {
	if len(body) == 0 {
		return "", "", "", safeMessageError{message: "文件不能为空"}
	}
	if len(body) > maxUserUploadBytes {
		return "", "", "", safeMessageError{message: "文件不能超过 5MB"}
	}
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType == "" || mediaType == "application/octet-stream" {
		mediaType = http.DetectContentType(body)
	}
	detectedType := http.DetectContentType(body)
	ext := strings.ToLower(filepath.Ext(filename))
	switch mediaType {
	case "image/jpeg":
		if detectedType != "image/jpeg" {
			return "", "", "", safeMessageError{message: "文件内容类型不匹配"}
		}
		return mediaType, model.CloudFileTypeImage, ".jpg", nil
	case "image/png":
		if detectedType != "image/png" {
			return "", "", "", safeMessageError{message: "文件内容类型不匹配"}
		}
		return mediaType, model.CloudFileTypeImage, ".png", nil
	case "image/webp":
		if detectedType != "image/webp" {
			return "", "", "", safeMessageError{message: "文件内容类型不匹配"}
		}
		return mediaType, model.CloudFileTypeImage, ".webp", nil
	case "image/gif":
		if detectedType != "image/gif" {
			return "", "", "", safeMessageError{message: "文件内容类型不匹配"}
		}
		return mediaType, model.CloudFileTypeImage, ".gif", nil
	case "video/mp4":
		return mediaType, model.CloudFileTypeVideo, ".mp4", nil
	case "video/webm":
		return mediaType, model.CloudFileTypeVideo, ".webm", nil
	case "video/quicktime":
		return mediaType, model.CloudFileTypeVideo, ".mov", nil
	default:
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" || ext == ".mp4" || ext == ".webm" || ext == ".mov" {
			return "", "", "", safeMessageError{message: "文件内容类型不匹配"}
		}
		return "", "", "", safeMessageError{message: "只支持安全的图片或视频文件"}
	}
}

func storedFileResult(file model.CloudFile, width int, height int) StoredFileResult {
	return StoredFileResult{
		URL:         file.PublicURL,
		StorageKey:  "cloud:" + file.ID,
		Bytes:       file.Size,
		MimeType:    file.ContentType,
		Width:       width,
		Height:      height,
		CloudFileID: file.ID,
		ExpiresAt:   file.ExpiresAt,
	}
}

func fileContentURL(id string, accessToken string) string {
	if accessToken == "" {
		return "/api/files/" + url.PathEscape(id) + "/content"
	}
	return "/api/files/" + url.PathEscape(id) + "/content?accessToken=" + url.QueryEscape(accessToken)
}

func defaultTempExpiresAt() string {
	return time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339)
}

func firstPurpose(purpose model.CloudFilePurpose) model.CloudFilePurpose {
	if purpose == "" {
		return model.CloudFilePurposeTemp
	}
	return purpose
}

func localObjectKey(fileType model.CloudFileType, username string, filename string, t time.Time) string {
	folder := "images"
	if fileType == model.CloudFileTypeVideo {
		folder = "videos"
	}
	username = sanitizePathPart(username)
	if username == "" {
		username = "user"
	}
	return strings.Trim(path.Clean(path.Join(username, folder, t.Format("2006"), t.Format("01"), t.Format("02"), sanitizeFilename(filename))), ".")
}

func deleteStoredFile(item model.CloudFile, setting model.CloudStorageSetting) error {
	if item.Provider == "local" {
		fullPath := filepath.Join(config.Cfg.LocalFileDir, filepath.FromSlash(item.ObjectKey))
		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	storage, err := NewCloudStorageService(setting)
	if err != nil {
		return err
	}
	return storage.DeleteObject(context.Background(), item.Bucket, item.ObjectKey)
}

var unsafePathPart = regexp.MustCompile(`[\\/:*?"<>|]+`)

func sanitizePathPart(value string) string {
	return strings.Trim(unsafePathPart.ReplaceAllString(strings.TrimSpace(value), "-"), "-.")
}

func sanitizeFilename(value string) string {
	value = sanitizePathPart(value)
	if value == "" {
		return "file"
	}
	return value
}

func escapeObjectKey(objectKey string) string {
	parts := strings.Split(objectKey, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}
