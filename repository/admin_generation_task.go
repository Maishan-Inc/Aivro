package repository

import "github.com/basketikun/aivro/model"

func ListAdminGenerationTasks(query model.Query) ([]model.GenerationTask, int, error) {
	db, err := DB()
	if err != nil { return nil, 0, err }
	query.Normalize()
	tx := db.Model(&model.GenerationTask{})
	if query.Keyword != "" {
		like := LikePattern(query.Keyword)
		users := db.Model(&model.User{}).Select("id").Where("display_name LIKE ? ESCAPE '!' OR username LIKE ? ESCAPE '!'", like, like)
		tx = tx.Where("id LIKE ? ESCAPE '!' OR username LIKE ? ESCAPE '!' OR user_id LIKE ? ESCAPE '!' OR model LIKE ? ESCAPE '!' OR prompt LIKE ? ESCAPE '!' OR user_id IN (?)", like, like, like, like, like, users)
	}
	if query.Category != "" { tx = tx.Where("status = ?", query.Category) }
	if query.Type != "" { tx = tx.Where("section = ?", query.Type) }
	if query.StartTime != "" { tx = tx.Where("created_at >= ?", query.StartTime) }
	if query.EndTime != "" { tx = tx.Where("created_at <= ?", query.EndTime) }
	var total int64
	if err := tx.Count(&total).Error; err != nil { return nil, 0, err }
	items := []model.GenerationTask{}
	err = tx.Omit("parameters", "response_header", "error_detail").Order("created_at desc, id desc").Offset(query.Offset()).Limit(query.PageSize).Find(&items).Error
	return items, int(total), err
}

func ListGenerationTaskFiles(taskID string) ([]model.CloudFile, error) {
	db, err := DB()
	if err != nil { return nil, err }
	items := []model.CloudFile{}
	err = db.Where("generation_task_id = ?", taskID).Order("created_at asc").Find(&items).Error
	return items, err
}

func UpdateGenerationTaskProgress(task model.GenerationTask, fields map[string]any) error {
	db, err := DB()
	if err != nil { return err }
	tx := db.Model(&model.GenerationTask{}).Where("id = ? AND status = ? AND worker_id = ?", task.ID, model.GenerationTaskExecuting, task.WorkerID)
	if _, diagnostic := fields["error_detail"]; diagnostic { tx = tx.Where("error_detail = ''") }
	return tx.Updates(fields).Error
}

func ClearGenerationTaskPayloads(id string) error {
	db, err := DB()
	if err != nil { return err }
	return db.Model(&model.GenerationTask{}).Where("id = ?", id).Updates(map[string]any{"request_file_id": "", "response_file_id": "", "response_header": ""}).Error
}
