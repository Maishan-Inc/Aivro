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
	Username string `json:"username"`
	Password string `json:"password"`
}

type registerRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
	Code     string `json:"code"`
}

type emailCodeRequest struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
}

type resetPasswordRequest struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
}

type metamaskLoginRequest struct {
	WalletAddress string `json:"walletAddress"`
	Message       string `json:"message"`
	Signature     string `json:"signature"`
	Email         string `json:"email"`
	Code          string `json:"code"`
}

type saveUserRequest struct {
	ID              string           `json:"id"`
	Username        string           `json:"username"`
	Password        string           `json:"password"`
	Email           string           `json:"email"`
	DisplayName     string           `json:"displayName"`
	GithubID        string           `json:"githubId"`
	GoogleID        string           `json:"googleId"`
	LinuxDoID       string           `json:"linuxDoId"`
	MetaMaskAddress string           `json:"metamaskAddress"`
	AuthProvider    string           `json:"authProvider"`
	EmailVerified   bool             `json:"emailVerified"`
	Role            model.UserRole   `json:"role"`
	Status          model.UserStatus `json:"status"`
}

type adjustUserCreditsRequest struct {
	Credits int `json:"credits"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	var request registerRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	session, err := service.Register(request.Username, request.Password, request.Email, request.Code)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, session)
}

func SendEmailCode(w http.ResponseWriter, r *http.Request) {
	var request emailCodeRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.SendEmailCode(request.Email, request.Purpose); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var request resetPasswordRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := service.ResetPassword(request.Email, request.Code, request.Password); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func MetaMaskLogin(w http.ResponseWriter, r *http.Request) {
	var request metamaskLoginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	session, err := service.LoginWithMetaMask(request.WalletAddress, request.Message, request.Signature, request.Email, request.Code)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, session)
}

func Login(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	session, err := service.Login(request.Username, request.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, session)
}

func LinuxDoAuthorize(w http.ResponseWriter, r *http.Request) {
	authURL, err := service.LinuxDoAuthorizeURL(r, r.URL.Query().Get("redirect"))
	if err != nil {
		FailError(w, err)
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

func OAuthAuthorize(w http.ResponseWriter, r *http.Request, provider string) {
	authURL, err := service.OAuthAuthorizeURL(r, provider, r.URL.Query().Get("redirect"))
	if err != nil {
		FailError(w, err)
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

func OAuthCallback(w http.ResponseWriter, r *http.Request, provider string) {
	session, redirect, err := service.LoginWithOAuth(r, provider, r.URL.Query().Get("code"), r.URL.Query().Get("state"))
	if err != nil {
		http.Redirect(w, r, loginRedirect(r, redirect, "", err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, loginRedirect(r, redirect, session.Token, ""), http.StatusFound)
}

func LinuxDoCallback(w http.ResponseWriter, r *http.Request) {
	session, redirect, err := service.LoginWithLinuxDo(r, r.URL.Query().Get("code"), r.URL.Query().Get("state"))
	if err != nil {
		http.Redirect(w, r, loginRedirect(r, redirect, "", err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, loginRedirect(r, redirect, session.Token, ""), http.StatusFound)
}

func AdminLogin(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	session, err := service.Login(request.Username, request.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	if session.User.Role != model.UserRoleAdmin {
		Fail(w, "需要管理员权限")
		return
	}
	OK(w, session)
}

func CurrentUser(w http.ResponseWriter, r *http.Request) {
	if user, ok := service.UserFromContext(r.Context()); ok {
		OK(w, user)
		return
	}
	OK(w, service.GuestUser())
}

func AdminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := service.ListUsers(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, users)
}

func AdminSaveUser(w http.ResponseWriter, r *http.Request) {
	var request saveUserRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	user, err := service.SaveUser(model.User{
		ID:              request.ID,
		Username:        request.Username,
		Email:           request.Email,
		DisplayName:     request.DisplayName,
		GithubID:        request.GithubID,
		GoogleID:        request.GoogleID,
		LinuxDoID:       request.LinuxDoID,
		MetaMaskAddress: request.MetaMaskAddress,
		AuthProvider:    request.AuthProvider,
		EmailVerified:   request.EmailVerified,
		Role:            request.Role,
		Status:          request.Status,
	}, request.Password)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, user)
}

func AdminAdjustUserCredits(w http.ResponseWriter, r *http.Request, id string) {
	var request adjustUserCreditsRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	user, err := service.AdjustUserCredits(id, request.Credits)
	if err != nil {
		FailError(w, err)
		return
	}
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

func loginRedirect(r *http.Request, redirect string, token string, message string) string {
	values := url.Values{}
	if strings.TrimSpace(token) != "" {
		values.Set("token", token)
	}
	if strings.TrimSpace(message) != "" {
		values.Set("error", message)
	}
	if strings.TrimSpace(redirect) != "" {
		values.Set("redirect", redirect)
	}
	return service.RequestOrigin(r) + "/login?" + values.Encode()
}

func AdminDeleteUser(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteUser(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
