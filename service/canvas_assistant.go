package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"gorm.io/gorm"
)

const canvasAssistantSystemPrompt = "你是 Aivro 画布助手。请用简洁中文回答用户关于画布内容、提示词和创作流程的问题。"
const canvasAgentSystemPrompt = `你是 Aivro 画布 Agent。你只能通过 JSON 规划画布操作，不能输出 JavaScript、HTML、CSS 或让用户复制 JSON。

返回内容必须是一个 JSON 对象：
{
  "answer": "用简洁中文说明你计划做什么，或说明为什么需要用户补充信息",
  "ops": [],
  "needsClarification": false
}

ops 只允许这些 type：
- add_node：新增 text/image/config/video 节点。被连线或生成引用的新节点必须提供 id。
- update_node：更新已有节点基础字段或 metadata。
- delete_node：删除指定节点。
- delete_connections：删除指定连线。
- connect_nodes：连接两个节点。
- set_viewport：调整视图。
- select_nodes：设置选中节点。
- run_generation：确认修改后触发已有节点或本次新增配置节点生成。

安全规则：
- 只能使用当前画布 JSON 中存在的节点或本次 ops 新增的节点 id。
- 不要修改用户、工作流、分享、积分等业务字段。
- 不要给图片或视频节点写入外部 URL 内容；需要生成媒体时创建 config 节点并使用 run_generation。
- 预览阶段不会触发 run_generation，所以需要生成时也要先创建可预览的提示词/配置节点。
- 如果用户意图不明确，返回空 ops，并把 needsClarification 设为 true。`

const (
	canvasAgentMaxOutputTokens      = 4096
	canvasAgentModelRequestMaxBytes = 1 << 20
)

type CanvasAssistantReference struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Title      string `json:"title"`
	DataURL    string `json:"dataUrl,omitempty"`
	StorageKey string `json:"storageKey,omitempty"`
	Text       string `json:"text,omitempty"`
}

type CanvasAssistantMessage struct {
	ID                      string                     `json:"id"`
	Role                    string                     `json:"role"`
	Mode                    string                     `json:"mode"`
	Text                    string                     `json:"text"`
	IsLoading               bool                       `json:"isLoading,omitempty"`
	References              []CanvasAssistantReference `json:"references,omitempty"`
	Images                  []map[string]any           `json:"images,omitempty"`
	AgentOps                []CanvasAgentOp            `json:"agentOps,omitempty"`
	AgentUsage              *CanvasAgentUsage          `json:"agentUsage,omitempty"`
	AgentNeedsClarification bool                       `json:"agentNeedsClarification,omitempty"`
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

type CanvasAgentViewport struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	K float64 `json:"k"`
}

type CanvasAgentNode struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Title    string             `json:"title"`
	Position map[string]float64 `json:"position"`
	Width    float64            `json:"width"`
	Height   float64            `json:"height"`
	Metadata map[string]any     `json:"metadata,omitempty"`
}

type CanvasAgentConnection struct {
	ID         string `json:"id"`
	FromNodeID string `json:"fromNodeId"`
	ToNodeID   string `json:"toNodeId"`
}

type CanvasAgentSnapshot struct {
	ProjectID       string                  `json:"projectId"`
	Title           string                  `json:"title"`
	Nodes           []CanvasAgentNode       `json:"nodes"`
	Connections     []CanvasAgentConnection `json:"connections"`
	SelectedNodeIDs []string                `json:"selectedNodeIds"`
	Viewport        CanvasAgentViewport     `json:"viewport"`
}

type CanvasAgentOp struct {
	Type       string               `json:"type"`
	ID         string               `json:"id,omitempty"`
	IDs        []string             `json:"ids,omitempty"`
	NodeType   string               `json:"nodeType,omitempty"`
	Title      string               `json:"title,omitempty"`
	Position   map[string]float64   `json:"position,omitempty"`
	X          *float64             `json:"x,omitempty"`
	Y          *float64             `json:"y,omitempty"`
	Width      *float64             `json:"width,omitempty"`
	Height     *float64             `json:"height,omitempty"`
	Metadata   map[string]any       `json:"metadata,omitempty"`
	Patch      map[string]any       `json:"patch,omitempty"`
	All        bool                 `json:"all,omitempty"`
	FromNodeID string               `json:"fromNodeId,omitempty"`
	ToNodeID   string               `json:"toNodeId,omitempty"`
	Viewport   *CanvasAgentViewport `json:"viewport,omitempty"`
	NodeID     string               `json:"nodeId,omitempty"`
	Mode       string               `json:"mode,omitempty"`
	Prompt     string               `json:"prompt,omitempty"`
}

