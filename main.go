package main

import (
	"log"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/handler"
	"github.com/basketikun/aivro/router"
	"github.com/basketikun/aivro/service"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	if err := service.EnsureDatabaseUpdated(); err != nil {
		log.Fatal(err)
	}
	if err := service.EnsureDefaultAdmin(); err != nil {
		log.Fatal(err)
	}
	service.StartPromptSyncScheduler()
	service.StartCloudStorageCleanupScheduler()
	service.RegisterAIProxyExecutor(handler.ExecuteAIProxyTask)
	service.StartGenerationQueueScheduler()
	log.Fatal(router.New().Run(":" + config.Cfg.Port))
}
