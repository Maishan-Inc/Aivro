package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"gorm.io/gorm"
)

const canvasAssistantSystemPrompt = "你是 Aivro 画布助手。请用简洁中文回答用户关于画布内容、提示词和创作流程的问题。"

type CanvasAssistantReference struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Title      string `json:"title"`
	DataURL    string `json:"dataUrl,omitempty"`
	StorageKey string `json:"storageKey,omitempty"`
	Text       string `json:"text,omitempty"`
}

type CanvasAssistantMessage struct {
	ID         string                     `json:"id"`
	Role       string                     `json:"role"`
	Mode       string                     `json:"mode"`
	Text       string                     `json:"text"`
	IsLoading  bool                       `json:"isLoading,omitempty"`
	References []CanvasAssistantReference `json:"references,omitempty"`
	Images     []map[string]any           `json:"images,omitempty"`
}

type CanvasAssistantSendInput struct {
	SessionID  string                     `json:"sessionId"`
	Text       string                     `json:"text"`
	Messages   []CanvasAssistantMessage   `json:"messages"`
	References []CanvasAssistantReference `json:"references"`
}

type CanvasAssistantSendResult struct {
	Session CanvasAssistantSessionView `json:"session"`
	Message CanvasAssistantMessage     `json:"message"`
}

type CanvasAssistantSessionView struct {
	ID        string                   `json:"id"`
	Title     string                   `json:"title"`
	Messages  []CanvasAssistantMessage `json:"messages"`
	CreatedAt string                   `json:"createdAt"`
	UpdatedAt string                   `json:"updatedAt"`
}

type CanvasAssistantSessionListView struct {
	Items []CanvasAssistantSessionView `json:"items"`
	Total int                          `json:"total"`
}

func ListCanvasAssistantSessions(userID string, workflowID string) (CanvasAssistantSessionListView, error) {
	if _, err := GetWorkflow(userID, workflowID); err != nil {
		return CanvasAssistantSessionListView{}, err
	}
	db, err := repository.DB()
	if err != nil {
		return CanvasAssistantSessionListView{}, err
	}
	cleanupExpiredCanvasAssistantSessions(db)
	nowText := now()
	items := []model.CanvasAssistantSession{}
	tx := db.Where("user_id = ? AND workflow_id = ? AND deleted_at = ? AND (expires_at = ? OR expires_at > ?)", userID, workflowID, "", "", nowText)
	var total int64
	if err := tx.Model(&model.CanvasAssistantSession{}).Count(&total).Error; err != nil {
		return CanvasAssistantSessionListView{}, err
	}
	if err := tx.Order("updated_at desc").Find(&items).Error; err != nil {
		return CanvasAssistantSessionListView{}, err
	}
	views := make([]CanvasAssistantSessionView, 0, len(items))
	for _, item := range items {
		views = append(views, canvasAssistantSessionView(item))
	}
	return CanvasAssistantSessionListView{Items: views, Total: int(total)}, nil
}

func SendCanvasAssistantMessage(ctx context.Context, userID string, workflowID string, input CanvasAssistantSendInput) (CanvasAssistantSendResult, error) {
	if _, err := GetWorkflow(userID, workflowID); err != nil {
		return CanvasAssistantSendResult{}, err
	}
	input.Text = strings.TrimSpace(input.Text)
	if input.Text == "" {
		return CanvasAssistantSendResult{}, safeMessageError{message: "请输入消息内容"}
	}
	session, err := canvasAssistantSessionForInput(userID, workflowID, input)
	if err != nil {
		return CanvasAssistantSendResult{}, err
	}
	userMessage := CanvasAssistantMessage{
		ID:         newID("assistant-message"),
		Role:       "user",
		Mode:       "ask",
		Text:       input.Text,
		References: normalizeCanvasAssistantReferences(input.References),
	}
	messages := append(normalizeCanvasAssistantMessages(input.Messages), userMessage)
	answer, _, err := requestCanvasAssistantAnswer(ctx, userID, messages)
	if err != nil {
		return CanvasAssistantSendResult{}, err
	}
	assistantMessage := CanvasAssistantMessage{ID: newID("assistant-message"), Role: "assistant", Mode: "ask", Text: answer}
	messages = append(messages, assistantMessage)
	saved, err := saveCanvasAssistantSession(userID, workflowID, session, messages)
	if err != nil {
		return CanvasAssistantSendResult{}, err
	}
	return CanvasAssistantSendResult{Session: canvasAssistantSessionView(saved), Message: assistantMessage}, nil
}

