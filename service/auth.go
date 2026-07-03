package service

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type TokenClaims struct {
	UserID       string         `json:"userId"`
	Username     string         `json:"username"`
	Role         model.UserRole `json:"role"`
	TokenVersion int            `json:"tokenVersion"`
	jwt.RegisteredClaims
}

type userExtra struct {
	LinuxDo any `json:"linuxDo,omitempty"`
	OAuth   any `json:"oauth,omitempty"`
}

type MailTemplateContext struct {
	IP      string
	Country string
	Region  string
}

type RequestLogMeta struct {
	IP      string
	Country string
}

type RegisterProfileInput struct {
	AccountType model.UserAccountType
	Name        string
}

type MetaMaskChallengeResponse struct {
	WalletAddress string `json:"walletAddress"`
	Nonce         string `json:"nonce"`
	Message       string `json:"message"`
	ExpiresAt     string `json:"expiresAt"`
}

var usernameSlugReplacer = strings.NewReplacer("-", "", "_", "", ".", "")

func EnsureDefaultAdmin() error {
	if strings.TrimSpace(config.Cfg.AdminUsername) == "" || strings.TrimSpace(config.Cfg.AdminPassword) == "" {
		return nil
	}
	hasAdmin, err := repository.HasAdmin()
	if err != nil {
		return err
	}
	if hasAdmin {
		return upgradeDefaultAdminPassword()
	}
	if isDefaultAdminCredential(config.Cfg.AdminUsername, config.Cfg.AdminPassword) {
		return safeMessageError{message: "首次启动前请设置安全的 ADMIN_USERNAME 和 ADMIN_PASSWORD"}
	}
	if err := validatePassword(config.Cfg.AdminPassword); err != nil {
		return err
	}
	hash, err := hashPassword(config.Cfg.AdminPassword)
	if err != nil {
		return err
	}
	_, err = repository.SaveUser(model.User{
		ID:               newID("user"),
		Username:         strings.TrimSpace(config.Cfg.AdminUsername),
		Password:         hash,
		AccountType:      model.UserAccountTypePersonal,
		ProfileCompleted: true,
		Role:             model.UserRoleAdmin,
		AffCode:          newAffCode(),
		Status:           model.UserStatusActive,
		CreatedAt:        now(),
		UpdatedAt:        now(),
	})
	return err
}

func upgradeDefaultAdminPassword() error {
	if strings.TrimSpace(config.Cfg.AdminPassword) == "" || strings.TrimSpace(config.Cfg.AdminPassword) == "aivro" {
		return nil
	}
	user, ok, err := repository.GetUserByUsername("admin")
	if err != nil || !ok || user.Role != model.UserRoleAdmin {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("aivro")) != nil {
		return nil
	}
	if err := validatePassword(config.Cfg.AdminPassword); err != nil {
		return err
	}
	hash, err := hashPassword(config.Cfg.AdminPassword)
	if err != nil {
		return err
	}
	user.Password = hash
	user.TokenVersion++
	user.UpdatedAt = now()
	_, err = repository.SaveUser(user)
	return err
}

func Register(username string, password string, email string, code string, profile RegisterProfileInput) (model.AuthSession, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, err
	}
	normalizedSettings := normalizeSettings(settings)
	if normalizedSettings.Public.Auth.AllowRegister != nil && !*normalizedSettings.Public.Auth.AllowRegister {
		return model.AuthSession{}, safeMessageError{message: "当前未开放注册"}
	}
	username = strings.TrimSpace(username)
	if err := validatePublicUsername(username); err != nil {
		return model.AuthSession{}, err
	}
	if password == "" {
		return model.AuthSession{}, safeMessageError{message: "密码不能为空"}
	}
	profile = normalizeRegisterProfile(profile, username)
	if err := validatePassword(password); err != nil {
		return model.AuthSession{}, err
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || code == "" {
		return model.AuthSession{}, safeMessageError{message: "请先完成邮箱验证码验证"}
	}
	if err := verifyEmailCode("register", email, code); err != nil {
		return model.AuthSession{}, err
	}
	if _, ok, err := repository.GetUserByUsername(username); err != nil || ok {
		if err != nil {
			return model.AuthSession{}, err
		}
		return model.AuthSession{}, safeMessageError{message: "用户名已存在"}
	}
	if email != "" {
		if _, ok, err := repository.GetUserByEmail(email); err != nil || ok {
			if err != nil {
				return model.AuthSession{}, err
			}
			return model.AuthSession{}, safeMessageError{message: "邮箱已被使用"}
		}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return model.AuthSession{}, err
	}
	user, err := repository.SaveUser(model.User{
		ID:               newID("user"),
		Username:         username,
		Password:         hash,
		Email:            email,
		DisplayName:      profile.Name,
		AccountType:      profile.AccountType,
		ProfileCompleted: true,
		EmailVerified:    true,
		AuthProvider:     "password",
		Role:             model.UserRoleUser,
		AffCode:          newAffCode(),
		Status:           model.UserStatusActive,
		CreatedAt:        now(),
		UpdatedAt:        now(),
	})
	if err != nil {
		return model.AuthSession{}, err
	}
	return newSession(user)
}

func CompleteUserProfile(user model.AuthUser, username string, accountType model.UserAccountType, name string, avatarURL string) (model.AuthUser, error) {
	saved, ok, err := repository.GetUserByID(user.ID)
	if err != nil || !ok {
		if err != nil {
			return model.AuthUser{}, err
		}
		return model.AuthUser{}, safeMessageError{message: "用户不存在"}
	}
	if !saved.ProfileCompleted {
		username = strings.TrimSpace(username)
		if err := validatePublicUsername(username); err != nil {
			return model.AuthUser{}, err
		}
		if username != saved.Username {
			if _, ok, err := repository.GetUserByUsername(username); err != nil || ok {
				if err != nil {
					return model.AuthUser{}, err
				}
				return model.AuthUser{}, safeMessageError{message: "用户名称已存在"}
			}
		}
		saved.Username = username
		saved.ProfileCompleted = true
	}
	profile := normalizeRegisterProfile(RegisterProfileInput{AccountType: accountType, Name: name}, saved.Username)
	saved.AccountType = profile.AccountType
	saved.DisplayName = profile.Name
	if avatarURL = strings.TrimSpace(avatarURL); avatarURL != "" {
		saved.AvatarURL = avatarURL
	}
	saved.UpdatedAt = now()
	saved, err = repository.SaveUser(saved)
	if err != nil {
		return model.AuthUser{}, err
	}
	return model.PublicUser(saved), nil
}

func Login(username string, password string) (model.AuthSession, error) {
	account := strings.TrimSpace(username)
	user, ok, err := repository.GetUserByUsername(account)
	if err == nil && !ok && strings.Contains(account, "@") {
		user, ok, err = repository.GetUserByEmail(strings.ToLower(account))
	}
	if err != nil {
		return model.AuthSession{}, err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		return model.AuthSession{}, safeMessageError{message: "用户名或密码错误"}
	}
	if user.Role == model.UserRoleAdmin && isDefaultAdminCredential(user.Username, password) {
		return model.AuthSession{}, safeMessageError{message: "默认管理员密码已禁用，请重置管理员密码"}
	}
	if user.Status == model.UserStatusBan {
		return model.AuthSession{}, safeMessageError{message: "账号已被禁用"}
	}
	normalizeUserDefaults(&user)
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, err
	}
	return newSession(user)
}

func LinuxDoAuthorizeURL(w http.ResponseWriter, r *http.Request, redirect string) (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	settings = normalizeSettings(settings)
	linuxDo := settings.Private.Auth.LinuxDo
	if !settings.Public.Auth.LinuxDo.Enabled {
		return "", safeMessageError{message: "Linux.do 登录未开启"}
	}
	if strings.TrimSpace(linuxDo.ClientID) == "" || strings.TrimSpace(linuxDo.ClientSecret) == "" {
		return "", safeMessageError{message: "Linux.do 登录未配置"}
	}
	values := url.Values{}
	values.Set("client_id", linuxDo.ClientID)
	values.Set("redirect_uri", linuxDoRedirectURI(r))
	values.Set("response_type", "code")
	values.Set("scope", "read")
	values.Set("state", newOAuthState(w, r, "linux-do", redirect))
	return linuxDo.AuthorizeURL + "?" + values.Encode(), nil
}

