package middleware

import (
	"net/http"

	"github.com/basketikun/aivro/service"
	"github.com/gin-gonic/gin"
)

func Security(c *gin.Context) {
	c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Frame-Options", "DENY")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	if err := service.CheckRequestOrigin(c.Request); err != nil {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 1, "data": nil, "msg": "请求来源无效"})
		return
	}
	c.Next()
}
