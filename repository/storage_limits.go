package repository

import (
	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

func lockStorageOwnerTx(tx *gorm.DB, userID string) error {
	if err := tx.Model(&model.User{}).Where("id = ?", userID).UpdateColumn("id", userID).Error; err != nil { return err }
	return tx.Where("id = ?", userID).First(&model.User{}).Error
}

func ReserveStorage(item model.StorageReservation, current int64, limit int64) (bool, error) {
	db, err := DB()
	if err != nil { return false, err }
	reserved := false
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockStorageOwnerTx(tx, item.UserID); err != nil { return err }
		if err := tx.Where("user_id = ? AND expires_at <= ?", item.UserID, current).Delete(&model.StorageReservation{}).Error; err != nil { return err }
		var stored, pending int64
		if err := tx.Model(&model.CloudFile{}).Where("user_id = ? AND deleted_at = ?", item.UserID, "").Select("COALESCE(SUM(size), 0)").Scan(&stored).Error; err != nil { return err }
		if err := tx.Model(&model.StorageReservation{}).Where("user_id = ?", item.UserID).Select("COALESCE(SUM(size), 0)").Scan(&pending).Error; err != nil { return err }
		if item.Size < 0 || item.Size > limit-stored-pending { return nil }
		if err := tx.Create(&item).Error; err != nil { return err }
		reserved = true
		return nil
	})
	return reserved, err
}

func ReleaseStorageReservation(id string) error {
	db, err := DB()
	if err != nil { return err }
	return db.Where("id = ?", id).Delete(&model.StorageReservation{}).Error
}

func SaveUserAssetFiles(asset model.UserAsset, ids []string, create bool, maxAssets int) (bool, error) {
	db, err := DB()
	if err != nil { return false, err }
	saved := false
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockStorageOwnerTx(tx, asset.UserID); err != nil { return err }
		if create {
			var count int64
			if err := tx.Model(&model.UserAsset{}).Where("user_id = ?", asset.UserID).Count(&count).Error; err != nil { return err }
			if count >= int64(maxAssets) { return nil }
			if err := tx.Create(&asset).Error; err != nil { return err }
		} else if err := tx.Where("id = ? AND user_id = ?", asset.ID, asset.UserID).First(&model.UserAsset{}).Error; err != nil { return err }
		for _, id := range ids {
			allowed, err := CanReferenceCloudFileTx(tx, asset.UserID, id, asset.CreatedAt)
			if err != nil { return err }
			if !allowed { return gorm.ErrRecordNotFound }
		}
		if err := SetCloudFileReferencesTx(tx, asset.UserID, "asset", asset.ID, ids, ""); err != nil { return err }
		saved = true
		return nil
	})
	return saved, err
}

func DeleteUserAssetFiles(userID, assetID string) ([]model.CloudFile, error) {
	db, err := DB()
	if err != nil { return nil, err }
	var files []model.CloudFile
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockStorageOwnerTx(tx, userID); err != nil { return err }
		if err := tx.Where("id = ? AND user_id = ?", assetID, userID).Delete(&model.UserAsset{}).Error; err != nil { return err }
		var err error
		files, err = ReleaseCloudFileReferencesTx(tx, userID, "asset", assetID)
		return err
	})
	return files, err
}
