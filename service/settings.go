package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sort"
	"strings"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func PublicSettings() (model.PublicSetting, error) {
	settings, err := repository.GetSettings()
	return normalizePublicSetting(settings.Public), err
}

func AdminSettings() (model.Settings, error) {
	settings, err := repository.GetSettings()
	return hidePrivateAPIKeys(normalizeSettings(settings)), err
}

func SaveSettings(settings model.Settings) (model.Settings, error) {
	saved, err := repository.GetSettings()
	if err != nil {
		return model.Settings{}, err
	}
	settings = normalizeSettings(settings)
	keepPrivateAPIKeys(&settings, normalizeSettings(saved))
	keepPrivateAuthSecrets(&settings, normalizeSettings(saved))
	result, err := repository.SaveSettings(settings, now())
	if err == nil {
		RefreshPromptSyncScheduler()
	}
	return hidePrivateAPIKeys(result), err
}

func AdminChannelModels(index *int, channel model.ModelChannel) ([]string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return nil, err
	}
	return fetchAdminChannelModels(resolved)
}

func AdminTestChannelModel(index *int, channel model.ModelChannel, modelName string) (string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return "", err
	}
	return testAdminChannelModel(resolved, modelName)
}

func AdminUpdateDatabase() error {
	return repository.UpdateDatabase()
}

func normalizeSettings(settings model.Settings) model.Settings {
	settings.Public = normalizePublicSetting(settings.Public)
	settings.Private = normalizePrivateSetting(settings.Private)
	return settings
}

func normalizePublicSetting(setting model.PublicSetting) model.PublicSetting {
	if setting.ModelChannel.AvailableModels == nil {
		setting.ModelChannel.AvailableModels = []string{}
	}
	if setting.ModelChannel.ModelCosts == nil {
		setting.ModelChannel.ModelCosts = []model.ModelCost{}
	}
	for i := range setting.ModelChannel.ModelCosts {
		setting.ModelChannel.ModelCosts[i].Model = strings.TrimSpace(setting.ModelChannel.ModelCosts[i].Model)
		if setting.ModelChannel.ModelCosts[i].Credits < 0 {
			setting.ModelChannel.ModelCosts[i].Credits = 0
		}
	}
	if setting.ModelChannel.AllowCustomChannel == nil {
		enabled := true
		setting.ModelChannel.AllowCustomChannel = &enabled
	}
	if setting.Auth.AllowRegister == nil {
		enabled := true
		setting.Auth.AllowRegister = &enabled
	}
	if setting.Auth.EmailVerification == nil {
		enabled := false
		setting.Auth.EmailVerification = &enabled
	}
	setting.Auth.LinuxDo = normalizePublicAuthProvider(setting.Auth.LinuxDo, "linux-do", "Linux.do", "/icons/linuxdo.svg")
	setting.Auth.Google = normalizePublicAuthProvider(setting.Auth.Google, "google", "Google", "")
	setting.Auth.Github = normalizePublicAuthProvider(setting.Auth.Github, "github", "GitHub", "")
	setting.Auth.MetaMask = normalizePublicAuthProvider(setting.Auth.MetaMask, "metamask", "MetaMask", "")
	if setting.Auth.CustomProviders == nil {
		setting.Auth.CustomProviders = []model.PublicOAuthProviderSetting{{ID: "o2", Name: "O2", Enabled: false}}
	}
	return setting
}

func ModelCost(modelName string) (int, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return 0, err
	}
	modelName = strings.TrimSpace(modelName)
	for _, item := range normalizePublicSetting(settings.Public).ModelChannel.ModelCosts {
		if item.Model == modelName {
			return item.Credits, nil
		}
	}
	return 0, nil
}

