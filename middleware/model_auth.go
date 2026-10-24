package middleware

import (
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

// ModelAuth 只用于模型、生成任务与文件接口；密钥不能管理账户或创建新密钥。
func ModelAuth(c *gin.Context) {
	if strings.TrimSpace(c.GetHeader("Authorization")) == "" {
		UserAuth(c)
		return
	}
	user, id, err := service.AuthenticateAPIKey(c.Request)
	if err != nil {
		if user, ok := authUser(c); ok && user.Role != model.UserRoleGuest {
			c.Request = c.Request.WithContext(service.WithUser(c.Request.Context(), user))
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 1, "data": nil, "msg": "API 密钥无效或已撤销"})
		return
	}
	ctx := service.WithAPIKey(service.WithUser(c.Request.Context(), user), id)
	c.Request = c.Request.WithContext(ctx)
	c.Next()
}

func OptionalModelAuth(c *gin.Context) {
	if strings.TrimSpace(c.GetHeader("Authorization")) != "" {
		ModelAuth(c)
		return
	}
	OptionalAuth(c)
}
