package repository

import (
	"encoding/json"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GetSettings 返回 public 和 private 两行配置。
func GetSettings() (model.Settings, error) {
	db, err := DB()
	if err != nil {
		return model.Settings{}, err
	}
	var items []model.Setting
	if err := db.Find(&items).Error; err != nil {
		return model.Settings{}, err
	}
	result := model.Settings{}
	for _, item := range items {
		if item.Key == model.SettingKeyPrivate {
			_ = json.Unmarshal(item.Value, &result.Private)
		} else if item.Key == model.SettingKeyPublic {
			_ = json.Unmarshal(item.Value, &result.Public)
		}
	}
	return result, nil
}

// SaveAITimeouts 只更新生成期限，不覆盖其他配置或私有密钥。
func SaveAITimeouts(setting model.AITimeoutSetting, now string) error {
	db, err := DB()
	if err != nil { return err }
	return db.Transaction(func(tx *gorm.DB) error {
		item := model.Setting{Key: model.SettingKeyPrivate, Value: []byte("{}"), CreatedAt: now, UpdatedAt: now}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&item).Error; err != nil { return err }
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("key = ?", model.SettingKeyPrivate).First(&item).Error; err != nil { return err }
		var value map[string]json.RawMessage
		if err := json.Unmarshal(item.Value, &value); err != nil { return err }
		if value == nil { value = map[string]json.RawMessage{} }
		value["aiTimeouts"], _ = json.Marshal(setting)
		body, err := json.Marshal(value)
		if err != nil { return err }
		return tx.Model(&model.Setting{}).Where("key = ?", model.SettingKeyPrivate).Updates(model.Setting{Value: body, UpdatedAt: now}).Error
	})
}

// SaveSettings 保存 public 和 private 两行配置。
func SaveSettings(settings model.Settings, now string) (model.Settings, error) {
	db, err := DB()
	if err != nil {
		return settings, err
	}
	publicValue, _ := json.Marshal(settings.Public)
	privateValue, _ := json.Marshal(settings.Private)
	items := []model.Setting{
		{Key: model.SettingKeyPublic, Value: publicValue, CreatedAt: now, UpdatedAt: now},
		{Key: model.SettingKeyPrivate, Value: privateValue, CreatedAt: now, UpdatedAt: now},
	}
	err = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&items).Error
	return settings, err
}
