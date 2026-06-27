package repository

import (
	"errors"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

// PromptCategories 返回内置提示词分类的副本。
func PromptCategories() []model.PromptCategory {
	result := make([]model.PromptCategory, len(promptCategories))
	copy(result, promptCategories)
	return result
}

// PromptCategoryByCode 根据分类编码查找内置提示词分类。
func PromptCategoryByCode(category string) (model.PromptCategory, bool) {
	categories, err := ListPromptCategories()
	if err != nil {
		categories = PromptCategories()
	}
	for _, item := range categories {
		if item.Category == category {
			return item, true
		}
	}
	return model.PromptCategory{}, false
}

// ListPromptCategories 返回内置提示词分类。
func ListPromptCategories() ([]model.PromptCategory, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if err := ensureDefaultPromptCategories(db); err != nil {
		return nil, err
	}
	var stored []model.PromptCategory
	if err := db.Find(&stored).Error; err != nil {
		return nil, err
	}
	byCategory := map[string]model.PromptCategory{}
	for _, item := range stored {
		byCategory[item.Category] = item
	}
	result := []model.PromptCategory{}
	seen := map[string]bool{}
	for _, item := range promptCategories {
		if storedItem, ok := byCategory[item.Category]; ok {
			result = append(result, storedItem)
		} else {
			result = append(result, item)
		}
		seen[item.Category] = true
	}
	for _, item := range stored {
		if !seen[item.Category] {
			result = append(result, item)
		}
	}
	return result, nil
}

// UpdatePromptCategory 保存提示词分类的可配置字段。
func UpdatePromptCategory(category string, enabled bool) ([]model.PromptCategory, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if err := ensureDefaultPromptCategories(db); err != nil {
		return nil, err
	}
	existing := model.PromptCategory{}
	err = db.Where("category = ?", category).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("未知提示词分类")
	}
	if err != nil {
		return nil, err
	}
	if err := db.Model(&existing).Update("enabled", enabled).Error; err != nil {
		return nil, err
	}
	return ListPromptCategories()
}

// ListPrompts 按查询条件返回提示词分页列表。
func ListPrompts(q model.Query) ([]model.Prompt, int64, error) {
	return listPrompts(q, nil)
}

// ListPromptsInCategories 按查询条件和分类白名单返回提示词分页列表。
func ListPromptsInCategories(q model.Query, categories []string) ([]model.Prompt, int64, error) {
	return listPrompts(q, categories)
}

func listPrompts(q model.Query, categories []string) ([]model.Prompt, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := applyPromptFilters(db.Model(&model.Prompt{}), q, categories)

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.Prompt
	if err := tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	categories, _ := ListPromptCategories()
	githubURLs := map[string]string{}
	for _, item := range categories {
		githubURLs[item.Category] = item.GithubURL
	}
	for i := range items {
		items[i].GithubURL = githubURLs[items[i].Category]
	}
	return items, total, nil
}

// ListPromptTags 返回当前提示词查询条件下的全部标签。
func ListPromptTags(q model.Query) ([]string, error) {
	return listPromptTags(q, nil)
}

// ListPromptTagsInCategories 返回分类白名单范围内的全部标签。
func ListPromptTagsInCategories(q model.Query, categories []string) ([]string, error) {
	return listPromptTags(q, categories)
}

func listPromptTags(q model.Query, categories []string) ([]string, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	q.Normalize()
	q.Tags = nil
	tx := applyPromptFilters(db.Model(&model.Prompt{}), q, categories)

	var items []model.Prompt
	if err := tx.Select("tags").Find(&items).Error; err != nil {
		return nil, err
	}
	return promptTagsFromItems(items), nil
}

// SavePrompt 保存提示词，并在更新时保留原创建时间。
func SavePrompt(item model.Prompt) (model.Prompt, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	if saved, ok, err := findPrompt(db, item.ID); err != nil {
		return item, err
	} else if ok && item.CreatedAt == "" {
		item.CreatedAt = saved.CreatedAt
	}
	item.GithubURL = ""
	return item, db.Save(&item).Error
}

// DeletePrompt 删除指定提示词。
func DeletePrompt(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.Prompt{}, "id = ?", id).Error
}

// DeletePrompts 批量删除提示词。
func DeletePrompts(ids []string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.Prompt{}, "id IN ?", ids).Error
}

// ReplacePromptCategory 用远程同步结果替换整个提示词分类。
func ReplacePromptCategory(category model.PromptCategory, items []model.Prompt) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("category = ?", category.Category).Delete(&model.Prompt{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		for i := range items {
			items[i].Category = category.Category
			items[i].GithubURL = ""
		}
		return tx.Create(&items).Error
	})
}

// applyPromptFilters 应用提示词列表的搜索条件。
func applyPromptFilters(tx *gorm.DB, q model.Query, categories []string) *gorm.DB {
	if categories != nil {
		if len(categories) == 0 {
			tx = tx.Where("1 = 0")
		} else {
			tx = tx.Where("category IN ?", categories)
		}
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("title LIKE ? OR prompt LIKE ?", like, like)
	}
	if isActivePromptOption(q.Category) {
		tx = tx.Where("category = ?", q.Category)
	}
	return applyPromptTagsFilter(tx, q.Tags)
}

// findPrompt 根据 ID 查询提示词。
func findPrompt(db *gorm.DB, id string) (model.Prompt, bool, error) {
	item := model.Prompt{}
	err := db.Where("id = ?", id).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.Prompt{}, false, nil
	}
	return item, err == nil, err
}

// applyPromptTagsFilter 应用 JSON 标签条件。
func applyPromptTagsFilter(tx *gorm.DB, tags []string) *gorm.DB {
	if len(tags) == 0 {
		return tx
	}
	condition := tx.Session(&gorm.Session{NewDB: true})
	for _, tag := range tags {
		condition = condition.Or(promptJSONTagsContains(tx), tag)
	}
	return tx.Where(condition)
}

func promptTagsFromItems(items []model.Prompt) []string {
	seen := map[string]bool{}
	tags := []string{}
	for _, item := range items {
		for _, tag := range item.Tags {
			if tag != "" && !seen[tag] {
				seen[tag] = true
				tags = append(tags, tag)
			}
		}
	}
	return tags
}

// promptJSONTagsContains 返回提示词 tags 的 JSON 包含条件。
func promptJSONTagsContains(tx *gorm.DB) string {
	switch tx.Dialector.Name() {
	case "mysql":
		return "JSON_CONTAINS(tags, JSON_QUOTE(?))"
	case "postgres":
		return "jsonb_exists(tags::jsonb, ?)"
	default:
		return "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)"
	}
}

// isActivePromptOption 判断提示词筛选项有效状态。
func isActivePromptOption(value string) bool {
	return value != "" && value != "全部" && value != "all"
}