type CanvasAgentUsage struct {
	InputTokens  int  `json:"inputTokens"`
	OutputTokens int  `json:"outputTokens"`
	TotalTokens  int  `json:"totalTokens"`
	Credits      int  `json:"credits"`
	Estimated    bool `json:"estimated,omitempty"`
}

type CanvasAgentPreviewInput struct {
	Ops      []CanvasAgentOp     `json:"ops"`
	Snapshot CanvasAgentSnapshot `json:"snapshot"`
}

type CanvasAgentPlanInput struct {
	SessionID  string                     `json:"sessionId"`
	Text       string                     `json:"text"`
	Messages   []CanvasAssistantMessage   `json:"messages"`
	References []CanvasAssistantReference `json:"references"`
	Snapshot   CanvasAgentSnapshot        `json:"snapshot"`
	Preview    *CanvasAgentPreviewInput   `json:"preview,omitempty"`
}

type CanvasAgentPlanResult struct {
	Session CanvasAssistantSessionView `json:"session"`
	Message CanvasAssistantMessage     `json:"message"`
	Ops     []CanvasAgentOp            `json:"ops"`
	Usage   CanvasAgentUsage           `json:"usage"`
}

type canvasAgentPlanPayload struct {
	Answer             string          `json:"answer"`
	Ops                []CanvasAgentOp `json:"ops"`
	NeedsClarification bool            `json:"needsClarification"`
}

type canvasAgentResponseUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	InputTokens      int `json:"input_tokens"`
	OutputTokens     int `json:"output_tokens"`
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