func LoginWithLinuxDo(r *http.Request, code string, state string) (model.AuthSession, string, error) {
	redirect, err := decodeState(r, "linux-do", state)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings = normalizeSettings(settings)
	linuxDo := settings.Private.Auth.LinuxDo
	if !settings.Public.Auth.LinuxDo.Enabled {
		return model.AuthSession{}, redirect, safeMessageError{message: "Linux.do 登录未开启"}
	}
	token, err := linuxDoAccessToken(r, code, linuxDo)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	profile, err := linuxDoProfile(token, linuxDo)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	linuxDoID := fmt.Sprint(profile.ID)
	if strings.TrimSpace(linuxDoID) == "" || linuxDoID == "0" {
		return model.AuthSession{}, redirect, safeMessageError{message: "Linux.do 用户信息无效"}
	}
	user, ok, err := repository.GetUserByLinuxDoID(linuxDoID)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	if !ok {
		if settings.Public.Auth.AllowRegister != nil && !*settings.Public.Auth.AllowRegister {
			return model.AuthSession{}, redirect, safeMessageError{message: "当前未开放注册"}
		}
		user = model.User{
			ID:               newID("user"),
			Username:         linuxDoUsername(profile.Username, linuxDoID),
			DisplayName:      "",
			AccountType:      model.UserAccountTypePersonal,
			ProfileCompleted: false,
			AvatarURL:        linuxDoAvatar(profile.AvatarTemplate),
			Role:             model.UserRoleUser,
			AffCode:          newAffCode(),
			LinuxDoID:        linuxDoID,
			Status:           model.UserStatusActive,
			CreatedAt:        now(),
		}
	} else if user.Status == model.UserStatusBan {
		return model.AuthSession{}, redirect, safeMessageError{message: "账号已被禁用"}
	}
	if user.ProfileCompleted {
		user.DisplayName = firstNonEmpty(profile.Name, user.DisplayName)
	}
	user.AvatarURL = firstNonEmpty(linuxDoAvatar(profile.AvatarTemplate), user.AvatarURL)
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	extra, _ := json.Marshal(userExtra{LinuxDo: profile})
	user.Extra = string(extra)
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	session, err := newSession(user)
	return session, redirect, err
}

func OAuthAuthorizeURL(w http.ResponseWriter, r *http.Request, provider string, redirect string) (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	settings = normalizeSettings(settings)
	publicProvider, privateProvider, ok := oauthProviderSettings(settings, provider)
	if !ok || !publicProvider.Enabled {
		return "", safeMessageError{message: "第三方登录未开启"}
	}
	if strings.TrimSpace(privateProvider.ClientID) == "" || strings.TrimSpace(privateProvider.ClientSecret) == "" || strings.TrimSpace(privateProvider.AuthorizeURL) == "" {
		return "", safeMessageError{message: "第三方登录未配置"}
	}
	values := url.Values{}
	values.Set("client_id", privateProvider.ClientID)
	values.Set("redirect_uri", oauthRedirectURI(r, publicProvider.ID))
	values.Set("response_type", "code")
	if strings.TrimSpace(privateProvider.Scope) != "" {
		values.Set("scope", privateProvider.Scope)
	}
	values.Set("state", newOAuthState(w, r, publicProvider.ID, redirect))
	return privateProvider.AuthorizeURL + "?" + values.Encode(), nil
}

func LoginWithOAuth(r *http.Request, provider string, code string, state string) (model.AuthSession, string, error) {
	redirect, err := decodeState(r, provider, state)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings = normalizeSettings(settings)
	publicProvider, privateProvider, ok := oauthProviderSettings(settings, provider)
	if !ok || !publicProvider.Enabled {
		return model.AuthSession{}, redirect, safeMessageError{message: "第三方登录未开启"}
	}
	token, err := oauthAccessToken(r, publicProvider.ID, code, privateProvider)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	profile, err := oauthProfile(token, publicProvider.ID, privateProvider)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	user, ok, err := findOAuthUser(publicProvider.ID, profile.ID)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	if !ok && profile.Email != "" {
		user, ok, err = repository.GetUserByEmail(profile.Email)
		if err != nil {
			return model.AuthSession{}, redirect, err
		}
	}
	if !ok {
		if settings.Public.Auth.AllowRegister != nil && !*settings.Public.Auth.AllowRegister {
			return model.AuthSession{}, redirect, safeMessageError{message: "当前未开放注册"}
		}
		user = model.User{
			ID:               newID("user"),
			Username:         oauthUsername(publicProvider.ID, profile.Username, profile.ID),
			Email:            profile.Email,
			DisplayName:      "",
			AccountType:      model.UserAccountTypePersonal,
			ProfileCompleted: false,
			AvatarURL:        profile.AvatarURL,
			Role:             model.UserRoleUser,
			AffCode:          newAffCode(),
			Status:           model.UserStatusActive,
			AuthProvider:     publicProvider.ID,
			EmailVerified:    profile.Email != "",
			CreatedAt:        now(),
		}
	} else if user.Status == model.UserStatusBan {
		return model.AuthSession{}, redirect, safeMessageError{message: "账号已被禁用"}
	}
	applyOAuthID(&user, publicProvider.ID, profile.ID)
	if user.ProfileCompleted {
		user.DisplayName = firstNonEmpty(profile.Name, user.DisplayName)
	}
	user.AvatarURL = firstNonEmpty(profile.AvatarURL, user.AvatarURL)
	if user.Email == "" {
		user.Email = profile.Email
	}
	if profile.Email != "" {
		user.EmailVerified = true
	}
	if user.AuthProvider == "" || user.AuthProvider == "password" {
		user.AuthProvider = publicProvider.ID
	}
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	extra, _ := json.Marshal(userExtra{OAuth: profile})
	user.Extra = string(extra)
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	session, err := newSession(user)
	return session, redirect, err
}

func CreateMetaMaskChallenge(walletAddress string) (MetaMaskChallengeResponse, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return MetaMaskChallengeResponse{}, err
	}
	settings = normalizeSettings(settings)
	if !settings.Public.Auth.MetaMask.Enabled || !settings.Private.Auth.MetaMask.Enabled {
		return MetaMaskChallengeResponse{}, safeMessageError{message: "MetaMask 登录未开启"}
	}
	walletAddress = strings.ToLower(strings.TrimSpace(walletAddress))
	if walletAddress == "" {
		return MetaMaskChallengeResponse{}, safeMessageError{message: "缺少钱包地址"}
	}
	nonce := mustRandomToken(24)
	expiresAt := time.Now().Add(5 * time.Minute).Format(time.RFC3339)
	message := buildMetaMaskChallengeMessage(settings.Private.Auth.MetaMask, walletAddress, nonce, expiresAt)
	item := model.MetaMaskChallenge{
		ID:            newID("mm"),
		WalletAddress: walletAddress,
		Nonce:         nonce,
		Message:       message,
		ExpiresAt:     expiresAt,
		CreatedAt:     now(),
	}
	if _, err := repository.SaveMetaMaskChallenge(item); err != nil {
		return MetaMaskChallengeResponse{}, err
	}
	return MetaMaskChallengeResponse{WalletAddress: walletAddress, Nonce: nonce, Message: message, ExpiresAt: expiresAt}, nil
}

