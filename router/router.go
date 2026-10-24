package router

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/basketikun/aivro/handler"
	"github.com/basketikun/aivro/middleware"
	"github.com/basketikun/aivro/service"
	"github.com/gin-gonic/gin"
)

func New() *gin.Engine {
	router := gin.New()
	router.Use(gin.LoggerWithFormatter(accessLogFormatter), gin.Recovery())
	router.RedirectTrailingSlash = false
	_ = router.SetTrustedProxies(nil)
	router.GET("/ads.txt", gin.WrapF(handler.AdsTxt))
	api := router.Group("/api")
	api.Use(middleware.Security)
	api.Use(func(c *gin.Context) {
		limit := int64(80 << 20)
		if strings.HasPrefix(c.Request.URL.Path, "/api/webhooks/") || strings.HasPrefix(c.Request.URL.Path, "/api/auth/") || c.Request.URL.Path == "/api/admin/login" {
			limit = 1 << 20
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	})
	api.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	api.POST("/auth/register", gin.WrapF(handler.Register))
	api.POST("/auth/register/code", gin.WrapF(handler.SendRegisterEmailCode))
	api.POST("/auth/login", gin.WrapF(handler.Login))
	api.GET("/auth/captcha-session", gin.WrapF(handler.CaptchaSession))
	api.POST("/auth/logout", gin.WrapF(handler.Logout))
	api.POST("/auth/email-code", gin.WrapF(handler.SendEmailCode))
	api.POST("/auth/reset-password", gin.WrapF(handler.ResetPassword))
	api.POST("/auth/metamask/challenge", gin.WrapF(handler.MetaMaskChallenge))
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
	api.GET("/files/:id/content", middleware.OptionalModelAuth, func(c *gin.Context) {
		handler.FileContent(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/workflow-share-paths/:username/:slug", middleware.OptionalAuth, func(c *gin.Context) {
		handler.WorkflowShareByPath(c.Writer, c.Request, c.Param("username"), c.Param("slug"))
	})
	api.POST("/workflow-share-paths/:username/:slug/verify", middleware.OptionalAuth, func(c *gin.Context) {
		handler.VerifyWorkflowShareByPath(c.Writer, c.Request, c.Param("username"), c.Param("slug"))
	})
	v1 := api.Group("/v1", middleware.UserAuth)
	v1.GET("/api-keys", gin.WrapF(handler.UserAPIKeys))
	v1.POST("/api-keys", gin.WrapF(handler.CreateUserAPIKey))
	v1.DELETE("/api-keys/:id", func(c *gin.Context) { handler.RevokeUserAPIKey(c.Writer, c.Request, c.Param("id")) })
	modelAPI := api.Group("/v1", middleware.ModelAuth)
	modelAPI.GET("/models", gin.WrapF(handler.APIModels))
	modelAPI.POST("/files", gin.WrapF(handler.UploadFile))
	v1.POST("/asset-files", func(c *gin.Context) { handler.RetainAssetFiles(c.Writer, c.Request, "") })
	v1.POST("/asset-files/:id", func(c *gin.Context) { handler.RetainAssetFiles(c.Writer, c.Request, c.Param("id")) })
	v1.DELETE("/asset-files/:id", func(c *gin.Context) { handler.ReleaseAssetFiles(c.Writer, c.Request, c.Param("id")) })
	modelAPI.POST("/images/generations", gin.WrapF(handler.AIImagesGenerations))
	modelAPI.POST("/images/edits", gin.WrapF(handler.AIImagesEdits))
	modelAPI.POST("/chat/completions", gin.WrapF(handler.AIChatCompletions))
	modelAPI.POST("/videos", gin.WrapF(handler.AIVideos))
	modelAPI.GET("/videos/:id", func(c *gin.Context) {
		handler.AIVideo(c.Writer, c.Request, c.Param("id"))
	})
	modelAPI.GET("/videos/:id/content", func(c *gin.Context) {
		handler.AIVideoContent(c.Writer, c.Request, c.Param("id"))
	})
	modelAPI.POST("/model-3d/generations", gin.WrapF(handler.AIModel3DGenerations))
	modelAPI.GET("/model-3d/generations/:id", func(c *gin.Context) {
		handler.AIModel3DGeneration(c.Writer, c.Request, c.Param("id"))
	})
	modelAPI.GET("/generation-tasks", gin.WrapF(handler.GenerationTasks))
	modelAPI.GET("/generation-tasks/:id", func(c *gin.Context) {
		handler.GenerationTask(c.Writer, c.Request, c.Param("id"))
	})
	modelAPI.GET("/generation-tasks/:id/result", func(c *gin.Context) {
		handler.GenerationTaskResult(c.Writer, c.Request, c.Param("id"))
	})
	modelAPI.DELETE("/generation-tasks/:id", func(c *gin.Context) {
		handler.CancelGenerationTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/generation-histories", gin.WrapF(handler.GenerationHistories))
	v1.POST("/generation-histories", gin.WrapF(handler.SaveGenerationHistory))
	v1.DELETE("/generation-histories/:id", func(c *gin.Context) {
		handler.DeleteGenerationHistory(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/credit-logs", gin.WrapF(handler.CreditLogs))
	v1.GET("/preferences", gin.WrapF(handler.UserPreference))
	v1.POST("/preferences", gin.WrapF(handler.SaveUserPreference))
	v1.POST("/profile", gin.WrapF(handler.CompleteProfile))
	v1.POST("/profile/avatar", gin.WrapF(handler.UploadAvatar))
	v1.GET("/workflows", gin.WrapF(handler.Workflows))
	v1.POST("/workflows", gin.WrapF(handler.CreateWorkflow))
	v1.GET("/workflow-community", gin.WrapF(handler.CommunityWorkflows))
	v1.GET("/workflow-community/me", gin.WrapF(handler.MyCommunityWorkflows))
	v1.POST("/workflow-community", gin.WrapF(handler.PublishCommunityWorkflow))
	v1.GET("/workflow-community/:token", func(c *gin.Context) {
		handler.CommunityWorkflow(c.Writer, c.Request, c.Param("token"))
	})
	v1.POST("/workflow-community/:id/sync", func(c *gin.Context) {
		handler.SyncCommunityWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.DELETE("/workflow-community/:id", func(c *gin.Context) {
		handler.DeleteCommunityWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/workflows/:id/assistant-sessions", func(c *gin.Context) {
		handler.CanvasAssistantSessions(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/assistant-sessions/message", func(c *gin.Context) {
		handler.SendCanvasAssistantMessage(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/canvas-agent/plan", func(c *gin.Context) {
		handler.PlanCanvasAgent(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/assistant-sessions/batch-delete", func(c *gin.Context) {
		handler.BatchDeleteCanvasAssistantSessions(c.Writer, c.Request, c.Param("id"))
	})
	v1.DELETE("/workflows/:id/assistant-sessions/:sessionId", func(c *gin.Context) {
		handler.DeleteCanvasAssistantSession(c.Writer, c.Request, c.Param("id"), c.Param("sessionId"))
	})
	v1.GET("/workflows/:id/share", func(c *gin.Context) {
		handler.WorkflowActiveShare(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/share", func(c *gin.Context) {
		handler.ShareWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/workflows/:id", func(c *gin.Context) {
		handler.Workflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.PUT("/workflows/:id", func(c *gin.Context) {
		handler.UpdateWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.DELETE("/workflows/:id", func(c *gin.Context) {
		handler.DeleteWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflows/:id/delete", func(c *gin.Context) {
		handler.DeleteWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/workflow-share-paths/:username/:slug/copy", func(c *gin.Context) {
		handler.CopyWorkflowShareByPath(c.Writer, c.Request, c.Param("username"), c.Param("slug"))
	})
	v1.POST("/workflow-share-paths/:username/:slug/star", func(c *gin.Context) {
		handler.ToggleWorkflowShareStar(c.Writer, c.Request, c.Param("username"), c.Param("slug"))
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
	api.GET("/v1/plans", gin.WrapF(handler.Plans))
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
	admin.POST("/users/:id/workflow-create-credits", func(c *gin.Context) {
		handler.AdminAdjustUserWorkflowCreateCredits(c.Writer, c.Request, c.Param("id"))
	})
	admin.DELETE("/users/:id", func(c *gin.Context) {
		handler.AdminDeleteUser(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/request-logs", gin.WrapF(handler.AdminCreditLogs))
	admin.GET("/audit-logs", gin.WrapF(handler.AdminAuditLogs))
	admin.GET("/credit-logs", gin.WrapF(handler.AdminCreditLogs))
	admin.GET("/settings", gin.WrapF(handler.AdminSettings))
	admin.POST("/settings", gin.WrapF(handler.AdminSaveSettings))
	admin.POST("/settings/ai-timeouts", gin.WrapF(handler.AdminSaveAITimeouts))
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
	admin.PUT("/prompt-categories/:category", func(c *gin.Context) {
		handler.AdminSavePromptCategory(c.Writer, c.Request, c.Param("category"))
	})
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
	admin.GET("/workflow-community", gin.WrapF(handler.AdminCommunityWorkflows))
	admin.POST("/workflow-community/:id/ban", func(c *gin.Context) {
		handler.AdminBanCommunityWorkflow(c.Writer, c.Request, c.Param("id"))
	})

	router.NoRoute(middleware.NotFoundJSON)

	return router
}

func accessLogFormatter(param gin.LogFormatterParams) string {
	ip := ""
	if param.Request != nil {
		ip = service.RequestLogMetaFromRequest(param.Request).IP
	}
	if ip == "" {
		ip = param.ClientIP
	}
	return fmt.Sprintf("[GIN] %v | %3d | %13v | %15s | %-7s %#v\n",
		param.TimeStamp.Format(time.RFC3339),
		param.StatusCode,
		param.Latency,
		ip,
		param.Method,
		redactedRequestPath(param.Path),
	)
}

func redactedRequestPath(raw string) string {
	parsed, err := url.ParseRequestURI(raw)
	if err != nil {
		return raw
	}
	values := parsed.Query()
	for key := range values {
		if strings.EqualFold(key, "accessToken") {
			values.Set(key, "[redacted]")
		}
	}
	parsed.RawQuery = values.Encode()
	return parsed.RequestURI()
}