func PlanCanvasAgent(ctx context.Context, userID string, workflowID string, input CanvasAgentPlanInput) (CanvasAgentPlanResult, error) {
	if _, err := GetWorkflow(userID, workflowID); err != nil {
		return CanvasAgentPlanResult{}, err
	}
	input.Text = strings.TrimSpace(input.Text)
	if input.Text == "" {
		return CanvasAgentPlanResult{}, safeMessageError{message: "请输入消息内容"}
	}
	if input.Snapshot.ProjectID != "" && input.Snapshot.ProjectID != workflowID {
		return CanvasAgentPlanResult{}, safeMessageError{message: "画布快照与当前工作流不匹配"}
	}
	input.Snapshot.ProjectID = workflowID
	input.Snapshot = compactCanvasAgentSnapshot(input.Snapshot)
	if input.Preview != nil {
		if input.Preview.Snapshot.ProjectID != "" && input.Preview.Snapshot.ProjectID != workflowID {
			return CanvasAgentPlanResult{}, safeMessageError{message: "预览快照与当前工作流不匹配"}
		}
		input.Preview.Snapshot.ProjectID = workflowID
		input.Preview.Snapshot = compactCanvasAgentSnapshot(input.Preview.Snapshot)
		input.Preview.Ops = compactCanvasAgentOpsForPrompt(input.Preview.Ops)
	}
	session, err := canvasAssistantSessionForInput(userID, workflowID, CanvasAssistantSendInput{SessionID: input.SessionID})
	if err != nil {
		return CanvasAgentPlanResult{}, err
	}
	userMessage := CanvasAssistantMessage{
		ID:         newID("assistant-message"),
		Role:       "user",
		Mode:       "ask",
		Text:       limitText(input.Text, 4000),
		References: normalizeCanvasAssistantReferences(input.References),
	}
	messages := append(normalizeCanvasAssistantMessages(input.Messages), userMessage)
	plan, _, usage, err := requestCanvasAgentPlan(ctx, userID, input, messages)
	if err != nil {
		return CanvasAgentPlanResult{}, err
	}
	assistantMessage := CanvasAssistantMessage{
		ID:                      newID("assistant-message"),
		Role:                    "assistant",
		Mode:                    "ask",
		Text:                    firstNonEmpty(plan.Answer, "已生成画布修改预览，请检查后确认。"),
		AgentOps:                plan.Ops,
		AgentUsage:              &usage,
		AgentNeedsClarification: plan.NeedsClarification,
	}
	messages = append(messages, assistantMessage)
	saved, err := saveCanvasAssistantSession(userID, workflowID, session, messages)
	if err != nil {
		return CanvasAgentPlanResult{}, err
	}
	return CanvasAgentPlanResult{Session: canvasAssistantSessionView(saved), Message: assistantMessage, Ops: plan.Ops, Usage: usage}, nil
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

func requestCanvasAgentPlan(ctx context.Context, userID string, input CanvasAgentPlanInput, messages []CanvasAssistantMessage) (canvasAgentPlanPayload, string, CanvasAgentUsage, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	settings = normalizeSettings(settings)
	modelName := strings.TrimSpace(firstNonEmpty(settings.Public.ModelChannel.DefaultTextModel, settings.Public.ModelChannel.DefaultModel))
	if modelName == "" {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, safeMessageError{message: "管理员尚未配置默认文本模型"}
	}
	channel, err := SelectModelChannel(modelName)
	if err != nil {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, safeMessageError{message: "管理员尚未配置可用文本模型渠道"}
	}
	unitCost, err := ModelCost(modelName)
	if err != nil {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	messagesPayload := canvasAgentOpenAIMessages(input, messages)
	body, _ := json.Marshal(map[string]any{
		"model":           modelName,
		"messages":        messagesPayload,
		"stream":          false,
		"response_format": map[string]string{"type": "json_object"},
		"max_tokens":      canvasAgentMaxOutputTokens,
	})
	if len(body) > canvasAgentModelRequestMaxBytes {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, safeMessageError{message: "画布上下文过大，请减少选中内容后重试"}
	}
	reservedCredits := canvasAgentReserveCredits(body, canvasAgentMaxOutputTokens, unitCost)
	if reservedCredits > 0 {
		if err := ConsumeUserCredits(userID, modelName, reservedCredits, "/canvas-agent/plan-reserve"); err != nil {
			return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
		}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), bytes.NewReader(body))
	if err != nil {
		_ = RefundUserCredits(userID, modelName, reservedCredits, "/canvas-agent/plan-reserve")
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		_ = RefundUserCredits(userID, modelName, reservedCredits, "/canvas-agent/plan-reserve")
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, safeMessageError{message: "AI 接口请求失败"}
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if response.StatusCode >= http.StatusBadRequest {
		_ = RefundUserCredits(userID, modelName, reservedCredits, "/canvas-agent/plan-reserve")
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, readAdminChannelError(responseBody, response.StatusCode, "AI 接口请求失败")
	}
	content, rawUsage := parseCanvasAgentResponse(responseBody)
	plan, err := parseCanvasAgentPlanContent(content)
	if err != nil {
		_, _ = canvasAgentBillUsage(userID, modelName, unitCost, reservedCredits, rawUsage, body, responseBody)
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	plan.Ops, err = sanitizeCanvasAgentOps(plan.Ops, input.Snapshot)
	if err != nil {
		_, _ = canvasAgentBillUsage(userID, modelName, unitCost, reservedCredits, rawUsage, body, responseBody)
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	usage, err := canvasAgentBillUsage(userID, modelName, unitCost, reservedCredits, rawUsage, body, responseBody)
	if err != nil {
		return canvasAgentPlanPayload{}, "", CanvasAgentUsage{}, err
	}
	return plan, modelName, usage, nil
}

func canvasAgentOpenAIMessages(input CanvasAgentPlanInput, messages []CanvasAssistantMessage) []map[string]string {
	context := map[string]any{
		"snapshot": compactCanvasAgentSnapshot(input.Snapshot),
	}
	if input.Preview != nil {
		context["preview"] = map[string]any{"ops": compactCanvasAgentOpsForPrompt(input.Preview.Ops), "snapshot": compactCanvasAgentSnapshot(input.Preview.Snapshot)}
	}
	contextBody, _ := json.Marshal(context)
	result := []map[string]string{{"role": "system", "content": canvasAgentSystemPrompt}}
	for _, item := range messages {
		role := item.Role
		if role != "assistant" {
			role = "user"
		}
		text := strings.TrimSpace(item.Text)
		if text == "" {
			continue
		}
		if role == "assistant" && len(item.AgentOps) > 0 {
			ops, _ := json.Marshal(compactCanvasAgentOpsForPrompt(item.AgentOps))
			text += "\n\n上一轮画布操作：" + string(ops)
		}
		result = append(result, map[string]string{"role": role, "content": limitText(text, 5000)})
	}
	result = append(result, map[string]string{"role": "user", "content": "当前画布上下文：\n" + string(contextBody) + "\n\n请根据最新用户需求返回 JSON 规划。"})
	return result
}

func compactCanvasAgentSnapshot(snapshot CanvasAgentSnapshot) CanvasAgentSnapshot {
	snapshot.Title = limitText(snapshot.Title, 80)
	if len(snapshot.Nodes) > 80 {
		snapshot.Nodes = snapshot.Nodes[:80]
	}
	nodeIDs := map[string]bool{}
	nodes := make([]CanvasAgentNode, 0, len(snapshot.Nodes))
	for i := range snapshot.Nodes {
		snapshot.Nodes[i].Title = limitText(snapshot.Nodes[i].Title, 80)
		snapshot.Nodes[i].Type = safeNodeType(snapshot.Nodes[i].Type)
		snapshot.Nodes[i].Position = sanitizeCanvasAgentPosition(snapshot.Nodes[i].Position, nil, nil)
		snapshot.Nodes[i].Width = clampCanvasAgentNumber(snapshot.Nodes[i].Width, 40, 3000)
		snapshot.Nodes[i].Height = clampCanvasAgentNumber(snapshot.Nodes[i].Height, 40, 3000)
		snapshot.Nodes[i].Metadata = compactCanvasAgentMetadata(snapshot.Nodes[i].Type, snapshot.Nodes[i].Metadata)
		if !safeCanvasID(snapshot.Nodes[i].ID) || nodeIDs[snapshot.Nodes[i].ID] {
			continue
		}
		nodeIDs[snapshot.Nodes[i].ID] = true
		nodes = append(nodes, snapshot.Nodes[i])
	}
	snapshot.Nodes = nodes
	if len(snapshot.Connections) > 160 {
		snapshot.Connections = snapshot.Connections[:160]
	}
	connections := make([]CanvasAgentConnection, 0, len(snapshot.Connections))
	connectionIDs := map[string]bool{}
	for _, connection := range snapshot.Connections {
		if !safeCanvasID(connection.ID) || connectionIDs[connection.ID] || !nodeIDs[connection.FromNodeID] || !nodeIDs[connection.ToNodeID] || connection.FromNodeID == connection.ToNodeID {
			continue
		}
		connectionIDs[connection.ID] = true
		connections = append(connections, connection)
	}
	snapshot.Connections = connections
	selected := make([]string, 0, len(snapshot.SelectedNodeIDs))
	selectedIDs := map[string]bool{}
	for _, id := range snapshot.SelectedNodeIDs {
		if nodeIDs[id] && !selectedIDs[id] {
			selectedIDs[id] = true
			selected = append(selected, id)
		}
		if len(selected) >= 80 {
			break
		}
	}
	snapshot.SelectedNodeIDs = selected
	snapshot.Viewport.X = clampCanvasAgentNumber(snapshot.Viewport.X, -100000, 100000)
	snapshot.Viewport.Y = clampCanvasAgentNumber(snapshot.Viewport.Y, -100000, 100000)
	snapshot.Viewport.K = clampCanvasAgentNumber(snapshot.Viewport.K, 0.05, 5)
	return snapshot
}

func compactCanvasAgentMetadata(nodeType string, metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return nil
	}
	allowed := []string{"content", "prompt", "composerContent", "status", "generationMode", "model", "size", "quality", "count", "seconds", "vquality"}
	result := map[string]any{}
	for _, key := range allowed {
		value, ok := metadata[key]
		if !ok {
			continue
		}
		if key == "content" && (nodeType == "image" || nodeType == "video") {
			continue
		}
		if text, ok := value.(string); ok {
			result[key] = limitText(text, 500)
		} else {
			result[key] = value
		}
	}
	return result
}

func parseCanvasAgentResponse(body []byte) (string, canvasAgentResponseUsage) {
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage canvasAgentResponseUsage `json:"usage"`
	}
	_ = json.Unmarshal(body, &payload)
	if len(payload.Choices) == 0 {
		return "", payload.Usage
	}
	return strings.TrimSpace(payload.Choices[0].Message.Content), payload.Usage
}

func parseCanvasAgentPlanContent(content string) (canvasAgentPlanPayload, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return canvasAgentPlanPayload{}, safeMessageError{message: "AI 响应为空"}
	}
	var plan canvasAgentPlanPayload
	if err := json.Unmarshal([]byte(content), &plan); err != nil {
		if extracted := extractJSONObject(content); extracted != "" {
			err = json.Unmarshal([]byte(extracted), &plan)
		}
		if err != nil {
			return canvasAgentPlanPayload{}, safeMessageError{message: "AI 未返回有效画布操作"}
		}
	}
	plan.Answer = limitText(strings.TrimSpace(plan.Answer), 2000)
	if plan.Ops == nil {
		plan.Ops = []CanvasAgentOp{}
	}
	return plan, nil
}

func sanitizeCanvasAgentOps(ops []CanvasAgentOp, snapshot CanvasAgentSnapshot) ([]CanvasAgentOp, error) {
	if len(ops) > 40 {
		return nil, safeMessageError{message: "AI 返回的画布操作过多，请缩小范围后重试"}
	}
	nodeIDs := map[string]bool{}
	nodeTypes := map[string]string{}
	connectionIDs := map[string]bool{}
	for _, node := range snapshot.Nodes {
		if node.ID != "" {
			nodeIDs[node.ID] = true
			nodeTypes[node.ID] = node.Type
		}
	}
	for _, connection := range snapshot.Connections {
		if connection.ID != "" {
			connectionIDs[connection.ID] = true
		}
	}
	result := make([]CanvasAgentOp, 0, len(ops))
	deleteCount := 0
	for _, op := range ops {
		op.Type = strings.TrimSpace(op.Type)
		switch op.Type {
		case "add_node":
			op.NodeType = safeNodeType(op.NodeType)
			if op.ID == "" {
				op.ID = newID(op.NodeType)
			}
			if !safeCanvasID(op.ID) {
				return nil, safeMessageError{message: "AI 返回了非法节点 ID"}
			}
			if nodeIDs[op.ID] {
				return nil, safeMessageError{message: "AI 返回了重复节点 ID"}
			}
			nodeIDs[op.ID] = true
			nodeTypes[op.ID] = op.NodeType
			op.Title = limitText(op.Title, 80)
			op.Position = sanitizeCanvasAgentPosition(op.Position, op.X, op.Y)
			op.X = nil
			op.Y = nil
			op.Width = sanitizeCanvasAgentDimension(op.Width)
			op.Height = sanitizeCanvasAgentDimension(op.Height)
			op.Metadata = sanitizeCanvasAgentMetadata(op.NodeType, op.Metadata)
			op.Patch = nil
			result = append(result, op)
		case "update_node":
			if !nodeIDs[op.ID] {
				return nil, safeMessageError{message: "AI 尝试更新不存在的节点"}
			}
			op.Patch = sanitizeCanvasAgentPatch(op.Patch)
			op.Metadata = sanitizeCanvasAgentMetadata(nodeTypes[op.ID], op.Metadata)
			result = append(result, op)
		case "delete_node":
			ids := op.IDs
			if op.ID != "" {
				ids = append(ids, op.ID)
			}
			for _, id := range ids {
				if !nodeIDs[id] {
					return nil, safeMessageError{message: "AI 尝试删除不存在的节点"}
				}
			}
			deleteCount += len(ids)
			if deleteCount > 20 {
				return nil, safeMessageError{message: "AI 删除节点过多，请缩小范围后重试"}
			}
			op.IDs = ids
			op.ID = ""
			for _, id := range ids {
				delete(nodeIDs, id)
				delete(nodeTypes, id)
			}
			result = append(result, op)
		case "delete_connections":
			if !op.All {
				ids := op.IDs
				if op.ID != "" {
					ids = append(ids, op.ID)
				}
				for _, id := range ids {
					if !connectionIDs[id] {
						return nil, safeMessageError{message: "AI 尝试删除不存在的连线"}
					}
				}
				op.IDs = ids
				op.ID = ""
			}
			result = append(result, op)
		case "connect_nodes":
			if !nodeIDs[op.FromNodeID] || !nodeIDs[op.ToNodeID] || op.FromNodeID == op.ToNodeID {
				return nil, safeMessageError{message: "AI 返回了非法连线"}
			}
			result = append(result, op)
		case "set_viewport":
			if op.Viewport == nil || op.Viewport.K <= 0 || op.Viewport.K > 5 {
				return nil, safeMessageError{message: "AI 返回了非法视图参数"}
			}
			op.Viewport.X = clampCanvasAgentNumber(op.Viewport.X, -100000, 100000)
			op.Viewport.Y = clampCanvasAgentNumber(op.Viewport.Y, -100000, 100000)
			result = append(result, op)
		case "select_nodes":
			for _, id := range op.IDs {
				if !nodeIDs[id] {
					return nil, safeMessageError{message: "AI 尝试选择不存在的节点"}
				}
			}
			result = append(result, op)
		case "run_generation":
			if !nodeIDs[op.NodeID] {
				return nil, safeMessageError{message: "AI 尝试触发不存在的节点生成"}
			}
			op.Mode = safeGenerationMode(op.Mode)
			op.Prompt = limitText(op.Prompt, 4000)
			result = append(result, op)
		default:
			return nil, safeMessageError{message: "AI 返回了不支持的画布操作"}
		}
	}
	return result, nil
}

func sanitizeCanvasAgentPatch(patch map[string]any) map[string]any {
	if len(patch) == 0 {
		return nil
	}
	result := map[string]any{}
	if title, ok := patch["title"].(string); ok {
		result["title"] = limitText(title, 80)
	}
	if position, ok := patch["position"].(map[string]any); ok {
		result["position"] = numericPoint(position)
	}
	if width, ok := numberValue(patch["width"]); ok && width > 40 && width < 3000 {
		result["width"] = width
	}
	if height, ok := numberValue(patch["height"]); ok && height > 40 && height < 3000 {
		result["height"] = height
	}
	return result
}

func sanitizeCanvasAgentPosition(position map[string]float64, x *float64, y *float64) map[string]float64 {
	nextX := 0.0
	nextY := 0.0
	if position != nil {
		nextX = position["x"]
		nextY = position["y"]
	}
	if x != nil {
		nextX = *x
	}
	if y != nil {
		nextY = *y
	}
	return map[string]float64{"x": clampCanvasAgentNumber(nextX, -100000, 100000), "y": clampCanvasAgentNumber(nextY, -100000, 100000)}
}

func sanitizeCanvasAgentDimension(value *float64) *float64 {
	if value == nil {
		return nil
	}
	next := clampCanvasAgentNumber(*value, 40, 3000)
	return &next
}

func clampCanvasAgentNumber(value float64, min float64, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func sanitizeCanvasAgentMetadata(nodeType string, metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return nil
	}
	allowed := map[string]bool{
		"content": true, "prompt": true, "composerContent": true, "status": true, "errorDetails": true, "fontSize": true,
		"generationMode": true, "generationType": true, "model": true, "size": true, "quality": true, "count": true,
		"seconds": true, "vquality": true, "freeResize": true,
	}
	result := map[string]any{}
	for key, value := range metadata {
		if !allowed[key] {
			continue
		}
		if key == "content" && (nodeType == "image" || nodeType == "video") {
			continue
		}
		if text, ok := value.(string); ok {
			result[key] = limitText(text, 4000)
			continue
		}
		result[key] = value
	}
	if status, ok := result["status"].(string); ok && status != "idle" && status != "success" && status != "loading" && status != "error" {
		result["status"] = "idle"
	}
	if mode, ok := result["generationMode"].(string); ok {
		result["generationMode"] = safeGenerationMode(mode)
	}
	return result
}

func compactCanvasAgentOpsForPrompt(ops []CanvasAgentOp) []CanvasAgentOp {
	if len(ops) > 20 {
		ops = ops[len(ops)-20:]
	}
	result := make([]CanvasAgentOp, 0, len(ops))
	for _, op := range ops {
		op.Title = limitText(op.Title, 80)
		op.Prompt = limitText(op.Prompt, 1000)
		op.Metadata = compactCanvasAgentOpMetadata(op.NodeType, op.Metadata)
		op.Patch = sanitizeCanvasAgentPatch(op.Patch)
		result = append(result, op)
	}
	return result
}

func compactCanvasAgentOpMetadata(nodeType string, metadata map[string]any) map[string]any {
	result := sanitizeCanvasAgentMetadata(nodeType, metadata)
	if len(result) == 0 {
		return nil
	}
	for key, value := range result {
		text, ok := value.(string)
		if !ok {
			continue
		}
		text = limitText(text, 1000)
		if key == "content" && (strings.HasPrefix(text, "data:") || strings.HasPrefix(text, "http://") || strings.HasPrefix(text, "https://")) {
			delete(result, key)
			continue
		}
		result[key] = text
	}
	return result
}

func canvasAgentReserveCredits(requestBody []byte, maxOutputTokens int, unitCost int) int {
	if unitCost <= 0 {
		return 0
	}
	inputTokens := canvasAgentEstimatedTokens(requestBody) + 512
	return canvasAgentCreditsForTokens(inputTokens+maxOutputTokens, unitCost)
}

func canvasAgentEstimatedTokens(body []byte) int {
	return len(body)
}

func canvasAgentCreditsForTokens(tokens int, unitCost int) int {
	if tokens <= 0 || unitCost <= 0 {
		return 0
	}
	credits := int(math.Ceil(float64(tokens) / 1000.0 * float64(unitCost)))
	if credits <= 0 {
		return 1
	}
	return credits
}

func canvasAgentBillUsage(userID string, modelName string, unitCost int, reservedCredits int, usage canvasAgentResponseUsage, requestBody []byte, responseBody []byte) (CanvasAgentUsage, error) {
	result := CanvasAgentUsage{
		InputTokens:  firstPositive(usage.InputTokens, usage.PromptTokens),
		OutputTokens: firstPositive(usage.OutputTokens, usage.CompletionTokens),
		TotalTokens:  usage.TotalTokens,
	}
	if result.TotalTokens <= 0 {
		result.TotalTokens = result.InputTokens + result.OutputTokens
	}
	if result.TotalTokens <= 0 {
		result.TotalTokens = canvasAgentEstimatedTokens(requestBody) + canvasAgentEstimatedTokens(responseBody)
		result.Estimated = true
	}
	result.Credits = canvasAgentCreditsForTokens(result.TotalTokens, unitCost)
	delta := result.Credits - reservedCredits
	if delta > 0 {
		if err := ConsumeUserCredits(userID, modelName, delta, "/canvas-agent/plan"); err != nil {
			result.Credits = reservedCredits
			result.Estimated = true
			return result, nil
		}
	} else if delta < 0 {
		if err := RefundUserCredits(userID, modelName, -delta, "/canvas-agent/plan"); err != nil {
			return CanvasAgentUsage{}, err
		}
	}
	return result, nil
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
		item.Text = limitText(item.Text, 4000)
		if item.Mode != "image" {
			item.Mode = "ask"
			item.Images = nil
		}
		item.References = normalizeCanvasAssistantReferences(item.References)
		item.AgentOps = compactCanvasAgentOpsForPrompt(item.AgentOps)
		result = append(result, item)
	}
	if len(result) > 20 {
		return result[len(result)-20:]
	}
	return result
}

