package repository

import (
	"time"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func MutateRateBucket(key string, mutate func(*model.RateLimitBucket)) error {
	db, err := DB()
	if err != nil { return err }
	return db.Transaction(func(tx *gorm.DB) error {
		bucket := model.RateLimitBucket{BucketKey: key, ResetAt: time.Unix(0, 0), BlockedAt: time.Unix(0, 0)}
		// Upsert acquires a write lock on all supported databases, including SQLite.
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "bucket_key"}}, DoUpdates: clause.Assignments(map[string]any{"bucket_key": key})}).Create(&bucket).Error; err != nil { return err }
		if err := tx.Where("bucket_key = ?", key).First(&bucket).Error; err != nil { return err }
		mutate(&bucket)
		return tx.Save(&bucket).Error
	})
}

func DeleteExpiredRateBuckets(current time.Time) error {
	db, err := DB()
	if err != nil { return err }
	return db.Where("reset_at < ? AND blocked_at < ?", current, current).Delete(&model.RateLimitBucket{}).Error
}
