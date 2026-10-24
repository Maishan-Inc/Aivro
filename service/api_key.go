package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"gorm.io/gorm"
)

const APIKeyPrefix = "sk-aivro-"

type apiKeyContextKey struct{}

func WithAPIKey(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, apiKeyContextKey{}, id)
}
func IsAPIKeyRequest(ctx context.Context) bool {
	_, ok := ctx.Value(apiKeyContextKey{}).(string)
	return ok
}

func apiKeyHash(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func ListUserAPIKeys(user model.AuthUser, q model.Query) (model.UserAPIKeyList, error) {
	q.Normalize()
	return repository.ListUserAPIKeys(user.ID, q)
}

func CreateUserAPIKey(user model.AuthUser, name string) (model.CreatedUserAPIKey, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 50 || len(name) > 200 || strings.ContainsAny(name, "\r\n\x00") {
		return model.CreatedUserAPIKey{}, safeMessageError{message: "密钥名称需为 1–50 个字符"}
	}
	if err := hitRateBucket("api-key-create:"+user.ID, 10, time.Minute, time.Minute); err != nil {
		return model.CreatedUserAPIKey{}, err
	}
	nameHash := apiKeyHash(strings.ToLower(name))
	if exists, err := repository.UserAPIKeyNameExists(user.ID, nameHash); err != nil {
		return model.CreatedUserAPIKey{}, err
	} else if exists {
		return model.CreatedUserAPIKey{}, safeMessageError{message: "密钥名称已存在，请使用其他名称"}
	}
	var entropy [32]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return model.CreatedUserAPIKey{}, err
	}
	key := APIKeyPrefix + base64.RawURLEncoding.EncodeToString(entropy[:])
	item := model.UserAPIKey{ID: newID("apikey"), UserID: user.ID, Name: name, NameHash: nameHash, KeyHash: apiKeyHash(key), Preview: key[:18] + "…" + key[len(key)-4:], Status: model.APIKeyActive, CreatedAt: now()}
	if err := repository.CreateUserAPIKey(item); err != nil {
		if exists, _ := repository.UserAPIKeyNameExists(user.ID, nameHash); exists {
			return model.CreatedUserAPIKey{}, safeMessageError{message: "密钥名称已存在，请使用其他名称"}
		}
		return model.CreatedUserAPIKey{}, err
	}
	return model.CreatedUserAPIKey{Item: item, Key: key}, nil
}

func RevokeUserAPIKey(user model.AuthUser, id string) error {
	err := repository.RevokeUserAPIKey(user.ID, strings.TrimSpace(id), now())
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return safeMessageError{message: "密钥不存在或无权限操作"}
	}
	return err
}

func AuthenticateAPIKey(r *http.Request) (model.AuthUser, string, error) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	invalid := safeMessageError{message: "API 密钥无效或已撤销"}
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || !strings.HasPrefix(parts[1], APIKeyPrefix) || len(parts[1]) != len(APIKeyPrefix)+43 {
		return model.AuthUser{}, "", invalid
	}
	item, err := repository.GetActiveUserAPIKey(apiKeyHash(parts[1]))
	if err != nil {
		return model.AuthUser{}, "", invalid
	}
	user, ok, err := repository.GetUserByID(item.UserID)
	if err != nil || !ok || user.Status != model.UserStatusActive || user.Role == model.UserRoleGuest {
		return model.AuthUser{}, "", invalid
	}
	if changed, err := repository.TouchUserAPIKey(item.ID, time.Now().UTC().Format(time.RFC3339Nano)); err != nil || !changed {
		return model.AuthUser{}, "", invalid
	}
	return model.PublicUser(user), item.ID, nil
}

func RequestModelBilling(ctx context.Context, name string) (model.ModelCost, error) {
	billing, err := ModelBilling(name)
	if err == nil && IsAPIKeyRequest(ctx) {
		if billing.APICredits <= 0 && billing.Credits > 0 {
			multiplier := billing.ApiMultiplier
			if multiplier <= 0 {
				multiplier = model.DefaultAPIMultiplier
			}
			if billing.Credits > int(^uint(0)>>1)/multiplier {
				return model.ModelCost{}, safeMessageError{message: "模型计费配置无效"}
			}
		}
		billing.Credits, billing.BillingType = billing.APICost(), billing.APIBillingType()
	}
	return billing, err
}

func RequestModelCost(ctx context.Context, name string) (int, error) {
	billing, err := RequestModelBilling(ctx, name)
	return billing.Credits, err
}

func ListAPIModels() ([]model.APIModel, error) {
	settings, err := PublicSettings()
	if err != nil {
		return nil, err
	}
	items := make([]model.APIModel, 0, len(settings.ModelChannel.AvailableModels))
	for _, name := range settings.ModelChannel.AvailableModels {
		billing, err := RequestModelBilling(WithAPIKey(context.Background(), "catalog"), name)
		if err != nil {
			continue
		}
		kind := "text"
		if containsModel(settings.ModelChannel.ImageModels, name) {
			kind = "image"
		} else if containsModel(settings.ModelChannel.VideoModels, name) {
			kind = "video"
		} else if containsModel(settings.ModelChannel.Model3DModels, name) {
			kind = "model3d"
		}
		items = append(items, model.APIModel{ID: name, Type: kind, Credits: billing.Credits, BillingType: billing.BillingType})
	}
	return items, nil
}

func apiUsageCredits(unit int, reserved int, tokens int) int {
	if tokens <= 0 {
		return reserved
	}
	return canvasAgentCreditsForTokens(tokens, unit)
}

func AIResponseUsageTokens(body []byte) int {
	usage := chatResponseUsage(body, "application/json")
	tokens := firstPositive(usage.TotalTokens, usage.InputTokens+usage.OutputTokens, usage.PromptTokens+usage.CompletionTokens)
	if tokens > 0 {
		return tokens
	}
	var payload struct {
		Data struct {
			Usage canvasAgentResponseUsage `json:"usage"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &payload)
	usage = payload.Data.Usage
	return firstPositive(usage.TotalTokens, usage.InputTokens+usage.OutputTokens, usage.PromptTokens+usage.CompletionTokens)
}
