package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

type loginRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	CaptchaToken   string `json:"captchaToken"`
	TurnstileToken string `json:"turnstileToken"`
}

type registerRequest struct {
	Username       string                `json:"username"`
	Password       string                `json:"password"`
	Email          string                `json:"email"`
	Code           string                `json:"code"`
	AccountType    model.UserAccountType `json:"accountType"`
	DisplayName    string                `json:"displayName"`
	CaptchaToken   string                `json:"captchaToken"`
	TurnstileToken string                `json:"turnstileToken"`
}

type emailCodeRequest struct {
	Email          string `json:"email"`
	Purpose        string `json:"purpose"`
	CaptchaToken   string `json:"captchaToken"`
	TurnstileToken string `json:"turnstileToken"`
}

type resetPasswordRequest struct {
	Email          string `json:"email"`
	Code           string `json:"code"`
	Password       string `json:"password"`
	CaptchaToken   string `json:"captchaToken"`
	TurnstileToken string `json:"turnstileToken"`
}

type metamaskLoginRequest struct {
	WalletAddress  string `json:"walletAddress"`
	Message        string `json:"message"`
	Signature      string `json:"signature"`
	Email          string `json:"email"`
	Code           string `json:"code"`
	CaptchaToken   string `json:"captchaToken"`
	TurnstileToken string `json:"turnstileToken"`
}

type metamaskChallengeRequest struct {
	WalletAddress string `json:"walletAddress"`
}

type registerCheckRequest struct {
	Email string `json:"email"`
}

type completeProfileRequest struct {
	Username    string                `json:"username"`
	AccountType model.UserAccountType `json:"accountType"`
	DisplayName string                `json:"displayName"`
	AvatarURL   string                `json:"avatarUrl"`
}

type saveUserRequest struct {
	ID               string                `json:"id"`
	Username         string                `json:"username"`
	Password         string                `json:"password"`
	Email            string                `json:"email"`
	DisplayName      string                `json:"displayName"`
	AccountType      model.UserAccountType `json:"accountType"`
	ProfileCompleted bool                  `json:"profileCompleted"`
	GithubID         string                `json:"githubId"`
	GoogleID         string                `json:"googleId"`
	LinuxDoID        string                `json:"linuxDoId"`
	MetaMaskAddress  string                `json:"metamaskAddress"`
	AuthProvider     string                `json:"authProvider"`
	EmailVerified    bool                  `json:"emailVerified"`
	Role             model.UserRole        `json:"role"`
	Status           model.UserStatus      `json:"status"`
}

type adjustUserCreditsRequest struct {
	Credits int `json:"credits"`
}

type adjustUserWorkflowCreateCreditsRequest struct {
	WorkflowCreateCredits int `json:"workflowCreateCredits"`
}

func requestCaptchaToken(captchaToken string, turnstileToken string) string {
	if strings.TrimSpace(captchaToken) != "" {
		return captchaToken
	}
	return turnstileToken
}

func Register(w http.ResponseWriter, r *http.Request) {
	var request registerRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	session, err := service.Register(request.Username, request.Password, request.Email, request.Code, service.RegisterProfileInput{AccountType: request.AccountType, Name: request.DisplayName})
	if err != nil {
		FailError(w, err)
		return
	}
	_ = service.SaveAuditLog(model.AuditLog{
		Action:        model.AuditLogActionUserRegister,
		ActorID:       session.User.ID,
		ActorUsername: session.User.Username,
		TargetType:    "user",
		TargetID:      session.User.ID,
		Remark:        "用户注册",
		IP:            service.RequestLogMetaFromRequest(r).IP,
		Country:       service.RequestLogMetaFromRequest(r).Country,
	})
	service.SetAuthCookie(w, r, session.Token)
	OK(w, session)
}

