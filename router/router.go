package router

import (
	"net/http"

	"github.com/basketikun/aivro/handler"
	"github.com/basketikun/aivro/middleware"
	"github.com/gin-gonic/gin"
)

func New() *gin.Engine {
	router := gin.Default()
	router.RedirectTrailingSlash = false
	_ = router.SetTrustedProxies(nil)
	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	api.POST("/auth/register", gin.WrapF(handler.Register))
	api.POST("/auth/register/check", gin.WrapF(handler.CheckRegisterEmail))
	api.POST("/auth/register/code", gin.WrapF(handler.SendRegisterEmailCode))
	api.POST("/auth/login", gin.WrapF(handler.Login))
	api.POST("/auth/email-code", gin.WrapF(handler.SendEmailCode))
	api.POST("/auth/reset-password", gin.WrapF(handler.ResetPassword))
	api.POST("/auth/metamask/login", gin.WrapF(handler.MetaMaskLogin))
	api.GET("/auth/linux-do/authorize", gin.WrapF(handler.LinuxDoAuthorize))
	api.GET("/auth/linux-do/callback", gin.WrapF(handler.LinuxDoCallback))
	api.GET("/auth/oauth/:provider/authorize", func(c *gin.Context) {
		handler.OAuthAuthorize(c.Writer, c.Request, c.Param("provider"))
	})
	api.GET("/auth/oauth/:provider/callback", func(c *gin.Context) {
		handler.OAuthCallback(c.Writer, c.Request, c.Param("provider"))
	})
	api.GET("/auth/me", middleware.OptionalAuth, gin.WrapF(handler.CurrentUser))
	api.GET("/settings", gin.WrapF(handler.Settings))
	api.GET("/files/:id/content", middleware.OptionalAuth, func(c *gin.Context) {
		handler.FileContent(c.Writer, c.Request, c.Param("id"))
	})
	v1 := api.Group("/v1", middleware.UserAuth)
	v1.POST("/files", gin.WrapF(handler.UploadFile))
	v1.POST("/images/generations", gin.WrapF(handler.AIImagesGenerations))
	v1.POST("/images/edits", gin.WrapF(handler.AIImagesEdits))
	v1.POST("/chat/completions", gin.WrapF(handler.AIChatCompletions))
	v1.POST("/videos", gin.WrapF(handler.AIVideos))
	v1.GET("/videos/:id", func(c *gin.Context) {
		handler.AIVideo(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/videos/:id/content", func(c *gin.Context) {
		handler.AIVideoContent(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/generation-histories", gin.WrapF(handler.GenerationHistories))
	v1.POST("/generation-histories", gin.WrapF(handler.SaveGenerationHistory))
	v1.DELETE("/generation-histories/:id", func(c *gin.Context) {
		handler.DeleteGenerationHistory(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/preferences", gin.WrapF(handler.UserPreference))
	v1.POST("/preferences", gin.WrapF(handler.SaveUserPreference))
	v1.POST("/profile", gin.WrapF(handler.CompleteProfile))
	v1.GET("/workflows", gin.WrapF(handler.Workflows))
	v1.POST("/workflows", gin.WrapF(handler.CreateWorkflow))
	v1.GET("/workflows/:id", func(c *gin.Context) {
		handler.Workflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.PUT("/workflows/:id", func(c *gin.Context) {
		handler.UpdateWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.DELETE("/workflows/:id", func(c *gin.Context) {
		handler.DeleteWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/share", func(c *gin.Context) {
		handler.ShareWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/workflow-shares/:token", func(c *gin.Context) {
		handler.WorkflowShare(c.Writer, c.Request, c.Param("token"))
	})
	v1.POST("/workflow-shares/:token/verify", func(c *gin.Context) {
		handler.VerifyWorkflowShare(c.Writer, c.Request, c.Param("token"))
	})
	v1.POST("/workflow-shares/:token/copy", func(c *gin.Context) {
		handler.CopyWorkflowShare(c.Writer, c.Request, c.Param("token"))
	})
	v1.POST("/workflow-shares/:token/revoke", func(c *gin.Context) {
		handler.RevokeWorkflowShare(c.Writer, c.Request, c.Param("token"))
	})
	v1.GET("/plans", gin.WrapF(handler.Plans))
	v1.POST("/checkout/stripe", gin.WrapF(handler.StripeCheckout))
	v1.POST("/kyc/session", gin.WrapF(handler.KYCSession))
	v1.GET("/kyc/status", gin.WrapF(handler.KYCStatus))
	api.GET("/prompts", middleware.OptionalAuth, gin.WrapF(handler.Prompts))
	api.GET("/assets", middleware.OptionalAuth, gin.WrapF(handler.Assets))
	api.POST("/admin/login", gin.WrapF(handler.AdminLogin))
	api.POST("/webhooks/stripe", gin.WrapF(handler.StripeWebhook))
	api.POST("/webhooks/didit", gin.WrapF(handler.DiditWebhook))

	admin := api.Group("/admin", middleware.AdminAuth)
	admin.GET("/users", gin.WrapF(handler.AdminUsers))
	admin.GET("/users/auth-provider-stats", gin.WrapF(handler.AdminAuthProviderStats))
	admin.POST("/users", gin.WrapF(handler.AdminSaveUser))
	admin.POST("/users/:id/credits", func(c *gin.Context) {
		handler.AdminAdjustUserCredits(c.Writer, c.Request, c.Param("id"))
	})
	admin.DELETE("/users/:id", func(c *gin.Context) {
		handler.AdminDeleteUser(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/credit-logs", gin.WrapF(handler.AdminCreditLogs))
	admin.POST("/credit-logs", gin.WrapF(handler.AdminSaveCreditLog))
	admin.DELETE("/credit-logs/:id", func(c *gin.Context) {
		handler.AdminDeleteCreditLog(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/settings", gin.WrapF(handler.AdminSettings))
	admin.POST("/settings", gin.WrapF(handler.AdminSaveSettings))
	admin.GET("/database/status", gin.WrapF(handler.AdminDatabaseStatus))
	admin.POST("/settings/database-update", gin.WrapF(handler.AdminUpdateDatabase))
	admin.POST("/settings/channel-models", gin.WrapF(handler.AdminChannelModels))
	admin.POST("/settings/channel-test", gin.WrapF(handler.AdminTestChannelModel))
	admin.POST("/settings/mail-test", gin.WrapF(handler.AdminTestMail))
	admin.POST("/settings/cloud-storage-test", gin.WrapF(handler.AdminTestCloudStorage))
	admin.GET("/plans", gin.WrapF(handler.AdminPlans))
	admin.POST("/plans", gin.WrapF(handler.AdminSavePlan))
	admin.PUT("/plans/:id", gin.WrapF(handler.AdminSavePlan))
	admin.GET("/prompt-categories", gin.WrapF(handler.AdminPromptCategories))
	admin.POST("/prompt-categories/sync", gin.WrapF(handler.AdminSyncPromptCategories))
	admin.GET("/prompts", gin.WrapF(handler.AdminPrompts))
	admin.POST("/prompts", gin.WrapF(handler.AdminSavePrompt))
	admin.POST("/prompts/batch-delete", gin.WrapF(handler.AdminDeletePrompts))
	admin.DELETE("/prompts/:id", func(c *gin.Context) {
		handler.AdminDeletePrompt(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/assets", gin.WrapF(handler.AdminAssets))
	admin.POST("/assets", gin.WrapF(handler.AdminSaveAsset))
	admin.DELETE("/assets/:id", func(c *gin.Context) {
		handler.AdminDeleteAsset(c.Writer, c.Request, c.Param("id"))
	})

	router.NoRoute(middleware.NotFoundJSON)

	return router
}