func DeleteCanvasAssistantSession(userID string, workflowID string, sessionID string) error {
	if _, err := GetWorkflow(userID, workflowID); err != nil {
		return err
	}
	db, err := repository.DB()
	if err != nil {
		return err
	}
	return db.Model(&model.CanvasAssistantSession{}).Where("id = ? AND user_id = ? AND workflow_id = ? AND deleted_at = ?", sessionID, userID, workflowID, "").Updates(map[string]any{"deleted_at": now(), "updated_at": now()}).Error
}

func BatchDeleteCanvasAssistantSessions(userID string, workflowID string, ids []string) error {
	if _, err := GetWorkflow(userID, workflowID); err != nil {
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	db, err := repository.DB()
	if err != nil {
		return err
	}
	return db.Model(&model.CanvasAssistantSession{}).Where("id IN ? AND user_id = ? AND workflow_id = ? AND deleted_at = ?", ids, userID, workflowID, "").Updates(map[string]any{"deleted_at": now(), "updated_at": now()}).Error
}

func canvasAssistantSessionForInput(userID string, workflowID string, input CanvasAssistantSendInput) (model.CanvasAssistantSession, error) {
	db, err := repository.DB()
	if err != nil {
		return model.CanvasAssistantSession{}, err
	}
	if strings.TrimSpace(input.SessionID) == "" {
		return model.CanvasAssistantSession{ID: newID("assistant"), UserID: userID, WorkflowID: workflowID, CreatedAt: now()}, nil
	}
	item := model.CanvasAssistantSession{}
	err = db.Where("id = ? AND user_id = ? AND workflow_id = ? AND deleted_at = ?", input.SessionID, userID, workflowID, "").First(&item).Error
	if err == nil {
		return item, nil
	}
	if err == gorm.ErrRecordNotFound {
		return model.CanvasAssistantSession{ID: newID("assistant"), UserID: userID, WorkflowID: workflowID, CreatedAt: now()}, nil
	}
	return model.CanvasAssistantSession{}, err
}

func saveCanvasAssistantSession(userID string, workflowID string, session model.CanvasAssistantSession, messages []CanvasAssistantMessage) (model.CanvasAssistantSession, error) {
	db, err := repository.DB()
	if err != nil {
		return model.CanvasAssistantSession{}, err
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return model.CanvasAssistantSession{}, err
	}
	retentionDays := normalizePrivateSetting(settings.Private).CanvasAssist.HistoryRetentionDays
	nowText := now()
	payload, _ := json.Marshal(messages)
	session.UserID = userID
	session.WorkflowID = workflowID
	session.Title = firstCanvasAssistantTitle(messages)
	session.Messages = payload
	session.LastMessageAt = nowText
	session.ExpiresAt = time.Now().Add(time.Duration(retentionDays) * 24 * time.Hour).Format(time.RFC3339)
	if session.CreatedAt == "" {
		session.CreatedAt = nowText
	}
	session.UpdatedAt = nowText
	session.DeletedAt = ""
	return session, db.Save(&session).Error
}

func requestCanvasAssistantAnswer(ctx context.Context, userID string, messages []CanvasAssistantMessage) (string, string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", "", err
	}
	settings = normalizeSettings(settings)
	modelName := strings.TrimSpace(firstNonEmpty(settings.Public.ModelChannel.DefaultTextModel, settings.Public.ModelChannel.DefaultModel))
	if modelName == "" {
		return "", "", safeMessageError{message: "管理员尚未配置默认文本模型"}
	}
	credits, err := ModelCost(modelName)
	if err != nil {
		return "", "", err
	}
	channel, err := SelectModelChannel(modelName)
	if err != nil {
		return "", "", safeMessageError{message: "管理员尚未配置可用文本模型渠道"}
	}
	body, _ := json.Marshal(map[string]any{
		"model":    modelName,
		"messages": canvasAssistantOpenAIMessages(messages),
		"stream":   false,
	})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	request.Header.Set("Content-Type", "application/json")
	if err := ConsumeUserCredits(userID, modelName, credits, "/canvas-assistant/chat"); err != nil {
		return "", "", err
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		_ = RefundUserCredits(userID, modelName, credits, "/canvas-assistant/chat")
		return "", "", safeMessageError{message: "AI 接口请求失败"}
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if response.StatusCode >= http.StatusBadRequest {
		_ = RefundUserCredits(userID, modelName, credits, "/canvas-assistant/chat")
		return "", "", readAdminChannelError(responseBody, response.StatusCode, "AI 接口请求失败")
	}
	answer := parseCanvasAssistantAnswer(responseBody)
	if strings.TrimSpace(answer) == "" {
		_ = RefundUserCredits(userID, modelName, credits, "/canvas-assistant/chat")
		return "", "", safeMessageError{message: "AI 响应为空"}
	}
	return answer, modelName, nil
}

func canvasAssistantOpenAIMessages(messages []CanvasAssistantMessage) []map[string]string {
	result := []map[string]string{{"role": "system", "content": canvasAssistantSystemPrompt}}
	for _, item := range messages {
		role := item.Role
		if role != "assistant" {
			role = "user"
		}
		text := strings.TrimSpace(item.Text)
		if role == "user" {
			refs := canvasAssistantReferenceText(item.References)
			if refs != "" {
				text = refs + "\n\n用户问题：" + text
			}
		}
		if text == "" {
			continue
		}
		result = append(result, map[string]string{"role": role, "content": text})
	}
	return result
}

func canvasAssistantReferenceText(refs []CanvasAssistantReference) string {
	lines := []string{}
	for _, ref := range refs {
		if strings.TrimSpace(ref.Text) != "" {
			lines = append(lines, "- "+firstNonEmpty(ref.Title, ref.ID)+": "+strings.TrimSpace(ref.Text))
			continue
		}
		if strings.TrimSpace(ref.Title) != "" {
			lines = append(lines, "- 已选图片节点："+ref.Title)
		}
	}
	if len(lines) == 0 {
		return ""
	}
	return "画布引用：\n" + strings.Join(lines, "\n")
}

func parseCanvasAssistantAnswer(body []byte) string {
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	_ = json.Unmarshal(body, &payload)
	if len(payload.Choices) == 0 {
		return ""
	}
	return strings.TrimSpace(payload.Choices[0].Message.Content)
}

func normalizeCanvasAssistantMessages(items []CanvasAssistantMessage) []CanvasAssistantMessage {
	result := make([]CanvasAssistantMessage, 0, len(items))
	for _, item := range items {
		if item.IsLoading || strings.TrimSpace(item.Text) == "" {
			continue
		}
		if item.Role != "assistant" {
			item.Role = "user"
		}
		if item.Mode != "image" {
			item.Mode = "ask"
			item.Images = nil
		}
		item.References = normalizeCanvasAssistantReferences(item.References)
		result = append(result, item)
	}
	if len(result) > 20 {
		return result[len(result)-20:]
	}
	return result
}

func normalizeCanvasAssistantReferences(items []CanvasAssistantReference) []CanvasAssistantReference {
	result := make([]CanvasAssistantReference, 0, len(items))
	for _, item := range items {
		item.Title = strings.TrimSpace(item.Title)
		item.Text = strings.TrimSpace(item.Text)
		item.DataURL = ""
		if item.ID == "" && item.Title == "" && item.Text == "" {
			continue
		}
		result = append(result, item)
	}
	return result
}

func firstCanvasAssistantTitle(messages []CanvasAssistantMessage) string {
	for _, item := range messages {
		if item.Role == "user" && strings.TrimSpace(item.Text) != "" {
			title := []rune(strings.TrimSpace(item.Text))
			if len(title) > 18 {
				title = title[:18]
			}
			return string(title)
		}
	}
	return "新对话"
}

func canvasAssistantSessionView(item model.CanvasAssistantSession) CanvasAssistantSessionView {
	messages := []CanvasAssistantMessage{}
	_ = json.Unmarshal(item.Messages, &messages)
	return CanvasAssistantSessionView{
		ID:        item.ID,
		Title:     firstNonEmpty(item.Title, firstCanvasAssistantTitle(messages)),
		Messages:  messages,
		CreatedAt: item.CreatedAt,
		UpdatedAt: item.UpdatedAt,
	}
}

func cleanupExpiredCanvasAssistantSessions(db *gorm.DB) {
	nowText := now()
	_ = db.Model(&model.CanvasAssistantSession{}).Where("deleted_at = ? AND expires_at <> ? AND expires_at <= ?", "", "", nowText).Updates(map[string]any{"deleted_at": nowText, "updated_at": nowText}).Error
}