func CheckRegisterEmail(w http.ResponseWriter, r *http.Request) {
	var request registerCheckRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.RegisterEmailAvailable(request.Email); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func SendEmailCode(w http.ResponseWriter, r *http.Request) {
	var request emailCodeRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "email-code", request.Email); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	if err := service.SendEmailCode(request.Email, request.Purpose, service.MailTemplateContextFromRequest(r)); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func SendRegisterEmailCode(w http.ResponseWriter, r *http.Request) {
	var request emailCodeRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "register-code", request.Email); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	if err := service.RegisterEmailAvailable(request.Email); err != nil {
		FailError(w, err)
		return
	}
	if err := service.SendEmailCode(request.Email, "register", service.MailTemplateContextFromRequest(r)); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var request resetPasswordRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "reset-password", request.Email); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	if err := service.ResetPassword(request.Email, request.Code, request.Password); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func MetaMaskChallenge(w http.ResponseWriter, r *http.Request) {
	var request metamaskChallengeRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "metamask-challenge", request.WalletAddress); err != nil {
		FailError(w, err)
		return
	}
	result, err := service.CreateMetaMaskChallenge(request.WalletAddress)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func MetaMaskLogin(w http.ResponseWriter, r *http.Request) {
	var request metamaskLoginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "metamask-login", request.WalletAddress); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	session, err := service.LoginWithMetaMask(request.WalletAddress, request.Message, request.Signature, request.Email, request.Code)
	if err != nil {
		FailError(w, err)
		return
	}
	service.SetAuthCookie(w, r, session.Token)
	OK(w, session)
}

func Login(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "login", request.Username); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	session, err := service.Login(request.Username, request.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	service.SetAuthCookie(w, r, session.Token)
	OK(w, session)
}

func LinuxDoAuthorize(w http.ResponseWriter, r *http.Request) {
	authURL, err := service.LinuxDoAuthorizeURL(w, r, r.URL.Query().Get("redirect"))
	if err != nil {
		FailError(w, err)
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

func OAuthAuthorize(w http.ResponseWriter, r *http.Request, provider string) {
	authURL, err := service.OAuthAuthorizeURL(w, r, provider, r.URL.Query().Get("redirect"))
	if err != nil {
		FailError(w, err)
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

func OAuthCallback(w http.ResponseWriter, r *http.Request, provider string) {
	session, redirect, err := service.LoginWithOAuth(r, provider, r.URL.Query().Get("code"), r.URL.Query().Get("state"))
	service.ClearOAuthState(w, r, provider)
	if err != nil {
		http.Redirect(w, r, loginRedirect(r, redirect, err.Error()), http.StatusFound)
		return
	}
	service.SetAuthCookie(w, r, session.Token)
	http.Redirect(w, r, cleanRedirectURL(r, redirect), http.StatusFound)
}

func LinuxDoCallback(w http.ResponseWriter, r *http.Request) {
	session, redirect, err := service.LoginWithLinuxDo(r, r.URL.Query().Get("code"), r.URL.Query().Get("state"))
	service.ClearOAuthState(w, r, "linux-do")
	if err != nil {
		http.Redirect(w, r, loginRedirect(r, redirect, err.Error()), http.StatusFound)
		return
	}
	service.SetAuthCookie(w, r, session.Token)
	http.Redirect(w, r, cleanRedirectURL(r, redirect), http.StatusFound)
}

func AdminLogin(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.CheckAuthRateLimit(r, "admin-login", request.Username); err != nil {
		FailError(w, err)
		return
	}
	if err := service.CheckAdminLoginBlocked(r, request.Username); err != nil {
		FailError(w, err)
		return
	}
	if err := service.VerifyCaptcha(r, requestCaptchaToken(request.CaptchaToken, request.TurnstileToken)); err != nil {
		FailError(w, err)
		return
	}
	session, err := service.Login(request.Username, request.Password)
	if err != nil {
		service.RecordAdminLoginFailure(r, request.Username)
		FailError(w, err)
		return
	}
	if session.User.Role != model.UserRoleAdmin {
		service.RecordAdminLoginFailure(r, request.Username)
		Fail(w, "需要管理员权限")
		return
	}
	service.RecordAdminLoginSuccess(r, request.Username)
	service.SetAuthCookie(w, r, session.Token)
	OK(w, session)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	service.ClearAuthCookie(w, r)
	OK(w, true)
}

func CurrentUser(w http.ResponseWriter, r *http.Request) {
	if user, ok := service.UserFromContext(r.Context()); ok {
		OK(w, user)
		return
	}
	OK(w, service.GuestUser())
}

func CompleteProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request completeProfileRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	result, err := service.CompleteUserProfile(user, request.Username, request.AccountType, request.DisplayName, request.AvatarURL)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := service.ListUsers(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, users)
}

func AdminAuthProviderStats(w http.ResponseWriter, r *http.Request) {
	counts, err := service.CountAuthProviderUsers()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, counts)
}

func AdminSaveUser(w http.ResponseWriter, r *http.Request) {
	var request saveUserRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	user, err := service.SaveUser(model.User{
		ID:               request.ID,
		Username:         request.Username,
		Email:            request.Email,
		DisplayName:      request.DisplayName,
		AccountType:      request.AccountType,
		ProfileCompleted: request.ProfileCompleted,
		GithubID:         request.GithubID,
		GoogleID:         request.GoogleID,
		LinuxDoID:        request.LinuxDoID,
		MetaMaskAddress:  request.MetaMaskAddress,
		AuthProvider:     request.AuthProvider,
		EmailVerified:    request.EmailVerified,
		Role:             request.Role,
		Status:           request.Status,
	}, request.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	admin, _ := service.UserFromContext(r.Context())
	meta := service.RequestLogMetaFromRequest(r)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionAdminModify, ActorID: admin.ID, ActorUsername: admin.Username, TargetType: "user", TargetID: user.ID, Remark: "管理员保存用户", IP: meta.IP, Country: meta.Country})
	OK(w, user)
}

func AdminAdjustUserCredits(w http.ResponseWriter, r *http.Request, id string) {
	var request adjustUserCreditsRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	admin, _ := service.UserFromContext(r.Context())
	user, err := service.AdjustUserCredits(id, request.Credits, admin)
	if err != nil {
		FailError(w, err)
		return
	}
	meta := service.RequestLogMetaFromRequest(r)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionAdminModify, ActorID: admin.ID, ActorUsername: admin.Username, TargetType: "user", TargetID: user.ID, Remark: "管理员调整算力点", IP: meta.IP, Country: meta.Country})
	OK(w, user)
}

