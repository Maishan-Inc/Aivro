package repository

import (
	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func CanReferenceCloudFileTx(tx *gorm.DB, userID string, id string, now string) (bool, error) {
	var file model.CloudFile
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND deleted_at = ?", id, "").First(&file).Error; err != nil {
		return false, err
	}
	if file.FileType == model.CloudFileTypeTask { return false, nil }
	var refs []model.CloudFileReference
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("file_id = ? AND (expires_at = ? OR expires_at > ?)", id, "", now).Find(&refs).Error; err != nil { return false, err }
	if file.ExpiresAt != "" && file.ExpiresAt <= now && len(refs) == 0 { return false, nil }
	if file.UserID == userID { return true, nil }
	for _, ref := range refs { if ref.UserID == userID { return true, nil } }
	return false, nil
}

func SetCloudFileReferencesTx(tx *gorm.DB, userID string, kind string, ownerID string, ids []string, expiresAt string) error {
	if err := tx.Where("user_id = ? AND kind = ? AND owner_id = ?", userID, kind, ownerID).Delete(&model.CloudFileReference{}).Error; err != nil {
		return err
	}
	for _, id := range ids {
		ref := model.CloudFileReference{FileID: id, UserID: userID, Kind: kind, OwnerID: ownerID, ExpiresAt: expiresAt}
		if err := tx.Create(&ref).Error; err != nil {
			return err
		}
	}
	return nil
}

func ReleaseCloudFileReferences(userID string, kind string, ownerID string) ([]model.CloudFile, error) {
	db, err := DB()
	var files []model.CloudFile
	if err != nil {
		return files, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		var err error
		files, err = ReleaseCloudFileReferencesTx(tx, userID, kind, ownerID)
		return err
	})
	return files, err
}

func ReleaseCloudFileReferencesTx(tx *gorm.DB, userID string, kind string, ownerID string) ([]model.CloudFile, error) {
	var files []model.CloudFile
	ids := tx.Model(&model.CloudFileReference{}).Select("file_id").Where("user_id = ? AND kind = ? AND owner_id = ?", userID, kind, ownerID)
	if err := tx.Where("id IN (?) AND deleted_at = ?", ids, "").Find(&files).Error; err != nil { return nil, err }
	err := tx.Where("user_id = ? AND kind = ? AND owner_id = ?", userID, kind, ownerID).Delete(&model.CloudFileReference{}).Error
	return files, err
}

func HasCloudFileReference(id string, userID string, now string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	query := db.Model(&model.CloudFileReference{}).Where("file_id = ? AND (expires_at = ? OR expires_at > ?)", id, "", now)
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	var count int64
	err = query.Count(&count).Error
	return count > 0, err
}

func ClaimCloudFileDeletion(id string, now string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	claimed := false
	err = db.Transaction(func(tx *gorm.DB) error {
		var file model.CloudFile
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&file).Error; err != nil {
			return err
		}
		if file.DeletedAt != "" || file.Purpose == model.CloudFilePurposeAvatar {
			return nil
		}
		refs := tx.Model(&model.CloudFileReference{}).Select("file_id").Where("file_id = ? AND (expires_at = ? OR expires_at > ?)", id, "", now)
		result := tx.Model(&model.CloudFile{}).Where("id = ? AND deleted_at = ? AND NOT EXISTS (?)", id, "", refs).Updates(map[string]any{"deleted_at": now, "updated_at": now})
		claimed = result.RowsAffected > 0
		return result.Error
	})
	return claimed, err
}