func normalizePrivateSetting(setting model.PrivateSetting) model.PrivateSetting {
	if setting.Channels == nil {
		setting.Channels = []model.ModelChannel{}
	}
	setting.PromptSync = normalizePromptSyncSetting(setting.PromptSync)
	setting.Auth = normalizePrivateAuthSetting(setting.Auth)
	setting.Mail = normalizeMailSetting(setting.Mail)
	for i := range setting.Channels {
		if setting.Channels[i].Protocol == "" {
			setting.Channels[i].Protocol = "openai"
		}
		if setting.Channels[i].Models == nil {
			setting.Channels[i].Models = []string{}
		}
		if setting.Channels[i].Weight <= 0 {
			setting.Channels[i].Weight = 1
		}
	}
	return setting
}

func hidePrivateAPIKeys(settings model.Settings) model.Settings {
	for i := range settings.Private.Channels {
		settings.Private.Channels[i].APIKey = ""
	}
	settings.Private.Auth.LinuxDo.ClientSecret = ""
	settings.Private.Auth.Google.ClientSecret = ""
	settings.Private.Auth.Github.ClientSecret = ""
	for i := range settings.Private.Auth.CustomProviders {
		settings.Private.Auth.CustomProviders[i].ClientSecret = ""
	}
	settings.Private.Mail.Password = ""
	return settings
}

func keepPrivateAPIKeys(settings *model.Settings, saved model.Settings) {
	for i := range settings.Private.Channels {
		if strings.TrimSpace(settings.Private.Channels[i].APIKey) != "" {
			continue
		}
		if channel, ok := findSavedChannel(settings.Private.Channels[i], saved.Private.Channels, i); ok {
			settings.Private.Channels[i].APIKey = channel.APIKey
		}
	}
}

func keepPrivateAuthSecrets(settings *model.Settings, saved model.Settings) {
	if strings.TrimSpace(settings.Private.Auth.LinuxDo.ClientSecret) == "" {
		settings.Private.Auth.LinuxDo.ClientSecret = saved.Private.Auth.LinuxDo.ClientSecret
	}
	if strings.TrimSpace(settings.Private.Auth.Google.ClientSecret) == "" {
		settings.Private.Auth.Google.ClientSecret = saved.Private.Auth.Google.ClientSecret
	}
	if strings.TrimSpace(settings.Private.Auth.Github.ClientSecret) == "" {
		settings.Private.Auth.Github.ClientSecret = saved.Private.Auth.Github.ClientSecret
	}
	for i := range settings.Private.Auth.CustomProviders {
		if strings.TrimSpace(settings.Private.Auth.CustomProviders[i].ClientSecret) != "" {
			continue
		}
		if provider, ok := findSavedAuthProvider(settings.Private.Auth.CustomProviders[i], saved.Private.Auth.CustomProviders, i); ok {
			settings.Private.Auth.CustomProviders[i].ClientSecret = provider.ClientSecret
		}
	}
	if strings.TrimSpace(settings.Private.Mail.Password) == "" {
		settings.Private.Mail.Password = saved.Private.Mail.Password
	}
}

func normalizePublicAuthProvider(provider model.PublicOAuthProviderSetting, id string, name string, iconURL string) model.PublicOAuthProviderSetting {
	if provider.ID == "" {
		provider.ID = id
	}
	if provider.Name == "" {
		provider.Name = name
	}
	if provider.IconURL == "" {
		provider.IconURL = iconURL
	}
	return provider
}