func safeNodeType(value string) string {
	switch value {
	case "image", "config", "video":
		return value
	default:
		return "text"
	}
}

func safeGenerationMode(value string) string {
	switch value {
	case "text", "video":
		return value
	default:
		return "image"
	}
}

func safeCanvasID(value string) bool {
	if value == "" || len(value) > 120 {
		return false
	}
	ok, _ := regexp.MatchString(`^[a-zA-Z0-9._:-]+$`, value)
	return ok
}

func numericPoint(value map[string]any) map[string]float64 {
	x, _ := numberValue(value["x"])
	y, _ := numberValue(value["y"])
	return map[string]float64{"x": clampCanvasAgentNumber(x, -100000, 100000), "y": clampCanvasAgentNumber(y, -100000, 100000)}
}

func numberValue(value any) (float64, bool) {
	switch item := value.(type) {
	case float64:
		return item, true
	case float32:
		return float64(item), true
	case int:
		return float64(item), true
	case int64:
		return float64(item), true
	case json.Number:
		next, err := item.Float64()
		return next, err == nil
	default:
		return 0, false
	}
}

func canvasAgentStringValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func limitText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func extractJSONObject(value string) string {
	start := strings.Index(value, "{")
	end := strings.LastIndex(value, "}")
	if start < 0 || end <= start {
		return ""
	}
	return value[start : end+1]
}

func firstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func normalizeCanvasAssistantReferences(items []CanvasAssistantReference) []CanvasAssistantReference {
	result := make([]CanvasAssistantReference, 0, len(items))
	for _, item := range items {
		item.Title = limitText(item.Title, 80)
		item.Text = limitText(item.Text, 1000)
		item.DataURL = ""
		item.StorageKey = ""
		if item.ID == "" && item.Title == "" && item.Text == "" {
			continue
		}
		result = append(result, item)
		if len(result) >= 8 {
			break
		}
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
