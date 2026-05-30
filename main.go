package main

import (
	"log"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/router"
	"github.com/basketikun/aivro/service"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	if err := service.EnsureDefaultAdmin(); err != nil {
		log.Fatal(err)
	}
	service.StartPromptSyncScheduler()
	log.Fatal(router.New().Run(":" + config.Cfg.Port))
}
