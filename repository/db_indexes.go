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
		{
			name:  "idx_generation_tasks_payload_files",
			table: "generation_tasks",
			sql:   "CREATE INDEX IF NOT EXISTS idx_generation_tasks_payload_files ON generation_tasks(request_file_id, response_file_id)",
		},
		{
			name:  "idx_cloud_files_cleanup",
			table: "cloud_files",
			sql:   "CREATE INDEX IF NOT EXISTS idx_cloud_files_cleanup ON cloud_files(expires_at, deleted_at, provider, purpose, user_id)",
		},
		{
			name:  "idx_cloud_files_token",
			table: "cloud_files",
			sql:   "CREATE INDEX IF NOT EXISTS idx_cloud_files_token ON cloud_files(id, access_token, deleted_at)",
		},
		{
			name:  "idx_workflows_owner_slug",
			table: "workflows",
			sql:   "CREATE INDEX IF NOT EXISTS idx_workflows_owner_slug ON workflows(user_id, slug, deleted_at)",
		},
		{
			name:  "idx_workflow_share_stars_unique",
			table: "workflow_share_stars",
			sql:   "CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_share_stars_unique ON workflow_share_stars(share_id, user_id)",
		},
		{
			name:  "idx_canvas_assistant_user_workflow",
			table: "canvas_assistant_sessions",
			sql:   "CREATE INDEX IF NOT EXISTS idx_canvas_assistant_user_workflow ON canvas_assistant_sessions(user_id, workflow_id, deleted_at, updated_at)",
		},
		{
			name:  "idx_canvas_assistant_cleanup",
			table: "canvas_assistant_sessions",
			sql:   "CREATE INDEX IF NOT EXISTS idx_canvas_assistant_cleanup ON canvas_assistant_sessions(expires_at, deleted_at)",
		},
		{
			name:  "idx_workflow_community_public",
			table: "workflow_community_posts",
			sql:   "CREATE INDEX IF NOT EXISTS idx_workflow_community_public ON workflow_community_posts(status, deleted_at, locale, updated_at)",
		},
		{
			name:  "idx_workflow_community_owner",
			table: "workflow_community_posts",
			sql:   "CREATE INDEX IF NOT EXISTS idx_workflow_community_owner ON workflow_community_posts(user_id, deleted_at, updated_at)",
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
