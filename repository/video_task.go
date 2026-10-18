package repository

import "github.com/basketikun/aivro/model"

func CreateVideoTask(task model.VideoTask) error {
	db, err := DB()
	if err != nil { return err }
	return db.Create(&task).Error
}

func GetUserVideoTask(userID string, id string) (model.VideoTask, error) {
	db, err := DB()
	var task model.VideoTask
	if err == nil { err = db.Where("id = ? AND user_id = ?", id, userID).First(&task).Error }
	return task, err
}