func LoginWithMetaMask(walletAddress string, message string, signature string, email string, code string) (model.AuthSession, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, err
	}
	settings = normalizeSettings(settings)
	if !settings.Public.Auth.MetaMask.Enabled || !settings.Private.Auth.MetaMask.Enabled {
		return model.AuthSession{}, safeMessageError{message: "MetaMask 登录未开启"}
	}
	walletAddress = strings.ToLower(strings.TrimSpace(walletAddress))
	if walletAddress == "" || strings.TrimSpace(signature) == "" {
		return model.AuthSession{}, safeMessageError{message: "缺少钱包签名"}
	}
	challenge, ok, err := activeMetaMaskChallenge(walletAddress, message)
	if err != nil {
		return model.AuthSession{}, err
	}
	if !ok {
		return model.AuthSession{}, safeMessageError{message: "MetaMask 签名内容无效"}
	}
	if !validMetaMaskSignature(walletAddress, message, signature) {
		return model.AuthSession{}, safeMessageError{message: "MetaMask 签名无效"}
	}
	user, ok, err := repository.GetUserByMetaMaskAddress(walletAddress)
	if err != nil {
		return model.AuthSession{}, err
	}
	if !ok {
		if settings.Public.Auth.AllowRegister != nil && !*settings.Public.Auth.AllowRegister {
			return model.AuthSession{}, safeMessageError{message: "当前未开放注册"}
		}
		email = strings.TrimSpace(strings.ToLower(email))
		if email == "" || code == "" {
			return model.AuthSession{}, safeMessageError{message: "请先验证邮箱"}
		}
		if err := verifyEmailCode("metamask", email, code); err != nil {
			return model.AuthSession{}, err
		}
		user = model.User{
			ID:               newID("user"),
			Username:         metamaskUsername(walletAddress),
			Email:            email,
			EmailVerified:    true,
			DisplayName:      "",
			AccountType:      model.UserAccountTypePersonal,
			ProfileCompleted: false,
			Role:             model.UserRoleUser,
			AffCode:          newAffCode(),
			Status:           model.UserStatusActive,
			AuthProvider:     "metamask",
			MetaMaskAddress:  walletAddress,
			CreatedAt:        now(),
		}
	} else if user.Status == model.UserStatusBan {
		return model.AuthSession{}, safeMessageError{message: "账号已被禁用"}
	}
	consumed, err := repository.ConsumeMetaMaskChallenge(challenge.ID, now())
	if err != nil {
		return model.AuthSession{}, err
	}
	if !consumed {
		return model.AuthSession{}, safeMessageError{message: "MetaMask 签名已过期，请重试"}
	}
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, err
	}
	return newSession(user)
}

func ParseToken(tokenText string) (TokenClaims, error) {
	claims := TokenClaims{}
	token, err := jwt.ParseWithClaims(tokenText, &claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("登录状态无效")
		}
		return []byte(config.Cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return TokenClaims{}, errors.New("登录状态无效")
	}
	return claims, nil
}

func CurrentAuthUser(tokenText string) (model.AuthUser, bool) {
	claims, err := ParseToken(tokenText)
	if err != nil {
		return model.AuthUser{}, false
	}
	user, ok, err := repository.GetUserByID(claims.UserID)
	if err != nil || !ok {
		return model.AuthUser{}, false
	}
	if user.Status == model.UserStatusBan {
		return model.AuthUser{}, false
	}
	if claims.TokenVersion != user.TokenVersion {
		return model.AuthUser{}, false
	}
	return model.PublicUser(user), true
}

func ListUsers(q model.Query) (model.UserList, error) {
	users, total, err := repository.ListUsers(q)
	if err != nil {
		return model.UserList{}, err
	}
	for i := range users {
		users[i].Password = ""
		normalizeUserDefaults(&users[i])
	}
	return model.UserList{Items: users, Total: int(total)}, nil
}

func CountAuthProviderUsers() (map[string]int64, error) {
	return repository.CountAuthProviderUsers()
}

func SaveUser(user model.User, password string) (model.User, error) {
	user.Username = strings.TrimSpace(user.Username)
	if strings.ContainsAny(user.Username, " \t\r\n") {
		return user, safeMessageError{message: "用户名不能包含空格"}
	}
	if user.Username == "" {
		return user, safeMessageError{message: "用户名不能为空"}
	}
	if user.Role == "" || user.Role == model.UserRoleGuest {
		user.Role = model.UserRoleUser
	}
	if user.Status == "" {
		user.Status = model.UserStatusActive
	}
	if user.AccountType == "" {
		user.AccountType = model.UserAccountTypePersonal
	}
	if saved, ok, err := repository.GetUserByUsername(user.Username); err != nil {
		return user, err
	} else if ok && saved.ID != user.ID {
		return user, safeMessageError{message: "用户名已存在"}
	}
	isCreate := user.ID == ""
	if isCreate {
		user.ProfileCompleted = strings.TrimSpace(user.DisplayName) != ""
		user.ID = newID("user")
		user.AffCode = newAffCode()
		user.CreatedAt = now()
	} else if saved, ok, err := repository.GetUserByID(user.ID); err != nil {
		return user, err
	} else if ok {
		user.CreatedAt = saved.CreatedAt
		user.Password = saved.Password
		user.AvatarURL = saved.AvatarURL
		user.Credits = saved.Credits
		user.WorkflowCreateCredits = saved.WorkflowCreateCredits
		user.Extra = saved.Extra
		if user.AffCode == "" {
			user.AffCode = saved.AffCode
		}
		if user.AffCode == "" {
			user.AffCode = newAffCode()
		}
		if user.LinuxDoID == "" {
			user.LinuxDoID = saved.LinuxDoID
		}
		if user.GithubID == "" {
			user.GithubID = saved.GithubID
		}
		if user.GoogleID == "" {
			user.GoogleID = saved.GoogleID
		}
		if user.MetaMaskAddress == "" {
			user.MetaMaskAddress = saved.MetaMaskAddress
		}
		if user.AuthProvider == "" {
			user.AuthProvider = saved.AuthProvider
		}
		user.LastLoginAt = saved.LastLoginAt
	}
	if password != "" {
		if err := validatePassword(password); err != nil {
			return user, err
		}
		hash, err := hashPassword(password)
		if err != nil {
			return user, err
		}
		user.Password = hash
		user.TokenVersion++
	}
	if isCreate && user.Password == "" {
		return user, safeMessageError{message: "密码不能为空"}
	}
	user.UpdatedAt = now()
	user, err := repository.SaveUser(user)
	user.Password = ""
	return user, err
}

func AdjustUserCredits(id string, credits int, operator model.AuthUser) (model.User, error) {
	user, ok, err := repository.GetUserByID(id)
	if err != nil || !ok {
		if err != nil {
			return user, err
		}
		return user, safeMessageError{message: "用户不存在"}
	}
	oldCredits := user.Credits
	user.Credits = credits
	user.UpdatedAt = now()
	user, err = repository.SaveUser(user)
	if err == nil && oldCredits != credits {
		extra, _ := json.Marshal(map[string]string{
			"operatorId":       operator.ID,
			"operatorUsername": operator.Username,
		})
		_, err = repository.SaveCreditLog(model.CreditLog{
			ID:        newID("credit"),
			UserID:    user.ID,
			Category:  creditLogCategory(model.CreditLogTypeAdminAdjust),
			Type:      model.CreditLogTypeAdminAdjust,
			Amount:    credits - oldCredits,
			Balance:   credits,
			Remark:    "后台手动调整",
			Extra:     string(extra),
			CreatedAt: now(),
		})
	}
	user.Password = ""
	return user, err
}

func AdjustUserWorkflowCreateCredits(id string, credits int) (model.User, error) {
	user, ok, err := repository.GetUserByID(id)
	if err != nil || !ok {
		if err != nil {
			return user, err
		}
		return user, safeMessageError{message: "用户不存在"}
	}
	if credits < 0 {
		credits = 0
	}
	user.WorkflowCreateCredits = credits
	user.UpdatedAt = now()
	user, err = repository.SaveUser(user)
	user.Password = ""
	return user, err
}

func ConsumeUserCredits(userID string, modelName string, credits int, path string) error {
	return ConsumeUserCreditsWithMeta(userID, modelName, credits, path, RequestLogMeta{})
}

