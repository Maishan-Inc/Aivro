package repository

import (
	"errors"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrFreeImageQuota = errors.New("本期免费次数已用完")

func AdminFreeImageHistories(query model.Query) (model.GenerationHistoryList, error) {
	db, err := DB()
	if err != nil { return model.GenerationHistoryList{}, err }
	query.Normalize()
	tx := db.Model(&model.GenerationHistory{}).Where("type = ?", model.GenerationHistoryTypeFreeImage)
	if query.Category != "" { tx = tx.Where("campaign_id = ?", query.Category) }
	if query.Keyword != "" { tx = tx.Where("prompt LIKE ? ESCAPE '!'", LikePattern(query.Keyword)) }
	var count int64
	if err := tx.Count(&count).Error; err != nil { return model.GenerationHistoryList{}, err }
	items := []model.GenerationHistory{}
	err = tx.Order("created_at desc").Offset(query.Offset()).Limit(query.PageSize).Find(&items).Error
	return model.GenerationHistoryList{Items: items, Total: int(count)}, err
}

func GetFreeImageHistory(id string) (model.GenerationHistory, error) {
	db, err := DB()
	if err != nil { return model.GenerationHistory{}, err }
	var history model.GenerationHistory
	err = db.Where("id = ? AND type = ?", id, model.GenerationHistoryTypeFreeImage).First(&history).Error
	return history, err
}

func PublishFreeImage(history model.GenerationHistory, asset model.Asset, file model.CloudFile, reward model.CreditLog) error {
	db, err := DB()
	if err != nil { return err }
	return db.Transaction(func(tx *gorm.DB) error {
		update := tx.Model(&model.GenerationHistory{}).Where("id = ? AND published_asset_id = ?", history.ID, "").Updates(map[string]any{"published_asset_id": asset.ID, "reward_credits": reward.Amount, "updated_at": reward.CreatedAt})
		if update.Error != nil { return update.Error }
		if update.RowsAffected == 0 { return errors.New("作品已公开或不存在") }
		if err := tx.Create(&asset).Error; err != nil { return err }
		if err := SetCloudFileReferencesTx(tx, file.UserID, "public-asset", asset.ID, []string{file.ID}, ""); err != nil { return err }
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", history.UserID).First(&user).Error; err != nil { return err }
		if err := tx.Model(&user).Update("credits", gorm.Expr("credits + ?", reward.Amount)).Error; err != nil { return err }
		if err := tx.Select("credits").Where("id = ?", history.UserID).First(&user).Error; err != nil { return err }
		reward.Balance = user.Credits
		return tx.Create(&reward).Error
	})
}

func ReleasePublicAssetFiles(id string) ([]model.CloudFile, error) {
	db, err := DB()
	files := []model.CloudFile{}
	if err != nil { return files, err }
	err = db.Transaction(func(tx *gorm.DB) error {
		refs := tx.Model(&model.CloudFileReference{}).Select("file_id").Where("kind = ? AND owner_id = ?", "public-asset", id)
		if err := tx.Where("id IN (?)", refs).Find(&files).Error; err != nil { return err }
		return tx.Where("kind = ? AND owner_id = ?", "public-asset", id).Delete(&model.CloudFileReference{}).Error
	})
	return files, err
}

func ListFreeImageCampaigns(query model.Query) ([]model.FreeImageCampaign, int, error) {
	db, err := DB()
	if err != nil { return nil, 0, err }
	query.Normalize()
	tx := db.Model(&model.FreeImageCampaign{})
	if query.Keyword != "" { tx = tx.Where("name LIKE ? ESCAPE '!'", LikePattern(query.Keyword)) }
	var count int64
	if err := tx.Count(&count).Error; err != nil { return nil, 0, err }
	items := []model.FreeImageCampaign{}
	err = tx.Order("created_at desc").Offset(query.Offset()).Limit(query.PageSize).Find(&items).Error
	return items, int(count), err
}

func ActiveFreeImageCampaign(at string) (*model.FreeImageCampaign, error) {
	db, err := DB()
	if err != nil { return nil, err }
	var item model.FreeImageCampaign
	err = db.Where("enabled = ? AND starts_at <= ? AND ends_at > ?", true, at, at).Order("starts_at desc").First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) { return nil, nil }
	return &item, err
}

func SaveFreeImageCampaign(item model.FreeImageCampaign) (model.FreeImageCampaign, error) {
	db, err := DB()
	if err != nil { return item, err }
	err = db.Transaction(func(tx *gorm.DB) error {
		gate := model.Setting{Key: model.SettingKeyPublic, Value: []byte("{}"), CreatedAt: item.UpdatedAt, UpdatedAt: item.UpdatedAt}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&gate).Error; err != nil { return err }
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("key = ?", gate.Key).First(&gate).Error; err != nil { return err }
		if item.Enabled {
			var count int64
			if err := tx.Model(&model.FreeImageCampaign{}).Where("id != ? AND enabled = ? AND starts_at < ? AND ends_at > ?", item.ID, true, item.EndsAt, item.StartsAt).Count(&count).Error; err != nil { return err }
			if count > 0 { return errors.New("免费活动时间不能重叠") }
		}
		return tx.Save(&item).Error
	})
	return item, err
}

func FreeImageUsed(campaignID string, userID string) (int, error) {
	db, err := DB()
	if err != nil { return 0, err }
	var usage model.FreeImageUsage
	err = db.Where("campaign_id = ? AND user_id = ?", campaignID, userID).First(&usage).Error
	if errors.Is(err, gorm.ErrRecordNotFound) { return 0, nil }
	return usage.Used, err
}
