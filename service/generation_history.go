package service

import (
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

type GenerationHistoryInput struct {
	Type       model.GenerationHistoryType        `json:"type"`
	Title      string                             `json:"title"`
	Prompt     string                             `json:"prompt"`
	Model      string                             `json:"model"`
	Config     map[string]string                  `json:"config"`
	References []model.GenerationHistoryReference `json:"references"`
	Media      []model.GenerationHistoryMedia     `json:"media"`
	Status     string                             `json:"status"`
	Error      string                             `json:"error"`
	DurationMs int64                              `json:"durationMs"`
}

func SaveGenerationHistory(user model.AuthUser, input GenerationHistoryInput) (model.GenerationHistory, error) {
	media, expiresAt, err := normalizeGenerationHistoryMedia(user.ID, input.Media)
	if err != nil {
		return model.GenerationHistory{}, err
	}
	if len(media) == 0 {
		return model.GenerationHistory{}, safeMessageError{message: "没有可保存的云端图片、视频或 3D 模型"}
	}
	if input.Type != model.GenerationHistoryTypeVideo && input.Type != model.GenerationHistoryTypeModel3D {
		input.Type = model.GenerationHistoryTypeImage
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = strings.TrimSpace(input.Model)
	}
	if title == "" {
		title = "未命名"
	}
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "成功"
	}
	if expiresAt == "" {
		expiresAt = defaultTempExpiresAt(historyCloudFileType(input.Type))
	}
	item := model.GenerationHistory{
		ID:         newID("history"),
		UserID:     user.ID,
		Type:       input.Type,
		Title:      title,
		Prompt:     input.Prompt,
		Model:      strings.TrimSpace(input.Model),
		Config:     input.Config,
		References: input.References,
		Media:      media,
		Status:     status,
		Error:      input.Error,
		DurationMs: input.DurationMs,
		ExpiresAt:  expiresAt,
		CreatedAt:  now(),
		UpdatedAt:  now(),
	}
	saved, err := repository.SaveGenerationHistory(item)
	if err != nil {
		return saved, err
	}
	ids := generationHistoryFileIDs(saved.Media, saved.References)
	if err := BindCloudFiles(user.ID, ids, model.CloudFilePurposeGeneration, "", saved.ID, saved.ExpiresAt); err != nil {
		return saved, err
	}
	return saved, nil
}

func historyCloudFileType(historyType model.GenerationHistoryType) model.CloudFileType {
	if historyType == model.GenerationHistoryTypeVideo {
		return model.CloudFileTypeVideo
	}
	if historyType == model.GenerationHistoryTypeModel3D {
		return model.CloudFileTypeModel3D
	}
	return model.CloudFileTypeImage
}

func ListGenerationHistories(user model.AuthUser, historyType model.GenerationHistoryType, query model.Query) (model.GenerationHistoryList, error) {
	items, err := repository.ListGenerationHistories(user.ID, historyType, query)
	if err != nil {
		return model.GenerationHistoryList{}, err
	}
	return pruneEmptyGenerationHistories(items)
}

func DeleteGenerationHistory(user model.AuthUser, id string) error {
	if err := DeleteHistoryCloudFiles(user.ID, id); err != nil {
		return err
	}
	return repository.DeleteGenerationHistory(user.ID, id)
}

func pruneEmptyGenerationHistories(list model.GenerationHistoryList) (model.GenerationHistoryList, error) {
	result := make([]model.GenerationHistory, 0, len(list.Items))
	deleteIDs := []string{}
	for _, item := range list.Items {
		media, _, err := normalizeGenerationHistoryMedia(item.UserID, item.Media)
		if err != nil || len(media) == 0 {
			deleteIDs = append(deleteIDs, item.ID)
			_ = DeleteHistoryCloudFiles(item.UserID, item.ID)
			continue
		}
		item.Media = media
		result = append(result, item)
	}
	if len(deleteIDs) > 0 {
		_ = repository.DeleteGenerationHistories(deleteIDs)
	}
	list.Items = result
	list.Total -= len(deleteIDs)
	if list.Total < 0 {
		list.Total = 0
	}
	return list, nil
}

func normalizeGenerationHistoryMedia(userID string, media []model.GenerationHistoryMedia) ([]model.GenerationHistoryMedia, string, error) {
	ids := make([]string, 0, len(media))
	for _, item := range media {
		id := strings.TrimPrefix(strings.TrimSpace(item.CloudFileID), "cloud:")
		if id == "" && strings.HasPrefix(item.StorageKey, "cloud:") {
			id = strings.TrimPrefix(item.StorageKey, "cloud:")
		}
		if id != "" {
			ids = append(ids, id)
		}
	}
	files, err := repository.ListCloudFilesByIDs(uniqueStrings(ids))
	if err != nil {
		return nil, "", err
	}
	fileByID := map[string]model.CloudFile{}
	for _, file := range files {
		if file.DeletedAt == "" && file.UserID == userID {
			fileByID[file.ID] = file
		}
	}
	result := make([]model.GenerationHistoryMedia, 0, len(media))
	expiresAt := ""
	currentTime := now()
	for _, item := range media {
		id := strings.TrimPrefix(strings.TrimSpace(item.CloudFileID), "cloud:")
		if id == "" && strings.HasPrefix(item.StorageKey, "cloud:") {
			id = strings.TrimPrefix(item.StorageKey, "cloud:")
		}
		file, ok := fileByID[id]
		if !ok || file.ExpiresAt == "" || file.ExpiresAt <= currentTime {
			continue
		}
		item.CloudFileID = file.ID
		item.StorageKey = "cloud:" + file.ID
		item.URL = file.PublicURL
		item.FileType = file.FileType
		item.ContentType = file.ContentType
		item.Size = file.Size
		item.ExpiresAt = file.ExpiresAt
		if expiresAt == "" || file.ExpiresAt < expiresAt {
			expiresAt = file.ExpiresAt
		}
		result = append(result, item)
	}
	return result, expiresAt, nil
}

func CleanupExpiredGenerationHistories() error {
	items, err := repository.ListExpiredGenerationHistories(now(), 100)
	if err != nil {
		return err
	}
	for _, item := range items {
		if err := DeleteHistoryCloudFiles(item.UserID, item.ID); err != nil {
			return err
		}
		if err := repository.DeleteGenerationHistory(item.UserID, item.ID); err != nil {
			return err
		}
	}
	return nil
}

func generationHistoryFileIDs(media []model.GenerationHistoryMedia, refs []model.GenerationHistoryReference) []string {
	ids := make([]string, 0, len(media)+len(refs))
	for _, item := range media {
		if id := cloudID(item.CloudFileID, item.StorageKey); id != "" {
			ids = append(ids, id)
		}
	}
	for _, item := range refs {
		if id := cloudID("", item.StorageKey); id != "" {
			ids = append(ids, id)
		}
	}
	return uniqueStrings(ids)
}

func cloudID(id string, storageKey string) string {
	id = strings.TrimPrefix(strings.TrimSpace(id), "cloud:")
	if id != "" {
		return id
	}
	if strings.HasPrefix(storageKey, "cloud:") {
		return strings.TrimPrefix(storageKey, "cloud:")
	}
	return ""
}

func uniqueStrings(items []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
	}
	return result
}