func ConsumeUserCreditsWithMeta(userID string, modelName string, credits int, path string, meta RequestLogMeta) error {
	meta = normalizeRequestLogMeta(meta)
	if credits <= 0 {
		user, ok, err := repository.GetUserByID(userID)
		if err != nil {
			return err
		}
		if !ok {
			return safeMessageError{message: "用户不存在"}
		}
		extra, _ := json.Marshal(map[string]string{"model": modelName, "path": path, "ip": meta.IP, "country": meta.Country})
		_, err = repository.SaveCreditLog(model.CreditLog{
			ID:        newID("credit"),
			UserID:    userID,
			Category:  creditLogCategory(model.CreditLogTypeAIConsume),
			Type:      model.CreditLogTypeAIConsume,
			Model:     modelName,
			Path:      path,
			Amount:    0,
			Balance:   user.Credits,
			Remark:    "调用模型 " + modelName,
			IP:        meta.IP,
			Country:   meta.Country,
			Extra:     string(extra),
			CreatedAt: now(),
		})
		return err
	}
	user, ok, err := repository.ConsumeUserCredits(userID, credits, now())
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "算力点不足"}
	}
	extra, _ := json.Marshal(map[string]string{"model": modelName, "path": path, "ip": meta.IP, "country": meta.Country})
	_, err = repository.SaveCreditLog(model.CreditLog{
		ID:        newID("credit"),
		UserID:    userID,
		Category:  creditLogCategory(model.CreditLogTypeAIConsume),
		Type:      model.CreditLogTypeAIConsume,
		Model:     modelName,
		Path:      path,
		Amount:    -credits,
		Balance:   user.Credits,
		Remark:    "调用模型 " + modelName,
		IP:        meta.IP,
		Country:   meta.Country,
		Extra:     string(extra),
		CreatedAt: now(),
	})
	return err
}

func RefundUserCredits(userID string, modelName string, credits int, path string) error {
	return RefundUserCreditsWithMeta(userID, modelName, credits, path, RequestLogMeta{})
}

func RefundUserCreditsWithMeta(userID string, modelName string, credits int, path string, meta RequestLogMeta) error {
	if credits <= 0 {
		return nil
	}
	user, ok, err := repository.RefundUserCredits(userID, credits, now())
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "用户不存在"}
	}
	meta = normalizeRequestLogMeta(meta)
	extra, _ := json.Marshal(map[string]string{"model": modelName, "path": path, "ip": meta.IP, "country": meta.Country})
	_, err = repository.SaveCreditLog(model.CreditLog{
		ID:        newID("credit"),
		UserID:    userID,
		Category:  creditLogCategory(model.CreditLogTypeAIRefund),
		Type:      model.CreditLogTypeAIRefund,
		Model:     modelName,
		Path:      path,
		Amount:    credits,
		Balance:   user.Credits,
		Remark:    "模型调用失败返还 " + modelName,
		IP:        meta.IP,
		Country:   meta.Country,
		Extra:     string(extra),
		CreatedAt: now(),
	})
	return err
}

func ListCreditLogs(q model.Query) (model.CreditLogList, error) {
	logs, total, err := repository.ListCreditLogs(q)
	if err != nil {
		return model.CreditLogList{}, err
	}
	enrichCreditLogs(logs)
	return model.CreditLogList{Items: logs, Total: int(total)}, nil
}

func ListAuditLogs(q model.Query) (model.AuditLogList, error) {
	logs, total, err := repository.ListAuditLogs(q)
	if err != nil {
		return model.AuditLogList{}, err
	}
	enrichAuditLogs(logs)
	return model.AuditLogList{Items: logs, Total: int(total)}, nil
}

func SaveAuditLog(log model.AuditLog) error {
	if log.ID == "" {
		log.ID = newID("audit")
	}
	if log.Category == "" {
		log.Category = auditLogCategory(log.Action, log.TargetType)
	}
	log.IP = strings.TrimSpace(log.IP)
	log.Country = strings.TrimSpace(log.Country)
	if log.CreatedAt == "" {
		log.CreatedAt = now()
	}
	_, err := repository.SaveAuditLog(log)
	return err
}

func SaveCreditLog(log model.CreditLog) (model.CreditLog, error) {
	if log.ID == "" {
		log.ID = newID("credit")
		log.CreatedAt = now()
	}
	if log.Category == "" {
		log.Category = creditLogCategory(log.Type)
	}
	return repository.SaveCreditLog(log)
}

func DeleteCreditLog(id string) error {
	return repository.DeleteCreditLog(id)
}

func DeleteUser(id string) error {
	return repository.DeleteUser(id)
}

func GuestUser() model.AuthUser {
	return model.AuthUser{ID: "", Username: "guest", Role: model.UserRoleGuest}
}

func newSession(user model.User) (model.AuthSession, error) {
	token, err := newToken(user)
	if err != nil {
		return model.AuthSession{}, err
	}
	normalizeUserDefaults(&user)
	return model.AuthSession{Token: token, User: model.PublicUser(user)}, nil
}

func newToken(user model.User) (string, error) {
	expireHours := RuntimeSetting().JWTExpireHours
	if expireHours <= 0 {
		expireHours = 168
	}
	claims := TokenClaims{
		UserID:       user.ID,
		Username:     user.Username,
		Role:         user.Role,
		TokenVersion: user.TokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.Cfg.JWTSecret))
}

func AuthTokenFromRequest(r *http.Request) string {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if strings.TrimSpace(token) != "" {
		return strings.TrimSpace(token)
	}
	if cookie, err := r.Cookie(authCookieName); err == nil {
		return strings.TrimSpace(cookie.Value)
	}
	return ""
}

func SetAuthCookie(w http.ResponseWriter, r *http.Request, token string) {
	maxAge := RuntimeSetting().JWTExpireHours * 3600
	if maxAge <= 0 {
		maxAge = 168 * 3600
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   requestSecure(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearAuthCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   requestSecure(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func requestSecure(r *http.Request) bool {
	proto := trustedForwardedValue(r, "X-Forwarded-Proto")
	return strings.EqualFold(proto, "https") || r.TLS != nil || strings.HasPrefix(normalizedConfiguredOrigin(), "https://")
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func validatePassword(password string) error {
	if len([]rune(password)) < 8 {
		return safeMessageError{message: "密码至少需要 8 个字符"}
	}
	hasLetter := false
	hasDigit := false
	for _, r := range password {
		if unicode.IsLetter(r) {
			hasLetter = true
		}
		if unicode.IsDigit(r) {
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return safeMessageError{message: "密码需要同时包含字母和数字"}
	}
	return nil
}

func validMetaMaskSignature(walletAddress string, message string, signature string) bool {
	walletAddress = strings.ToLower(strings.TrimSpace(walletAddress))
	if walletAddress == "" || strings.TrimSpace(message) == "" {
		return false
	}
	sig := strings.TrimPrefix(strings.TrimSpace(signature), "0x")
	sigBytes, err := hex.DecodeString(sig)
	if err != nil || len(sigBytes) != 65 {
		return false
	}
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}
	if sigBytes[64] > 1 {
		return false
	}
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefix))
	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return false
	}
	return strings.EqualFold(crypto.PubkeyToAddress(*pubKey).Hex(), walletAddress)
}

func activeMetaMaskChallenge(walletAddress string, message string) (model.MetaMaskChallenge, bool, error) {
	nonce := metaMaskMessageValue(message, "Nonce")
	if nonce == "" {
		return model.MetaMaskChallenge{}, false, nil
	}
	challenge, ok, err := repository.GetActiveMetaMaskChallenge(nonce, now())
	if err != nil || !ok {
		return model.MetaMaskChallenge{}, false, err
	}
	if !strings.EqualFold(challenge.WalletAddress, walletAddress) || challenge.Message != strings.TrimSpace(message) {
		return model.MetaMaskChallenge{}, false, nil
	}
	return challenge, true, nil
}

func buildMetaMaskChallengeMessage(setting model.PrivateMetaMaskAuthSetting, walletAddress string, nonce string, expiresAt string) string {
	siteName := strings.TrimSpace(firstNonEmpty(setting.SiteName, "Aivro"))
	lines := []string{
		siteName + " MetaMask login",
		"Wallet: " + strings.ToLower(strings.TrimSpace(walletAddress)),
		"Nonce: " + nonce,
		"Issued At: " + now(),
		"Expires At: " + expiresAt,
	}
	if siteURL := strings.TrimSpace(setting.SiteURL); siteURL != "" {
		lines = append(lines[:1], append([]string{"Site URL: " + siteURL}, lines[1:]...)...)
	}
	if logoURL := strings.TrimSpace(setting.SignatureLogoURL); logoURL != "" {
		lines = append(lines[:2], append([]string{"Logo: " + logoURL}, lines[2:]...)...)
	}
	return strings.Join(lines, "\n")
}

func metaMaskMessageValue(message string, key string) string {
	prefix := strings.ToLower(strings.TrimSpace(key)) + ":"
	for _, line := range strings.Split(strings.TrimSpace(message), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(line), prefix) {
			return strings.TrimSpace(line[len(prefix):])
		}
	}
	return ""
}

func now() string {
	return time.Now().Format(time.RFC3339)
}

func newID(prefix string) string {
	return prefix + "-" + uuid.NewString()
}

func newAffCode() string {
	return strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
}

func normalizeUserDefaults(user *model.User) {
	if user.Status == "" {
		user.Status = model.UserStatusActive
	}
	if user.AccountType == "" {
		user.AccountType = model.UserAccountTypePersonal
	}
	if user.AffCode == "" {
		user.AffCode = newAffCode()
	}
}

func normalizeRegisterProfile(profile RegisterProfileInput, fallbackName string) RegisterProfileInput {
	if profile.AccountType != model.UserAccountTypeCompany {
		profile.AccountType = model.UserAccountTypePersonal
	}
	profile.Name = strings.TrimSpace(profile.Name)
	if profile.Name == "" {
		profile.Name = strings.TrimSpace(fallbackName)
	}
	if profile.Name == "" {
		profile.Name = "Aivro User"
	}
	return profile
}

func validatePublicUsername(username string) error {
	if username == "" {
		return safeMessageError{message: "请填写用户名称"}
	}
	if len(username) < 3 || len(username) > 24 {
		return safeMessageError{message: "用户名称需为 3-24 位小写字母或数字"}
	}
	for _, char := range username {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return safeMessageError{message: "用户名称仅支持小写字母和数字"}
		}
	}
	return nil
}

type linuxDoTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type linuxDoUserResponse struct {
	ID             int64  `json:"id"`
	Username       string `json:"username"`
	Name           string `json:"name"`
	AvatarTemplate string `json:"avatar_template"`
}

func linuxDoAccessToken(r *http.Request, code string, setting model.PrivateOAuthProviderSetting) (string, error) {
	values := url.Values{}
	values.Set("client_id", setting.ClientID)
	values.Set("client_secret", setting.ClientSecret)
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", linuxDoRedirectURI(r))
	req, _ := http.NewRequest(http.MethodPost, setting.TokenURL, strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var payload linuxDoTokenResponse
	if err := doLinuxDoJSON(req, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.AccessToken) == "" {
		return "", safeMessageError{message: "Linux.do 登录失败"}
	}
	return payload.AccessToken, nil
}

func linuxDoRedirectURI(r *http.Request) string {
	return RequestOrigin(r) + "/api/auth/linux-do/callback"
}

func linuxDoProfile(token string, setting model.PrivateOAuthProviderSetting) (linuxDoUserResponse, error) {
	req, _ := http.NewRequest(http.MethodGet, setting.UserInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var payload linuxDoUserResponse
	err := doLinuxDoJSON(req, &payload)
	return payload, err
}

func doLinuxDoJSON(req *http.Request, payload any) error {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return safeMessageError{message: "Linux.do 登录失败"}
	}
	return json.NewDecoder(bytes.NewReader(body)).Decode(payload)
}

func linuxDoUsername(username string, id string) string {
	base := sanitizeSuggestedUsername(username)
	if base == "" {
		base = sanitizeSuggestedUsername("linuxdo" + id)
	}
	return uniqueSuggestedUsername(base, id)
}

func linuxDoAvatar(template string) string {
	if strings.TrimSpace(template) == "" {
		return ""
	}
	if strings.HasPrefix(template, "//") {
		template = "https:" + template
	}
	if strings.HasPrefix(template, "/") {
		template = "https://linux.do" + template
	}
	return strings.ReplaceAll(template, "{size}", "120")
}

type oauthProfileData struct {
	ID        string
	Provider  string
	Username  string
	Name      string
	Email     string
	AvatarURL string
}

func oauthProviderSettings(settings model.Settings, provider string) (model.PublicOAuthProviderSetting, model.PrivateOAuthProviderSetting, bool) {
	provider = strings.TrimSpace(provider)
	switch provider {
	case "linux-do":
		return settings.Public.Auth.LinuxDo, settings.Private.Auth.LinuxDo, true
	case "google":
		return settings.Public.Auth.Google, settings.Private.Auth.Google, true
	case "github":
		return settings.Public.Auth.Github, settings.Private.Auth.Github, true
	}
	for i, item := range settings.Public.Auth.CustomProviders {
		if item.ID == provider {
			if i < len(settings.Private.Auth.CustomProviders) {
				return item, settings.Private.Auth.CustomProviders[i], true
			}
			for _, private := range settings.Private.Auth.CustomProviders {
				if private.ID == provider {
					return item, private, true
				}
			}
		}
	}
	return model.PublicOAuthProviderSetting{}, model.PrivateOAuthProviderSetting{}, false
}

func oauthRedirectURI(r *http.Request, provider string) string {
	return RequestOrigin(r) + "/api/auth/oauth/" + url.PathEscape(provider) + "/callback"
}

func oauthAccessToken(r *http.Request, provider string, code string, setting model.PrivateOAuthProviderSetting) (string, error) {
	values := url.Values{}
	values.Set("client_id", setting.ClientID)
	values.Set("client_secret", setting.ClientSecret)
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", oauthRedirectURI(r, provider))
	req, _ := http.NewRequest(http.MethodPost, setting.TokenURL, strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	var payload struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := doJSON(req, &payload, "第三方登录失败"); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.AccessToken) == "" {
		return "", safeMessageError{message: "第三方登录失败"}
	}
	return payload.AccessToken, nil
}

func oauthProfile(token string, provider string, setting model.PrivateOAuthProviderSetting) (oauthProfileData, error) {
	req, _ := http.NewRequest(http.MethodGet, setting.UserInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	var payload map[string]any
	if err := doJSON(req, &payload, "读取第三方用户信息失败"); err != nil {
		return oauthProfileData{}, err
	}
	id := firstNonEmpty(anyString(payload["sub"]), anyString(payload["id"]), anyString(payload["uid"]), anyString(payload["open_id"]), anyString(payload["user_id"]))
	if id == "" {
		return oauthProfileData{}, safeMessageError{message: "第三方用户信息无效"}
	}
	profile := oauthProfileData{
		ID:        id,
		Provider:  provider,
		Username:  firstNonEmpty(anyString(payload["login"]), anyString(payload["username"]), anyString(payload["preferred_username"]), id),
		Name:      firstNonEmpty(anyString(payload["name"]), anyString(payload["nickname"])),
		Email:     strings.ToLower(anyString(payload["email"])),
		AvatarURL: firstNonEmpty(anyString(payload["avatar_url"]), anyString(payload["picture"]), anyString(payload["avatar"])),
	}
	if provider == "github" && profile.Email == "" {
		profile.Email = githubPrimaryEmail(token)
	}
	return profile, nil
}

func githubPrimaryEmail(token string) string {
	req, _ := http.NewRequest(http.MethodGet, "https://api.github.com/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	var payload []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := doJSON(req, &payload, ""); err != nil {
		return ""
	}
	for _, item := range payload {
		if item.Primary && strings.TrimSpace(item.Email) != "" {
			return strings.ToLower(strings.TrimSpace(item.Email))
		}
	}
	if len(payload) > 0 {
		return strings.ToLower(strings.TrimSpace(payload[0].Email))
	}
	return ""
}

func doJSON(req *http.Request, payload any, fallback string) error {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return safeMessageError{message: fallback}
	}
	return json.NewDecoder(bytes.NewReader(body)).Decode(payload)
}

func findOAuthUser(provider string, id string) (model.User, bool, error) {
	switch provider {
	case "linux-do":
		return repository.GetUserByLinuxDoID(id)
	case "google":
		return repository.GetUserByGoogleID(id)
	case "github":
		return repository.GetUserByGithubID(id)
	default:
		return repository.GetUserByAuthProviderOAuthID(provider, id)
	}
}

func applyOAuthID(user *model.User, provider string, id string) {
	switch provider {
	case "linux-do":
		user.LinuxDoID = id
	case "google":
		user.GoogleID = id
	case "github":
		user.GithubID = id
	}
}

func oauthUsername(provider string, username string, id string) string {
	base := sanitizeSuggestedUsername(username)
	if base == "" {
		base = sanitizeSuggestedUsername(provider + id)
	}
	return uniqueSuggestedUsername(base, id)
}

func sanitizeSuggestedUsername(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	result := usernameSlugReplacer.Replace(builder.String())
	if len(result) > 24 {
		result = result[:24]
	}
	if len(result) < 3 {
		return ""
	}
	return result
}

func uniqueSuggestedUsername(base string, id string) string {
	if base == "" {
		base = sanitizeSuggestedUsername("user" + id)
	}
	candidates := []string{base, sanitizeSuggestedUsername(base + id)}
	for index := 2; index <= 99; index++ {
		candidates = append(candidates, sanitizeSuggestedUsername(base+strconv.Itoa(index)))
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, ok, err := repository.GetUserByUsername(candidate); err != nil || !ok {
			return candidate
		}
	}
	return "user" + strings.ReplaceAll(uuid.NewString(), "-", "")[:20]
}

func anyString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case int:
		return strconv.Itoa(typed)
	default:
		return ""
	}
}