func normalizePrivateAuthSetting(setting model.PrivateAuthSetting) model.PrivateAuthSetting {
	setting.LinuxDo = normalizePrivateAuthProvider(setting.LinuxDo, "linux-do", "Linux.do", config.Cfg.LinuxDoAuthorizeURL, config.Cfg.LinuxDoTokenURL, config.Cfg.LinuxDoUserInfoURL, "read")
	setting.Google = normalizePrivateAuthProvider(setting.Google, "google", "Google", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v3/userinfo", "openid email profile")
	setting.Github = normalizePrivateAuthProvider(setting.Github, "github", "GitHub", "https://github.com/login/oauth/authorize", "https://github.com/login/oauth/access_token", "https://api.github.com/user", "read:user user:email")
	if setting.CustomProviders == nil {
		setting.CustomProviders = []model.PrivateOAuthProviderSetting{normalizePrivateAuthProvider(model.PrivateOAuthProviderSetting{}, "o2", "O2", "", "", "", "openid email profile")}
	}
	for i := range setting.CustomProviders {
		setting.CustomProviders[i] = normalizePrivateAuthProvider(setting.CustomProviders[i], setting.CustomProviders[i].ID, setting.CustomProviders[i].Name, setting.CustomProviders[i].AuthorizeURL, setting.CustomProviders[i].TokenURL, setting.CustomProviders[i].UserInfoURL, setting.CustomProviders[i].Scope)
	}
	return setting
}

func normalizePrivateAuthProvider(provider model.PrivateOAuthProviderSetting, id string, name string, authorizeURL string, tokenURL string, userInfoURL string, scope string) model.PrivateOAuthProviderSetting {
	if provider.ID == "" {
		provider.ID = id
	}
	if provider.Name == "" {
		provider.Name = name
	}
	if provider.AuthorizeURL == "" {
		provider.AuthorizeURL = authorizeURL
	}
	if provider.TokenURL == "" {
		provider.TokenURL = tokenURL
	}
	if provider.UserInfoURL == "" {
		provider.UserInfoURL = userInfoURL
	}
	if provider.Scope == "" {
		provider.Scope = scope
	}
	return provider
}

func normalizeMailSetting(setting model.MailSetting) model.MailSetting {
	if setting.Port <= 0 {
		setting.Port = 587
	}
	if setting.CodeExpireMin <= 0 {
		setting.CodeExpireMin = 10
	}
	if setting.Templates.Register.Subject == "" {
		setting.Templates.Register.Subject = "注册验证码：{{code}}"
	}
	if setting.Templates.Register.Body == "" {
		setting.Templates.Register.Body = "你的注册验证码是 {{code}}，{{expireMinutes}} 分钟内有效。"
	}
	if setting.Templates.Reset.Subject == "" {
		setting.Templates.Reset.Subject = "找回密码验证码：{{code}}"
	}
	if setting.Templates.Reset.Body == "" {
		setting.Templates.Reset.Body = "你的找回密码验证码是 {{code}}，{{expireMinutes}} 分钟内有效。"
	}
	if setting.Templates.MetaMask.Subject == "" {
		setting.Templates.MetaMask.Subject = "MetaMask 登录邮箱验证码：{{code}}"
	}
	if setting.Templates.MetaMask.Body == "" {
		setting.Templates.MetaMask.Body = "你的 MetaMask 登录邮箱验证码是 {{code}}，{{expireMinutes}} 分钟内有效。"
	}
	return setting
}

func findSavedAuthProvider(provider model.PrivateOAuthProviderSetting, saved []model.PrivateOAuthProviderSetting, index int) (model.PrivateOAuthProviderSetting, bool) {
	for _, item := range saved {
		if item.ID == provider.ID && provider.ID != "" {
			return item, true
		}
	}
	if index < len(saved) {
		return saved[index], true
	}
	return model.PrivateOAuthProviderSetting{}, false
}

func findSavedChannel(channel model.ModelChannel, saved []model.ModelChannel, index int) (model.ModelChannel, bool) {
	for _, item := range saved {
		if item.Name == channel.Name && item.BaseURL == channel.BaseURL {
			return item, true
		}
	}
	if index < len(saved) {
		return saved[index], true
	}
	return model.ModelChannel{}, false
}

func SelectModelChannel(modelName string) (model.ModelChannel, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.ModelChannel{}, err
	}
	channels := modelChannelsForModel(normalizePrivateSetting(settings.Private).Channels, modelName)
	if len(channels) == 0 {
		return model.ModelChannel{}, errors.New("没有可用模型渠道")
	}
	total := 0
	for _, channel := range channels {
		total += channel.Weight
	}
	hit := rand.Intn(total)
	for _, channel := range channels {
		hit -= channel.Weight
		if hit < 0 {
			return channel, nil
		}
	}
	return channels[0], nil
}

func BuildModelChannelURL(channel model.ModelChannel, path string) string {
	baseURL := strings.TrimRight(channel.BaseURL, "/")
	if !strings.HasSuffix(baseURL, "/v1") {
		baseURL += "/v1"
	}
	return baseURL + path
}

