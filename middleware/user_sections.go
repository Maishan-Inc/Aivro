package middleware

import (
	"strings"

	"github.com/basketikun/aivro/handler"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
	"github.com/gin-gonic/gin"
)

func SectionAccess(c *gin.Context) {
	path := strings.TrimPrefix(c.Request.URL.Path, "/api/v1")
	section := model.UserSection("")
	switch {
	case strings.HasPrefix(path, "/workflow-community"):
		section = model.UserSectionCommunity
	case strings.HasPrefix(path, "/workflow-shares"), strings.HasPrefix(path, "/workflow-share-paths"), strings.HasSuffix(path, "/share"):
		section = model.UserSectionShares
	case strings.HasPrefix(path, "/workflows"):
		section = model.UserSectionWorkflow
	case strings.HasPrefix(path, "/images/"):
		section = model.UserSectionImage
	case strings.HasPrefix(path, "/videos"):
		section = model.UserSectionVideo
	case strings.HasPrefix(path, "/model-3d/"):
		section = model.UserSectionModel3D
	}
	user, _ := service.UserFromContext(c.Request.Context())
	if strings.HasSuffix(path, "/copy") {
		if err := service.CheckSectionAccess(user, model.UserSectionWorkflow); err != nil {
			handler.FailError(c.Writer, err)
			c.Abort()
			return
		}
	}
	if err := service.CheckSectionAccess(user, section); err != nil {
		handler.FailError(c.Writer, err)
		c.Abort()
		return
	}
	c.Next()
}