func metamaskUsername(wallet string) string {
	return uniqueSuggestedUsername(sanitizeSuggestedUsername("wallet"+shortWallet(wallet)), wallet)
}

func shortWallet(wallet string) string {
	if len(wallet) <= 10 {
		return wallet
	}
	return wallet[:6] + wallet[len(wallet)-4:]
}

func SendEmailCode(email string, purpose string, context MailTemplateContext) error {
	email = strings.TrimSpace(strings.ToLower(email))
	purpose = strings.TrimSpace(purpose)
	if email == "" {
		return safeMessageError{message: "请输入邮箱"}
	}
	if purpose != "register" && purpose != "reset" && purpose != "metamask" {
		return safeMessageError{message: "验证码用途无效"}
	}
	if purpose == "register" {
		if err := RegisterEmailAvailable(email); err != nil {
			return err
		}
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	settings = normalizeSettings(settings)
	if purpose == "reset" {
		if _, ok, err := repository.GetUserByEmail(email); err != nil || !ok {
			if err != nil {
				return err
			}
			return safeMessageError{message: "邮箱未绑定账号"}
		}
	}
	if purpose == "metamask" && !settings.Public.Auth.MetaMask.Enabled {
		return safeMessageError{message: "MetaMask 登录未开启"}
	}
	code, err := randomCode()
	if err != nil {
		return err
	}
	expireMinutes := settings.Private.Mail.CodeExpireMin
	if last, ok, err := repository.GetLatestEmailVerification(purpose, email); err != nil {
		return err
	} else if ok {
		if createdAt, err := time.Parse(time.RFC3339, last.CreatedAt); err == nil && time.Since(createdAt) < time.Minute {
			return safeMessageError{message: "验证码发送太频繁，请稍后再试"}
		}
	}
	item := model.EmailVerification{
		ID:        newID("mail"),
		Purpose:   purpose,
		Target:    email,
		Code:      code,
		ExpiresAt: time.Now().Add(time.Duration(expireMinutes) * time.Minute).Format(time.RFC3339),
		CreatedAt: now(),
	}
	if _, err := repository.SaveEmailVerification(item); err != nil {
		return err
	}
	return sendVerificationMail(settings.Private.Mail, email, purpose, code, context)
}

func RegisterEmailAvailable(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return safeMessageError{message: "请输入邮箱"}
	}
	if _, ok, err := repository.GetUserByEmail(email); err != nil || ok {
		if err != nil {
			return err
		}
		return safeMessageError{message: "邮箱已被使用"}
	}
	return nil
}

func ResetPassword(email string, code string, password string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || code == "" || password == "" {
		return safeMessageError{message: "邮箱、验证码和新密码不能为空"}
	}
	if err := validatePassword(password); err != nil {
		return err
	}
	if err := verifyEmailCode("reset", email, code); err != nil {
		return err
	}
	user, ok, err := repository.GetUserByEmail(email)
	if err != nil || !ok {
		if err != nil {
			return err
		}
		return safeMessageError{message: "邮箱未绑定账号"}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	user.Password = hash
	user.TokenVersion++
	user.UpdatedAt = now()
	_, err = repository.SaveUser(user)
	return err
}

func verifyEmailCode(purpose string, email string, code string) error {
	item, ok, err := repository.GetLatestActiveEmailVerification(purpose, strings.TrimSpace(strings.ToLower(email)), now())
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "验证码无效或已过期"}
	}
	if item.Attempts >= 5 {
		return safeMessageError{message: "验证码错误次数过多，请重新获取"}
	}
	if strings.TrimSpace(item.Code) != strings.TrimSpace(code) {
		item.Attempts++
		_, _ = repository.SaveEmailVerification(item)
		return safeMessageError{message: "验证码无效或已过期"}
	}
	item.UsedAt = now()
	_, err = repository.SaveEmailVerification(item)
	return err
}

func randomCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func sendVerificationMail(setting model.MailSetting, email string, purpose string, code string, context MailTemplateContext) error {
	if !setting.Enabled {
		return safeMessageError{message: "邮件服务未开启"}
	}
	if setting.Host == "" || setting.FromEmail == "" {
		return safeMessageError{message: "SMTP 未配置"}
	}
	template := setting.Templates.Register
	if purpose == "reset" {
		template = setting.Templates.Reset
	} else if purpose == "metamask" {
		template = setting.Templates.MetaMask
	}
	subject := renderMailTemplate(template.Subject, email, code, setting.CodeExpireMin, context)
	body := renderMailTemplate(template.Body, email, code, setting.CodeExpireMin, context)
	from := setting.FromEmail
	if strings.TrimSpace(setting.FromName) != "" {
		from = fmt.Sprintf("%s <%s>", mimeHeader(setting.FromName), setting.FromEmail)
	}
	message := strings.Join([]string{
		"From: " + from,
		"To: " + email,
		"Subject: " + mimeHeader(subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")
	addr := setting.Host + ":" + strconv.Itoa(setting.Port)
	var err error
	if setting.Port == 465 {
		err = sendMailTLS(addr, setting.Host, setting.Username, setting.Password, setting.FromEmail, []string{email}, []byte(message))
	} else {
		err = sendMailPlain(addr, setting.Host, setting.Username, setting.Password, setting.FromEmail, []string{email}, []byte(message))
	}
	if err != nil {
		return mailDeliveryError{err: err}
	}
	return nil
}

type mailDeliveryError struct {
	err error
}

func (err mailDeliveryError) Error() string {
	return err.err.Error()
}

func (err mailDeliveryError) Unwrap() error {
	return err.err
}

func (err mailDeliveryError) SafeMessage() string {
	return "邮件发送失败，请联系管理员检查 SMTP 配置"
}

func (err mailDeliveryError) DetailMessage() string {
	message := strings.TrimSpace(err.err.Error())
	message = strings.ReplaceAll(message, "\r", " ")
	message = strings.ReplaceAll(message, "\n", " ")
	if message == "" {
		return "请检查 SMTP 配置"
	}
	if isSMTPAuthFailureMessage(message) {
		return "SMTP 认证失败：服务器拒绝了当前 SMTP 用户名和密码。请确认：1) 用户名为完整发件邮箱地址且无空格；2) 密码类型正确——QQ/163 等需填 SMTP 授权码（非网页登录密码），阿里企业邮箱等需填邮箱登录密码或客户端专用密码（非授权码）；3) 邮箱已开启 SMTP/客户端授权。原始错误：" + message
	}
	return message
}

func isSMTPAuthFailureMessage(message string) bool {
	text := strings.ToLower(message)
	return strings.Contains(text, "authentication failure") || strings.Contains(text, "authentication failed") || strings.Contains(text, "auth plain") || strings.Contains(text, "auth login")
}

func sendMailPlain(addr string, host string, username string, password string, from string, to []string, msg []byte) error {
	return sendMailWithAuthFallback(func() (*smtp.Client, error) {
		return newPlainSMTPClient(addr, host)
	}, host, username, password, from, to, msg)
}

func sendMailTLS(addr string, host string, username string, password string, from string, to []string, msg []byte) error {
	return sendMailWithAuthFallback(func() (*smtp.Client, error) {
		return newTLSSMTPClient(addr, host)
	}, host, username, password, from, to, msg)
}

func newPlainSMTPClient(addr string, host string) (*smtp.Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := client.Hello("localhost"); err != nil {
		_ = client.Close()
		return nil, err
	}
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			_ = client.Close()
			return nil, err
		}
	}
	return client, nil
}

func newTLSSMTPClient(addr string, host string) (*smtp.Client, error) {
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	if err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := client.Hello("localhost"); err != nil {
		_ = client.Close()
		return nil, err
	}
	return client, nil
}

func sendMailWithAuthFallback(newClient func() (*smtp.Client, error), host string, username string, password string, from string, to []string, msg []byte) error {
	methods := mailAuthMethods(username, password)
	authErrors := make([]string, 0, len(methods))
	for _, method := range methods {
		client, err := newClient()
		if err != nil {
			return err
		}
		err = sendMailWithClient(client, method.auth(host, username, password), method, username, password, from, to, msg)
		if err == nil {
			return nil
		}
		authErrors = append(authErrors, method.label()+": "+err.Error())
		if !isSMTPAuthError(err) {
			return err
		}
	}
	return fmt.Errorf("SMTP authentication failed after trying %s", strings.Join(authErrors, "; "))
}

type mailAuthMethod string

const (
	authCookieName                = "aivro_auth"
	mailAuthNone   mailAuthMethod = "none"
	mailAuthPlain  mailAuthMethod = "plain"
	mailAuthLogin  mailAuthMethod = "login"
)

func mailAuthMethods(username string, password string) []mailAuthMethod {
	if username == "" && password == "" {
		return []mailAuthMethod{mailAuthNone}
	}
	return []mailAuthMethod{mailAuthPlain, mailAuthLogin}
}

func (method mailAuthMethod) label() string {
	switch method {
	case mailAuthNone:
		return "NOAUTH"
	case mailAuthLogin:
		return "AUTH LOGIN"
	default:
		return "AUTH PLAIN"
	}
}

func (method mailAuthMethod) auth(host string, username string, password string) smtp.Auth {
	if method == mailAuthPlain {
		return smtp.PlainAuth("", username, password, host)
	}
	return nil
}

func isSMTPAuthError(err error) bool {
	var smtpErr *textproto.Error
	return errors.As(err, &smtpErr) && (smtpErr.Code == 235 || smtpErr.Code == 334 || smtpErr.Code == 454 || smtpErr.Code == 501 || smtpErr.Code == 503 || smtpErr.Code == 504 || smtpErr.Code == 530 || smtpErr.Code == 534 || smtpErr.Code == 535 || smtpErr.Code == 538 || smtpErr.Code == 526 || smtpErr.Code == 550)
}

func sendMailWithClient(client *smtp.Client, auth smtp.Auth, method mailAuthMethod, username string, password string, from string, to []string, msg []byte) error {
	defer client.Quit()
	if method == mailAuthLogin {
		if err := sendMailLoginAuth(client, username, password); err != nil {
			return err
		}
	} else if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}

func sendMailLoginAuth(client *smtp.Client, username string, password string) error {
	if _, _, err := smtpCommand(client, 334, "AUTH LOGIN"); err != nil {
		return err
	}
	if _, _, err := smtpCommand(client, 334, base64.StdEncoding.EncodeToString([]byte(username))); err != nil {
		return err
	}
	_, _, err := smtpCommand(client, 235, base64.StdEncoding.EncodeToString([]byte(password)))
	return err
}

func smtpCommand(client *smtp.Client, expectCode int, format string, args ...any) (int, string, error) {
	id, err := client.Text.Cmd(format, args...)
	if err != nil {
		return 0, "", err
	}
	client.Text.StartResponse(id)
	defer client.Text.EndResponse(id)
	code, msg, err := client.Text.ReadResponse(expectCode)
	return code, msg, err
}

func mimeHeader(value string) string {
	return mime.QEncoding.Encode("UTF-8", value)
}

func renderMailTemplate(template string, email string, code string, expireMinutes int, context MailTemplateContext) string {
	context = normalizeMailTemplateContext(context)
	replacer := strings.NewReplacer(
		"{{code}}", code,
		"{{email}}", email,
		"{{expireMinutes}}", strconv.Itoa(expireMinutes),
		"{{siteName}}", "Aivro",
		"{{ip}}", context.IP,
		"{{country}}", context.Country,
		"{{region}}", context.Region,
	)
	return replacer.Replace(template)
}

func MailTemplateContextFromRequest(r *http.Request) MailTemplateContext {
	return normalizeMailTemplateContext(MailTemplateContext{
		IP:      requestIP(r),
		Country: firstNonEmpty(r.Header.Get("CF-IPCountry"), r.Header.Get("X-Vercel-IP-Country"), r.Header.Get("CloudFront-Viewer-Country")),
		Region:  firstNonEmpty(r.Header.Get("CF-Region"), r.Header.Get("X-Vercel-IP-Country-Region"), r.Header.Get("X-Region")),
	})
}

func RequestLogMetaFromRequest(r *http.Request) RequestLogMeta {
	context := MailTemplateContextFromRequest(r)
	return normalizeRequestLogMeta(RequestLogMeta{IP: context.IP, Country: context.Country})
}

func normalizeRequestLogMeta(meta RequestLogMeta) RequestLogMeta {
	meta.IP = strings.TrimSpace(meta.IP)
	meta.Country = strings.TrimSpace(meta.Country)
	if meta.IP == "" {
		meta.IP = "未知"
	}
	if meta.Country == "" {
		meta.Country = "未知"
	}
	return meta
}

func normalizeMailTemplateContext(context MailTemplateContext) MailTemplateContext {
	if strings.TrimSpace(context.IP) == "" {
		context.IP = "未知"
	}
	if strings.TrimSpace(context.Country) == "" {
		context.Country = "未知"
	}
	if strings.TrimSpace(context.Region) == "" {
		context.Region = "未知"
	}
	return context
}

func requestIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		host = strings.TrimSpace(r.RemoteAddr)
	}
	if trustedForwardPeer(host) {
		for _, key := range []string{"CF-Connecting-IP", "True-Client-IP", "X-Client-IP", "X-Cluster-Client-IP", "X-Forwarded-For", "X-Real-IP", "Forwarded"} {
			if forwarded := forwardedIP(r.Header.Get(key)); forwarded != "" {
				return forwarded
			}
		}
	}
	return host
}

func trustedForwardPeer(host string) bool {
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}

func forwardedIP(value string) string {
	fallbackIP := ""
	for _, part := range strings.Split(value, ",") {
		if ipText := parseForwardedIPToken(part); ipText != "" {
			if fallbackIP == "" {
				fallbackIP = ipText
			}
			if isPublicIP(net.ParseIP(ipText)) {
				return ipText
			}
		}
	}
	return fallbackIP
}

func parseForwardedIPToken(value string) string {
	text := strings.TrimSpace(strings.Trim(value, `"`))
	if text == "" {
		return ""
	}
	lower := strings.ToLower(text)
	if strings.HasPrefix(lower, "for=") {
		text = strings.TrimSpace(text[4:])
	}
	if idx := strings.Index(text, ";"); idx >= 0 {
		text = text[:idx]
	}
	text = strings.TrimSpace(strings.Trim(text, `"`))
	if idx := strings.Index(text, ":"); idx >= 0 && strings.Count(text, ":") == 1 && !strings.Contains(text, "]") {
		text = text[:idx]
	}
	if host, _, err := net.SplitHostPort(text); err == nil {
		text = host
	}
	text = strings.Trim(text, "[]")
	if ip := net.ParseIP(text); ip != nil {
		return ip.String()
	}
	return ""
}

func creditLogCategory(logType model.CreditLogType) string {
	switch logType {
	case model.CreditLogTypeAdminAdjust:
		return "后台调整"
	case model.CreditLogTypeAIRefund:
		return "失败返还"
	case model.CreditLogTypeAIConsume:
		return "模型请求"
	default:
		return "其他"
	}
}

func auditLogCategory(action model.AuditLogAction, targetType string) string {
	switch action {
	case model.AuditLogActionUserRegister:
		return "用户注册"
	case model.AuditLogActionUserUpdate:
		return "用户资料"
	case model.AuditLogActionUserCredit, model.AuditLogActionUserWorkflow:
		return "用户额度"
	case model.AuditLogActionUserDelete:
		return "用户管理"
	case model.AuditLogActionConfigUpdate:
		return "系统配置"
	default:
		if strings.TrimSpace(targetType) != "" {
			return targetType
		}
		return "其他"
	}
}

