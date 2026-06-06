package repository

import (
	"log"

	"gorm.io/gorm"
)

// createOptimizedIndexes 为高频查询创建复合索引，提升队列性能。
// GORM AutoMigrate 只创建单列索引，复合索引需手动创建。
func createOptimizedIndexes(db *gorm.DB) error {
	indexes := []struct {
		name  string
		table string
		sql   string
	}{
		{
			name:  "idx_generation_tasks_queue_dispatch",
			table: "generation_tasks",
			sql:   "CREATE INDEX IF NOT EXISTS idx_generation_tasks_queue_dispatch ON generation_tasks(model, status, created_at, id)",
		},
		{
			name:  "idx_generation_tasks_user_queue",
			table: "generation_tasks",
			sql:   "CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_queue ON generation_tasks(user_id, status)",
		},
		{
			name:  "idx_generation_tasks_cleanup",
			table: "generation_tasks",
			sql:   "CREATE INDEX IF NOT EXISTS idx_generation_tasks_cleanup ON generation_tasks(status, finished_at)",
		},
	}

	for _, idx := range indexes {
		if err := db.Exec(idx.sql).Error; err != nil {
			log.Printf("create index %s failed (may already exist): %v", idx.name, err)
			// 继续创建其他索引，不因单个失败而中断
		}
	}
	return nil
}