func AdminAdjustUserWorkflowCreateCredits(w http.ResponseWriter, r *http.Request, id string) {
	var request adjustUserWorkflowCreateCreditsRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	user, err := service.AdjustUserWorkflowCreateCredits(id, request.WorkflowCreateCredits)
	if err != nil {
		FailError(w, err)
		return
	}
	admin, _ := service.UserFromContext(r.Context())
	meta := service.RequestLogMetaFromRequest(r)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionAdminModify, ActorID: admin.ID, ActorUsername: admin.Username, TargetType: "user", TargetID: user.ID, Remark: "管理员调整工作流创建次数", IP: meta.IP, Country: meta.Country})
	OK(w, user)
}

func AdminCreditLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := service.ListCreditLogs(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, logs)
}

func AdminAuditLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := service.ListAuditLogs(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, logs)
}

func AdminSaveCreditLog(w http.ResponseWriter, r *http.Request) {
	var log model.CreditLog
	_ = json.NewDecoder(r.Body).Decode(&log)
	result, err := service.SaveCreditLog(log)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteCreditLog(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteCreditLog(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func loginRedirect(r *http.Request, redirect string, message string) string {
	values := url.Values{}
	if strings.TrimSpace(message) != "" {
		values.Set("error", message)
	}
	if strings.TrimSpace(redirect) != "" {
		values.Set("redirect", redirect)
	}
	return service.RequestOrigin(r) + localizedLoginPath(redirect) + "?" + values.Encode()
}

func cleanRedirectURL(r *http.Request, redirect string) string {
	return service.RequestOrigin(r) + service.SafeRedirectPath(redirect)
}

func localizedLoginPath(redirect string) string {
	path := strings.TrimSpace(redirect)
	if strings.HasPrefix(path, "/en-US/") || path == "/en-US" {
		return "/en-US/login"
	}
	return "/zh-CN/login"
}

func AdminDeleteUser(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteUser(id); err != nil {
		FailError(w, err)
		return
	}
	admin, _ := service.UserFromContext(r.Context())
	meta := service.RequestLogMetaFromRequest(r)
	_ = service.SaveAuditLog(model.AuditLog{Action: model.AuditLogActionAdminModify, ActorID: admin.ID, ActorUsername: admin.Username, TargetType: "user", TargetID: id, Remark: "管理员删除用户", IP: meta.IP, Country: meta.Country})
	OK(w, true)
}
