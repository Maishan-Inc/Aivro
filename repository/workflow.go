package repository

import (
	"strings"

	"github.com/basketikun/aivro/model"
)

func ListSharedWorkflows(userID string, q model.Query) (model.WorkflowList, error) {
	db, err := DB()
	if err != nil {
		return model.WorkflowList{}, err
	}
	q.Normalize()
	tx := db.Model(&model.Workflow{}).Where("user_id = ? AND deleted_at = ? AND source_share_id <> ?", userID, "", "")
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		tx = tx.Where("title LIKE ? ESCAPE '!'", LikePattern(keyword))
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return model.WorkflowList{}, err
	}
	items := []model.Workflow{}
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return model.WorkflowList{Items: items, Total: int(total)}, err
}
