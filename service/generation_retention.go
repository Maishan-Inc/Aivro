package service

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

var generationGroups = []string{"free", "go", "plus", "pro", "max"}
var generationSections = []string{"workflow", "image", "video", "model3d", "free-image", "prompt-reverse"}

func validGenerationGroup(group string) bool {
	for _, value := range generationGroups { if group == value { return true } }
	return false
}

func defaultGenerationDays(group string) map[string]int {
	days := map[string]int{"workflow": 7, "image": 7, "video": 7, "model3d": 7, "free-image": 3, "prompt-reverse": 7}
	if group == "free" { days["image"] = 3 }
	return days
}

func ListGenerationRetentionPolicies() ([]model.GenerationRetentionPolicy, error) {
	saved, err := repository.ListGenerationRetentionPolicies()
	if err != nil { return nil, err }
	items := make([]model.GenerationRetentionPolicy, 0, len(generationGroups))
	for _, group := range generationGroups {
		item := model.GenerationRetentionPolicy{Group: group, Days: defaultGenerationDays(group)}
		for _, policy := range saved { if policy.Group == group { for section, days := range policy.Days { item.Days[section] = days }; item.UpdatedAt = policy.UpdatedAt; break } }
		items = append(items, item)
	}
	return items, nil
}

func validateGenerationDays(days map[string]int, inherit bool) error {
	minimum := 1
	if inherit { minimum = 0 }
	for key, value := range days {
		valid := false
		for _, section := range generationSections { if key == section { valid = true } }
		if !valid || value < minimum || value > 3650 { return safeMessageError{message: "保存天数无效"} }
	}
	if !inherit && len(days) != len(generationSections) { return safeMessageError{message: "请配置所有工作台的保存天数"} }
	return nil
}

func SaveGenerationRetentionPolicy(item model.GenerationRetentionPolicy) (model.GenerationRetentionPolicy, error) {
	if !validGenerationGroup(item.Group) { return item, safeMessageError{message: "会员组别无效"} }
	if err := validateGenerationDays(item.Days, false); err != nil { return item, err }
	item.UpdatedAt = now()
	return item, repository.SaveGenerationRetentionPolicy(item)
}

func UserGenerationRetention(userID string) (model.GenerationRetention, error) {
	user, ok, err := repository.GetUserByID(userID)
	if err != nil { return model.GenerationRetention{}, err }
	if !ok { return model.GenerationRetention{}, safeMessageError{message: "用户不存在"} }
	group := user.MembershipGroup
	if group == "" { group = "free" }
	policies, err := ListGenerationRetentionPolicies()
	if err != nil { return model.GenerationRetention{}, err }
	days := defaultGenerationDays(group)
	for _, policy := range policies { if policy.Group == group { days = policy.Days; break } }
	for section, value := range user.GenerationRetentionDays { if value > 0 { days[section] = value } }
	return model.GenerationRetention{Group: group, Days: days}, nil
}

func generationExpiresAt(days int) string {
	return time.Now().Add(time.Duration(days) * 24 * time.Hour).Format(time.RFC3339)
}

func SaveUserGenerationRetention(id string, input model.GenerationRetention) (model.User, error) {
	if !validGenerationGroup(input.Group) { return model.User{}, safeMessageError{message: "会员组别无效"} }
	if err := validateGenerationDays(input.Days, true); err != nil { return model.User{}, err }
	value, err := json.Marshal(input.Days)
	if err != nil { return model.User{}, err }
	user, err := repository.UpdateUser(id, map[string]any{"membership_group": input.Group, "generation_retention_days": string(value), "updated_at": now()})
	user.Password = ""
	return user, err
}

func generationSource(path string, source string) model.UserSection {
	if strings.TrimSpace(source) == "workflow" { return model.UserSectionWorkflow }
	if source == "free-image" { return model.UserSectionFreeImage }
	return generationSection(path)
}
