package repository

import "github.com/basketikun/aivro/model"

func ListGenerationRetentionPolicies() ([]model.GenerationRetentionPolicy, error) {
	db, err := DB()
	if err != nil { return nil, err }
	items := []model.GenerationRetentionPolicy{}
	err = db.Find(&items).Error
	return items, err
}

func SaveGenerationRetentionPolicy(item model.GenerationRetentionPolicy) error {
	db, err := DB()
	if err != nil { return err }
	return db.Save(&item).Error
}

