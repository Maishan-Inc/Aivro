package repository

import (
	"errors"
	"time"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

func SaveGenerationTask(item model.GenerationTask) (model.GenerationTask, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func GetGenerationTask(id string) (model.GenerationTask, bool, error) {
	db, err := DB()
	if err != nil {
		return model.GenerationTask{}, false, err
	}
	item := model.GenerationTask{}
	err = db.Where("id = ?", id).First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return item, false, nil
		}
		return item, false, err
	}
	return item, true, nil
}

func ListUserGenerationTasks(userID string, limit int) ([]model.GenerationTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	items := []model.GenerationTask{}
	err = db.Where("user_id = ?", userID).Order("created_at desc").Limit(limit).Find(&items).Error
	return items, err
}

func CountQueuedUserTasks(userID string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var count int64
	err = db.Model(&model.GenerationTask{}).Where("user_id = ? AND status = ?", userID, model.GenerationTaskQueued).Count(&count).Error
	return count, err
}

func CountQueuedModelTasks(modelName string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var count int64
	err = db.Model(&model.GenerationTask{}).Where("model = ? AND status = ?", modelName, model.GenerationTaskQueued).Count(&count).Error
	return count, err
}

func CountDispatchedGenerationTasks(modelName string, since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var count int64
	err = db.Model(&model.GenerationTask{}).Where("model = ? AND started_at >= ?", modelName, since).Count(&count).Error
	return count, err
}

func CountQueuedBefore(modelName string, createdAt string, id string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var count int64
	err = db.Model(&model.GenerationTask{}).Where("model = ? AND status = ? AND (created_at < ? OR (created_at = ? AND id < ?))", modelName, model.GenerationTaskQueued, createdAt, createdAt, id).Count(&count).Error
	return count, err
}

func ListQueuedModels() ([]string, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	models := []string{}
	err = db.Model(&model.GenerationTask{}).Where("status = ?", model.GenerationTaskQueued).Distinct().Pluck("model", &models).Error
	return models, err
}

func ListQueuedGenerationTasks(modelName string, limit int) ([]model.GenerationTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 1
	}
	items := []model.GenerationTask{}
	err = db.Where("model = ? AND status = ?", modelName, model.GenerationTaskQueued).Order("created_at asc, id asc").Limit(limit).Find(&items).Error
	return items, err
}

func UpdateGenerationTaskStatus(id string, status model.GenerationTaskStatus, fields map[string]any) error {
	db, err := DB()
	if err != nil {
		return err
	}
	fields["status"] = status
	fields["updated_at"] = time.Now().Format(time.RFC3339)
	return db.Model(&model.GenerationTask{}).Where("id = ?", id).Updates(fields).Error
}

func MarkQueuedTaskExecuting(id string, startedAt string, workerID string, leaseExpiresAt string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	tx := db.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", id, model.GenerationTaskQueued).Updates(map[string]any{
		"status":         model.GenerationTaskExecuting,
		"queue_position": 0,
		"started_at":     startedAt,
		"updated_at":     startedAt,
		"worker_id": workerID,
		"lease_expires_at": leaseExpiresAt,
	})
	return tx.RowsAffected > 0, tx.Error
}

func FinishGenerationTask(task model.GenerationTask, status model.GenerationTaskStatus, fields map[string]any, refund *model.CreditLog) (bool, error) {
	db, err := DB()
	if err != nil { return false, err }
	changed := false
	err = db.Transaction(func(tx *gorm.DB) error {
		fields["status"], fields["updated_at"] = status, time.Now().Format(time.RFC3339)
		result := tx.Model(&model.GenerationTask{}).Where("id = ? AND status = ? AND worker_id = ?", task.ID, task.Status, task.WorkerID).Updates(fields)
		if result.Error != nil || result.RowsAffected == 0 { return result.Error }
		changed = true
		if refund == nil || refund.Amount == 0 { return nil }
		creditQuery := tx.Model(&model.User{}).Where("id = ?", task.UserID)
		if refund.Amount < 0 { creditQuery = creditQuery.Where("credits >= ? AND status = ?", -refund.Amount, model.UserStatusActive) }
		creditResult := creditQuery.Updates(map[string]any{"credits": gorm.Expr("credits + ?", refund.Amount), "updated_at": refund.CreatedAt})
		if creditResult.Error != nil { return creditResult.Error }
		if creditResult.RowsAffected == 0 { return errors.New("用户不存在或算力点不足") }
		var user model.User
		if err := tx.Where("id = ?", task.UserID).First(&user).Error; err != nil { return err }
		refund.Balance = user.Credits
		return tx.Create(refund).Error
	})
	return changed, err
}

func ListExpiredExecutingTasks(now string) ([]model.GenerationTask, error) {
	db, err := DB()
	if err != nil { return nil, err }
	items := []model.GenerationTask{}
	err = db.Where("status = ? AND lease_expires_at != ? AND lease_expires_at <= ?", model.GenerationTaskExecuting, "", now).Limit(100).Find(&items).Error
	return items, err
}

func RecalculateGenerationTaskPositions(modelName string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	items := []model.GenerationTask{}
	if err := db.Select("id").Where("model = ? AND status = ?", modelName, model.GenerationTaskQueued).Order("created_at asc, id asc").Find(&items).Error; err != nil {
		return err
	}
	for i, item := range items {
		if err := db.Model(&model.GenerationTask{}).Where("id = ?", item.ID).Update("queue_position", i+1).Error; err != nil {
			return err
		}
	}
	return nil
}

func DeleteOldGenerationTasks(before string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("status IN ? AND finished_at != ? AND finished_at < ?", []model.GenerationTaskStatus{model.GenerationTaskSucceeded, model.GenerationTaskFailed, model.GenerationTaskCanceled}, "", before).Delete(&model.GenerationTask{}).Error
}

func ListOldGenerationTasks(before string, limit int) ([]model.GenerationTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	items := []model.GenerationTask{}
	err = db.Where("status IN ? AND finished_at != ? AND finished_at < ?", []model.GenerationTaskStatus{model.GenerationTaskSucceeded, model.GenerationTaskFailed, model.GenerationTaskCanceled}, "", before).Order("finished_at asc").Limit(limit).Find(&items).Error
	return items, err
}

func DeleteGenerationTask(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.GenerationTask{}, "id = ?", id).Error
}