func normalizeModelChannel(channel model.ModelChannel) model.ModelChannel {
	if channel.Protocol == "" {
		channel.Protocol = "openai"
	}
	if channel.Models == nil {
		channel.Models = []string{}
	}
	if channel.Weight <= 0 {
		channel.Weight = 1
	}
	return channel
}

func resolveAdminChannel(index *int, channel model.ModelChannel) (model.ModelChannel, error) {
	resolved := normalizeModelChannel(channel)
	if strings.TrimSpace(resolved.APIKey) == "" {
		settings, err := repository.GetSettings()
		if err != nil {
			return model.ModelChannel{}, err
		}
		saved := normalizePrivateSetting(settings.Private).Channels
		if index != nil && *index >= 0 && *index < len(saved) {
			if resolved.APIKey == "" {
				resolved.APIKey = saved[*index].APIKey
			}
			if resolved.BaseURL == "" {
				resolved.BaseURL = saved[*index].BaseURL
			}
			if resolved.Name == "" {
				resolved.Name = saved[*index].Name
			}
		}
		if resolved.APIKey == "" {
			if savedChannel, ok := findSavedChannel(resolved, saved, -1); ok {
				resolved.APIKey = savedChannel.APIKey
			}
		}
	}
	if strings.TrimSpace(resolved.BaseURL) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少接口地址"}
	}
	if strings.TrimSpace(resolved.APIKey) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少 API Key"}
	}
	return resolved, nil
}

func fetchAdminChannelModels(channel model.ModelChannel) ([]string, error) {
	request, err := http.NewRequest(http.MethodGet, BuildModelChannelURL(channel, "/models"), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return nil, readAdminChannelError(body, response.StatusCode, "读取模型失败")
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &payload)
	result := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		if strings.TrimSpace(item.ID) != "" {
			result = append(result, item.ID)
		}
	}
	sort.Strings(result)
	return result, nil
}

func testAdminChannelModel(channel model.ModelChannel, modelName string) (string, error) {
	if strings.TrimSpace(modelName) == "" {
		return "", errors.New("缺少模型名称")
	}
	body, _ := json.Marshal(map[string]any{
		"model": modelName,
		"messages": []map[string]string{{
			"role":    "user",
			"content": "hi",
		}},
	})
	request, err := http.NewRequest(http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+channel.APIKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return "", readAdminChannelError(responseBody, response.StatusCode, "测试失败")
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	_ = json.Unmarshal(responseBody, &payload)
	if len(payload.Choices) > 0 && strings.TrimSpace(payload.Choices[0].Message.Content) != "" {
		return payload.Choices[0].Message.Content, nil
	}
	return "ok", nil
}

func readAdminChannelError(body []byte, statusCode int, fallback string) error {
	var payload struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
		Msg string `json:"msg"`
	}
	if len(body) > 0 && json.Unmarshal(body, &payload) == nil {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return safeMessageError{message: payload.Error.Message}
		}
		if strings.TrimSpace(payload.Msg) != "" {
			return safeMessageError{message: payload.Msg}
		}
	}
	if statusCode == http.StatusUnauthorized {
		return safeMessageError{message: "上游接口认证失败（401），请检查 API Key"}
	}
	if statusCode > 0 {
		return safeMessageError{message: fmt.Sprintf("%s：%d", fallback, statusCode)}
	}
	return safeMessageError{message: fallback}
}

type safeMessageError struct {
	message string
}

func (err safeMessageError) Error() string {
	return err.message
}

func (err safeMessageError) SafeMessage() string {
	return err.message
}

func modelChannelsForModel(channels []model.ModelChannel, modelName string) []model.ModelChannel {
	result := []model.ModelChannel{}
	for _, channel := range channels {
		if !channel.Enabled || channel.BaseURL == "" || channel.APIKey == "" {
			continue
		}
		for _, item := range channel.Models {
			if strings.TrimSpace(item) == modelName {
				result = append(result, channel)
				break
			}
		}
	}
	return result
}
