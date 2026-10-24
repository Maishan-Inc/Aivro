package repository

import (
	"github.com/basketikun/aivro/model"
)

func ListUserAPIKeys(userID string, q model.Query) (model.UserAPIKeyList, error) {
	db, err := DB()
	result := model.UserAPIKeyList{Items: []model.UserAPIKey{}}
	if err != nil {
		return result, err
	}
	query := db.Model(&model.UserAPIKey{}).Where("user_id = ?", userID)
	if err := query.Count(&result.Total).Error; err != nil {
		return result, err
	}
	err = query.Order("created_at desc, id desc").Offset(q.Offset()).Limit(q.PageSize).Find(&result.Items).Error
	return result, err
}

func UserAPIKeyNameExists(userID string, nameHash string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	var count int64
	err = db.Model(&model.UserAPIKey{}).Where("user_id = ? AND name_hash = ?", userID, nameHash).Count(&count).Error
	return count > 0, err
}

func CreateUserAPIKey(item model.UserAPIKey) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Create(&item).Error
}

func GetActiveUserAPIKey(keyHash string) (model.UserAPIKey, error) {
	db, err := DB()
	if err != nil {
		return model.UserAPIKey{}, err
	}
	var item model.UserAPIKey
	err = db.Where("key_hash = ? AND status = ?", keyHash, model.APIKeyActive).First(&item).Error
	return item, err
}

func TouchUserAPIKey(id string, usedAt string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	result := db.Model(&model.UserAPIKey{}).Where("id = ? AND status = ?", id, model.APIKeyActive).Update("last_used_at", usedAt)
	return result.RowsAffected > 0, result.Error
}

func RevokeUserAPIKey(userID string, id string, revokedAt string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	var item model.UserAPIKey
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		return err
	}
	return db.Model(&model.UserAPIKey{}).Where("id = ? AND user_id = ? AND status = ?", id, userID, model.APIKeyActive).Updates(map[string]any{"status": model.APIKeyRevoked, "revoked_at": revokedAt}).Error
}
