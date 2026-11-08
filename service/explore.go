package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const FreeImageAgreementVersion = "free-image-v1"

type ExploreSettings struct {
	model.ExploreSetting
	SystemPrompt string `json:"systemPrompt"`
}

func AdminExploreSettings() (ExploreSettings, error) {
	settings, err := repository.GetSettings()
	return ExploreSettings{ExploreSetting: settings.Public.Explore, SystemPrompt: firstNonEmpty(settings.Private.PromptReverse.SystemPrompt, defaultReversePrompt)}, err
}

func SaveExploreSettings(input ExploreSettings) (ExploreSettings, error) {
	input.SystemPrompt = strings.TrimSpace(input.SystemPrompt)
	if input.SystemPrompt == "" || len(input.SystemPrompt) > 40000 { return input, SafeAIError("请填写提示词反推的分析提示词，最多 40000 字节") }
	return input, repository.SaveExploreSettings(input.ExploreSetting, model.PromptReverseSetting{SystemPrompt: input.SystemPrompt}, now())
}

func ListFreeImageCampaigns(query model.Query) (map[string]any, error) {
	items, total, err := repository.ListFreeImageCampaigns(query)
	return map[string]any{"items": items, "total": total}, err
}

func SaveFreeImageCampaign(input model.FreeImageCampaign) (model.FreeImageCampaign, error) {
	input.Name = strings.TrimSpace(input.Name)
	start, err := time.Parse(time.RFC3339, input.StartsAt)
	if err != nil { return input, SafeAIError("请设置有效的活动起止时间") }
	end, err := time.Parse(time.RFC3339, input.EndsAt)
	if err != nil || !end.After(start) { return input, SafeAIError("活动结束时间必须晚于开始时间") }
	input.StartsAt, input.EndsAt = start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339)
	settings, err := PublicSettings()
	if err != nil { return input, err }
	input.Models = uniqueStrings(input.Models)
	if input.Name == "" || len(input.Models) == 0 { return input, SafeAIError("请填写活动名称并选择图片模型") }
	for _, name := range input.Models {
		if !containsModel(settings.ModelChannel.ImageModels, name) || !containsModel(settings.ModelChannel.AvailableModels, name) { return input, SafeAIError("活动只能选择已开放的图片模型") }
	}
	for group, limit := range input.GroupLimits {
		if !validGenerationGroup(group) || limit < 0 || limit > 100000 { return input, SafeAIError("活动会员次数无效") }
	}
	if len(input.GroupLimits) != len(generationGroups) { return input, SafeAIError("请配置所有会员等级的活动次数") }
	if input.ID == "" { input.ID, input.CreatedAt = newID("campaign"), now() }
	input.UpdatedAt = now()
	saved, err := repository.SaveFreeImageCampaign(input)
	if err != nil && err.Error() == "免费活动时间不能重叠" { return input, SafeAIError(err.Error()) }
	return saved, err
}

func FreeImageState(user model.AuthUser) (model.FreeImageState, error) {
	settings, err := PublicSettings()
	if err != nil { return model.FreeImageState{}, err }
	if !settings.Explore.FreeImageEnabled { return model.FreeImageState{}, SafeAIError("免费生成图片尚未开启") }
	campaign, err := repository.ActiveFreeImageCampaign(time.Now().UTC().Format(time.RFC3339))
	if err != nil || campaign == nil { return model.FreeImageState{}, err }
	campaign.Models = filterAllowedModels(campaign.Models, settings.ModelChannel.ImageModels)
	campaign.Models = filterAllowedModels(campaign.Models, settings.ModelChannel.AvailableModels)
	account, exists, err := repository.GetUserByID(user.ID)
	if err != nil { return model.FreeImageState{}, err }
	if !exists { return model.FreeImageState{}, SafeAIError("用户不存在") }
	group := firstNonEmpty(account.MembershipGroup, "free")
	used, err := repository.FreeImageUsed(campaign.ID, user.ID)
	limit := campaign.GroupLimits[group]
	remaining := limit - used
	if remaining < 0 { remaining = 0 }
	return model.FreeImageState{Campaign: campaign, Group: group, Limit: limit, Used: used, Remaining: remaining}, err
}

