package repository

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var promptCategories = []model.PromptCategory{
	{Category: "system", Name: "系统", Description: "系统提示词分类"},
	{Category: "gpt-image-2-prompts", Name: "GPT Image 2 Prompts", Description: "EvoLinkAI 的 GPT Image 2 案例提示词分类", GithubURL: "https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts", Remote: true},
	{Category: "awesome-gpt-image", Name: "Awesome GPT Image", Description: "ZeroLu 的中文 GPT Image 提示词分类", GithubURL: "https://github.com/ZeroLu/awesome-gpt-image", Remote: true},
	{Category: "awesome-gpt4o-image-prompts", Name: "Awesome GPT4o Image Prompts", Description: "ImgEdify 的 GPT-4o 图像提示词分类", GithubURL: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", Remote: true},
	{Category: "youmind-gpt-image-2", Name: "YouMind GPT Image 2", Description: "YouMind OpenLab 的 GPT Image 2 中文提示词分类", GithubURL: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", Remote: true},
	{Category: "youmind-nano-banana-pro", Name: "YouMind Nano Banana Pro", Description: "YouMind OpenLab 的 Nano Banana Pro 中文提示词分类", GithubURL: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", Remote: true},
	{Category: "davidwu-gpt-image2-prompts", Name: "awesome-gpt-image2-prompts", Description: "davidwuw0811-boop 整理的 GPT Image 2 提示词分类", GithubURL: "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts", Remote: true},
}

var (
	db     *gorm.DB
	dbOnce sync.Once
	dbErr  error
)

var databaseMigrationSources = []string{
	"repository/db.go",
	"model/user.go",
	"model/content.go",
	"model/setting.go",
}

// DB 初始化并返回全局数据库连接。
func DB() (*gorm.DB, error) {
	dbOnce.Do(func() {
		driver := strings.ToLower(strings.TrimSpace(config.Cfg.StorageDriver))
		if driver == "" {
			driver = "sqlite"
		}
		dsn := config.Cfg.DatabaseDSN
		if driver == "sqlite" && dsn != ":memory:" {
			_ = os.MkdirAll(filepath.Dir(dsn), 0755)
		}
		db, dbErr = gorm.Open(dialector(driver, dsn), &gorm.Config{})
		if dbErr != nil {
			return
		}
		dbErr = migrateModels(db)
	})
	return db, dbErr
}

// UpdateDatabase 重新执行当前模型的自动迁移，用于补齐新增表和新增字段。
func UpdateDatabase() error {
	db, err := DB()
	if err != nil {
		return err
	}
	err = migrateModels(db)
	status := "success"
	message := ""
	if err != nil {
		status = "error"
		message = err.Error()
	}
	_ = db.Create(&model.DatabaseUpdateLog{
		ID:         "db-update-" + uuid.NewString(),
		SourceFile: strings.Join(databaseMigrationSources, "\n"),
		Models:     strings.Join(databaseMigrationModels(), "\n"),
		Status:     status,
		Error:      message,
		CreatedAt:  time.Now().Format(time.RFC3339),
	}).Error
	return err
}

func DatabaseStatus() (model.DatabaseStatus, error) {
	db, err := DB()
	if err != nil {
		return model.DatabaseStatus{}, err
	}
	missing := make([]string, 0)
	for _, item := range databaseMigrationModelItems() {
		if !db.Migrator().HasTable(item.value) {
			missing = append(missing, item.name)
		}
	}
	logs := []model.DatabaseUpdateLog{}
	_ = db.Order("created_at desc").Limit(30).Find(&logs).Error
	return model.DatabaseStatus{
		Updated:     len(missing) == 0,
		SourceFiles: databaseMigrationSources,
		Missing:     missing,
		Logs:        logs,
	}, nil
}

func migrateModels(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.EmailVerification{},
		&model.CreditLog{},
		&model.Prompt{},
		&model.Asset{},
		&model.Setting{},
		&model.CloudFile{},
		&model.DatabaseUpdateLog{},
	)
}

func databaseMigrationModels() []string {
	items := databaseMigrationModelItems()
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.name)
	}
	return names
}

func databaseMigrationModelItems() []struct {
	name  string
	value any
} {
	return []struct {
		name  string
		value any
	}{
		{"model.User", &model.User{}},
		{"model.EmailVerification", &model.EmailVerification{}},
		{"model.CreditLog", &model.CreditLog{}},
		{"model.Prompt", &model.Prompt{}},
		{"model.Asset", &model.Asset{}},
		{"model.Setting", &model.Setting{}},
		{"model.CloudFile", &model.CloudFile{}},
		{"model.DatabaseUpdateLog", &model.DatabaseUpdateLog{}},
	}
}

func dialector(driver string, dsn string) gorm.Dialector {
	switch driver {
	case "mysql":
		return mysql.Open(dsn)
	case "postgres", "postgresql":
		return postgres.Open(dsn)
	default:
		return sqlite.Open(dsn)
	}
}
