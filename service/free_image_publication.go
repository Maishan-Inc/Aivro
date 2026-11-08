package service

import (
	"context"
	"path"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

type FreeImagePublicationInput struct {
	HistoryID string `json:"historyId"`
	Title string `json:"title"`
	Prompt string `json:"prompt"`
	RewardCredits int `json:"rewardCredits"`
}

func AdminFreeImageHistories(query model.Query) (model.GenerationHistoryList, error) { return repository.AdminFreeImageHistories(query) }

func PublishFreeImage(ctx context.Context, admin model.AuthUser, input FreeImagePublicationInput) (model.Asset, error) {
	if admin.Role != model.UserRoleAdmin { return model.Asset{}, SafeAIError("未登录或权限不足") }
	if input.RewardCredits < 1 || input.RewardCredits > 1000000 { return model.Asset{}, SafeAIError("公开奖励需为 1–1000000 算力点") }
	history, err := repository.GetFreeImageHistory(input.HistoryID)
	if err != nil { return model.Asset{}, SafeAIError("作品不存在或已过期") }
	if history.PublishedAssetID != "" { return model.Asset{}, SafeAIError("作品已公开或不存在") }
	if history.ExpiresAt <= now() || len(history.Media) == 0 { return model.Asset{}, SafeAIError("作品不存在或已过期") }
	owner, exists, err := repository.GetUserByID(history.UserID)
	if err != nil || !exists { return model.Asset{}, SafeAIError("用户不存在") }
	file, content, err := GetFileContent(ctx, model.PublicUser(owner), history.Media[0].CloudFileID, "")
	if err != nil { return model.Asset{}, err }
	defer content.Close()
	copy, err := storeObject(ctx, CloudObjectUpload{User: admin, FileType: model.CloudFileTypeImage, Purpose: model.CloudFilePurposeAsset, Filename: path.Base(file.ObjectKey), ContentType: file.ContentType, Source: "/free-image/publication", Reader: content, Size: file.Size})
	if err != nil { return model.Asset{}, err }
	asset := model.Asset{ID: newID("asset"), Title: firstNonEmpty(strings.TrimSpace(input.Title), history.Title), Type: model.AssetTypeImage, Category: "free-image", Content: firstNonEmpty(strings.TrimSpace(input.Prompt), history.Prompt), URL: copy.PublicURL, CoverURL: copy.PublicURL, CreatedAt: now(), UpdatedAt: now()}
	reward := model.CreditLog{ID: newID("credit"), UserID: history.UserID, Category: creditLogCategory(model.CreditLogTypeFreeImageReward), Type: model.CreditLogTypeFreeImageReward, Amount: input.RewardCredits, RelatedID: history.ID, Model: history.Model, Path: "/free-image/publication", Remark: "免费生图作品公开奖励", CreatedAt: now()}
	if err := repository.PublishFreeImage(history, asset, copy.File, reward); err != nil { _ = DeleteCloudFiles([]model.CloudFile{copy.File}); return model.Asset{}, SafeAIError("作品公开或奖励发放失败，请刷新后重试") }
	return asset, nil
}