func filterAllowedModels(models []string, allowed []string) []string {
	result := []string{}
	for _, name := range models { if containsModel(allowed, name) { result = append(result, name) } }
	return result
}

type FreeImageInput struct {
	CampaignID string `json:"campaignId"`
	Agreement string `json:"agreement"`
	Model string `json:"model"`
	Prompt string `json:"prompt"`
	Size string `json:"size"`
	Quality string `json:"quality"`
}

type freeImageContextKey struct{}
type freeImageReservation struct { CampaignID string; Limit int; AcceptedAt string; Agreement string }

func SubmitFreeImage(ctx context.Context, user model.AuthUser, input FreeImageInput, meta RequestLogMeta) (model.GenerationTaskSubmitResult, error) {
	if input.Agreement != FreeImageAgreementVersion { return model.GenerationTaskSubmitResult{}, SafeAIError("请先同意免费生成图片协议") }
	state, err := FreeImageState(user)
	if err != nil { return model.GenerationTaskSubmitResult{}, err }
	if state.Campaign == nil || state.Campaign.ID != input.CampaignID { return model.GenerationTaskSubmitResult{}, SafeAIError("当前暂未免费活动") }
	if state.Remaining == 0 { return model.GenerationTaskSubmitResult{}, SafeAIError("本期免费次数已用完") }
	if !containsModel(state.Campaign.Models, input.Model) { return model.GenerationTaskSubmitResult{}, SafeAIError("该模型不在本期免费活动中") }
	input.Prompt = strings.TrimSpace(input.Prompt)
	if input.Prompt == "" || len(input.Prompt) > 20000 { return model.GenerationTaskSubmitResult{}, SafeAIError("请输入生图提示词，最多 20000 字节") }
	if err := ValidateModelRequest(input.Model, "/images/generations"); err != nil { return model.GenerationTaskSubmitResult{}, err }
	payload := map[string]any{"model": input.Model, "prompt": input.Prompt, "n": 1, "size": firstNonEmpty(input.Size, "1024x1024"), "response_format": "b64_json"}
	if input.Quality != "" { payload["quality"] = input.Quality }
	body, _ := json.Marshal(payload)
	ctx = context.WithValue(ctx, freeImageContextKey{}, freeImageReservation{CampaignID: state.Campaign.ID, Limit: state.Limit, AcceptedAt: now(), Agreement: input.Agreement})
	queued, _, err := SubmitAITask(ctx, user, body, "application/json", input.Model, "/images/generations", meta)
	if err == repository.ErrFreeImageQuota { return queued, SafeAIError(err.Error()) }
	return queued, err
}

func freeImageHistory(task model.GenerationTask, files []model.CloudFile) model.GenerationHistory {
	media := []model.GenerationHistoryMedia{}
	expires := ""
	for _, file := range files {
		if file.FileType != model.CloudFileTypeImage || file.Purpose != model.CloudFilePurposeGeneration { continue }
		media = append(media, model.GenerationHistoryMedia{CloudFileID: file.ID, StorageKey: "cloud:"+file.ID, URL: file.PublicURL, FileType: file.FileType, ContentType: file.ContentType, Size: file.Size, ExpiresAt: file.ExpiresAt})
		if expires == "" || file.ExpiresAt < expires { expires = file.ExpiresAt }
	}
	return model.GenerationHistory{ID: "history-"+task.ID, UserID: task.UserID, Type: model.GenerationHistoryTypeFreeImage, CampaignID: task.CampaignID, Title: task.Model, Prompt: task.Prompt, Model: task.Model, Config: map[string]string{"size": stringParameter(task.Parameters, "size"), "quality": stringParameter(task.Parameters, "quality")}, Media: media, Status: "成功", ExpiresAt: expires, CreatedAt: now(), UpdatedAt: now()}
}

func stringParameter(parameters map[string]any, key string) string { value, _ := parameters[key].(string); return value }