func enrichCreditLogs(logs []model.CreditLog) {
	userIDs := make([]string, 0, len(logs))
	seen := map[string]struct{}{}
	for _, log := range logs {
		if log.UserID == "" {
			continue
		}
		if _, ok := seen[log.UserID]; ok {
			continue
		}
		seen[log.UserID] = struct{}{}
		userIDs = append(userIDs, log.UserID)
	}
	users, err := repository.ListUsersByIDs(userIDs)
	if err != nil {
		return
	}
	userMap := map[string]model.LogUser{}
	for _, user := range users {
		userMap[user.ID] = logUserFromModel(user)
	}
	for i := range logs {
		if user, ok := userMap[logs[i].UserID]; ok {
			logs[i].User = &user
		}
		if logs[i].Category == "" {
			logs[i].Category = creditLogCategory(logs[i].Type)
		}
	}
}

func enrichAuditLogs(logs []model.AuditLog) {
	userIDs := make([]string, 0, len(logs)*2)
	seen := map[string]struct{}{}
	for _, log := range logs {
		if log.ActorID != "" {
			if _, ok := seen[log.ActorID]; !ok {
				seen[log.ActorID] = struct{}{}
				userIDs = append(userIDs, log.ActorID)
			}
		}
		if log.TargetType == "user" && log.TargetID != "" {
			if _, ok := seen[log.TargetID]; !ok {
				seen[log.TargetID] = struct{}{}
				userIDs = append(userIDs, log.TargetID)
			}
		}
	}
	users, err := repository.ListUsersByIDs(userIDs)
	if err != nil {
		return
	}
	userMap := map[string]model.LogUser{}
	for _, user := range users {
		userMap[user.ID] = logUserFromModel(user)
	}
	for i := range logs {
		if user, ok := userMap[logs[i].ActorID]; ok {
			logs[i].Actor = &user
		}
		if logs[i].TargetType == "user" {
			if user, ok := userMap[logs[i].TargetID]; ok {
				logs[i].Target = &user
			}
		}
		if logs[i].Category == "" {
			logs[i].Category = auditLogCategory(logs[i].Action, logs[i].TargetType)
		}
	}
}

func logUserFromModel(user model.User) model.LogUser {
	return model.LogUser{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	}
}

type oauthStatePayload struct {
	Redirect string `json:"redirect"`
	Nonce    string `json:"nonce"`
}

func newOAuthState(w http.ResponseWriter, r *http.Request, provider string, redirect string) string {
	nonce := mustRandomToken(24)
	payload := oauthStatePayload{Redirect: SafeRedirectPath(redirect), Nonce: nonce}
	body, _ := json.Marshal(payload)
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie(provider),
		Value:    nonce,
		Path:     "/api/auth",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   requestSecure(r),
		SameSite: http.SameSiteLaxMode,
	})
	return base64.RawURLEncoding.EncodeToString(body)
}

func decodeState(r *http.Request, provider string, state string) (string, error) {
	data, err := base64.RawURLEncoding.DecodeString(state)
	if err != nil {
		return "/", safeMessageError{message: "第三方登录状态无效"}
	}
	payload := oauthStatePayload{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "/", safeMessageError{message: "第三方登录状态无效"}
	}
	cookie, err := r.Cookie(oauthStateCookie(provider))
	if err != nil || strings.TrimSpace(cookie.Value) == "" || cookie.Value != payload.Nonce {
		return SafeRedirectPath(payload.Redirect), safeMessageError{message: "第三方登录状态已过期，请重试"}
	}
	return SafeRedirectPath(payload.Redirect), nil
}

func ClearOAuthState(w http.ResponseWriter, r *http.Request, provider string) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie(provider),
		Value:    "",
		Path:     "/api/auth",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   requestSecure(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func oauthStateCookie(provider string) string {
	provider = strings.NewReplacer("/", "_", "\\", "_", ":", "_").Replace(strings.TrimSpace(provider))
	if provider == "" {
		provider = "oauth"
	}
	return "aivro_oauth_state_" + provider
}

func RequestOrigin(r *http.Request) string {
	if origin := normalizedConfiguredOrigin(); origin != "" {
		return origin
	}
	host := trustedForwardedValue(r, "X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	if !validRequestHost(host) || !allowedRequestHost(host) {
		return "http://localhost:3000"
	}
	if origin := configuredAllowedOrigin(host); origin != "" {
		return origin
	}
	proto := trustedForwardedValue(r, "X-Forwarded-Proto")
	if proto == "" && trustedForwardHeader(r) && strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Ssl")), "on") {
		proto = "https"
	}
	if proto == "" && trustedForwardHeader(r) && strings.Contains(strings.ToLower(r.Header.Get("CF-Visitor")), `"scheme":"https"`) {
		proto = "https"
	}
	if proto == "" && r.TLS != nil {
		proto = "https"
	}
	if proto == "" {
		proto = "http"
	}
	return proto + "://" + host
}

func normalizedConfiguredOrigin() string {
	raw := strings.TrimRight(strings.TrimSpace(firstNonEmpty(RuntimeSetting().AppOrigin, config.Cfg.AppOrigin)), "/")
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func configuredAllowedOrigin(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	for _, item := range strings.Split(configuredAllowedOrigins(), ",") {
		origin := strings.TrimRight(strings.TrimSpace(item), "/")
		if origin == "" {
			continue
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			continue
		}
		if strings.EqualFold(host, parsed.Host) {
			return parsed.Scheme + "://" + parsed.Host
		}
	}
	return ""
}

func allowedRequestHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	hostname := requestHostname(host)
	if localRequestHostname(hostname) {
		return true
	}
	if strings.TrimSpace(configuredAllowedOrigins()) == "" {
		return false
	}
	for _, item := range strings.Split(configuredAllowedOrigins(), ",") {
		origin := strings.TrimRight(strings.TrimSpace(item), "/")
		if origin == "" {
			continue
		}
		if parsed, err := url.Parse(origin); err == nil && parsed.Host != "" {
			if strings.EqualFold(host, parsed.Host) {
				return true
			}
			continue
		}
		originHost := strings.ToLower(origin)
		if strings.EqualFold(host, originHost) || (!strings.Contains(host, ":") && strings.EqualFold(hostname, originHost)) {
			return true
		}
	}
	return false
}

func configuredAllowedOrigins() string {
	return firstNonEmpty(RuntimeSetting().AllowedOrigins, config.Cfg.AllowedOrigins)
}

func requestHostname(host string) string {
	host = strings.TrimSpace(host)
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		return strings.Trim(parsedHost, "[]")
	}
	return strings.Trim(host, "[]")
}

func localRequestHostname(hostname string) bool {
	hostname = strings.ToLower(strings.Trim(hostname, "[]"))
	return hostname == "localhost" || hostname == "127.0.0.1" || hostname == "::1"
}

func validRequestHost(host string) bool {
	host = strings.TrimSpace(host)
	return host != "" && !strings.Contains(host, "@") && !strings.ContainsAny(host, `/\`)
}

func firstForwardedValue(value string) string {
	parts := strings.Split(value, ",")
	if len(parts) == 0 {
		return ""
	}
	return strings.TrimSpace(parts[0])
}

func trustedForwardedValue(r *http.Request, key string) string {
	if !trustedForwardHeader(r) {
		return ""
	}
	return firstForwardedValue(r.Header.Get(key))
}

func trustedForwardHeader(r *http.Request) bool {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		host = strings.TrimSpace(r.RemoteAddr)
	}
	return trustedForwardPeer(host)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func WarnDefaultSecurityConfig() {
	if config.Cfg.AdminUsername == "admin" && config.Cfg.AdminPassword == "aivro" {
		log.Println("WARNING: using default admin credentials, please set ADMIN_USERNAME and ADMIN_PASSWORD to safer values before deployment")
	}
}

func isDefaultAdminCredential(username string, password string) bool {
	return strings.TrimSpace(username) == "admin" && strings.TrimSpace(password) == "aivro"
}
