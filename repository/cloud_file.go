package repository

import (
	"time"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

func SaveCloudFile(item model.CloudFile) (model.CloudFile, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func GetCloudFile(id string) (model.CloudFile, bool, error) {
	db, err := DB()
	if err != nil {
		return model.CloudFile{}, false, err
	}
	item := model.CloudFile{}
	err = db.Where("id = ? AND deleted_at = ?", id, "").First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return item, false, nil
		}
		return item, false, err
	}
	return item, true, nil
}

func ListExpiredCloudFiles(now string, limit int) ([]model.CloudFile, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	var items []model.CloudFile
	refs := db.Model(&model.CloudFileReference{}).Select("file_id").Where("file_id = cloud_files.id AND (expires_at = ? OR expires_at > ?)", "", now)
	err = db.Where("expires_at != ? AND expires_at <= ? AND deleted_at = ? AND NOT EXISTS (?)", "", now, "", refs).Order("expires_at asc").Limit(limit).Find(&items).Error
	return items, err
}

func MarkCloudFileDeleted(id string, deletedAt string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Model(&model.CloudFile{}).Where("id = ?", id).Updates(map[string]any{
		"deleted_at": deletedAt,
		"updated_at": deletedAt,
	}).Error
}

func nowString() string {
	return time.Now().Format(time.RFC3339)
}
