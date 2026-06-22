package service

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const hCaptchaVerifyURL = "https://api.hcaptcha.com/siteverify"

type captchaVerifyResponse struct {
	Success bool `json:"success"`
}

type webhookSignatureError struct {
	message string
}

func (err webhookSignatureError) Error() string {
	return err.message
}

func (err webhookSignatureError) SafeMessage() string {
	return err.message
}

func IsWebhookSignatureError(err error) bool {
	var signatureErr *webhookSignatureError
	return errors.As(err, &signatureErr)
}

func publicHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 2 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return http.ErrUseLastResponse
			}
			if !IsPublicHTTPURL(req.URL.String()) {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

func VerifyCaptcha(r *http.Request, token string) error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	captcha := normalizeCaptchaSetting(settings.Private.Captcha, settings.Private.Turnstile)
	provider := captchaProviderSetting(captcha)
	if !captcha.Enabled || provider.SiteKey == "" || provider.SecretKey == "" {
		return nil
	}
	if strings.TrimSpace(token) == "" {
		return safeMessageError{message: "请先完成人机验证"}
	}
	values := url.Values{}
	values.Set("secret", provider.SecretKey)
	values.Set("response", strings.TrimSpace(token))
	if ip := requestIP(r); ip != "" && ip != "未知" {
		values.Set("remoteip", ip)
	}
	resp, err := http.PostForm(captchaVerifyURL(captcha.Provider), values)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	payload := captchaVerifyResponse{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}
	if !payload.Success {
		return safeMessageError{message: "人机验证失败，请重试"}
	}
	return nil
}

func captchaVerifyURL(provider model.CaptchaProvider) string {
	if provider == model.CaptchaProviderHCaptcha {
		return hCaptchaVerifyURL
	}
	return turnstileVerifyURL
}

func SafeRedirectPath(redirect string) string {
	redirect = strings.TrimSpace(redirect)
	if redirect == "" || !strings.HasPrefix(redirect, "/") || strings.HasPrefix(redirect, "//") || strings.HasPrefix(redirect, `/\`) || strings.Contains(redirect, `\`) {
		return "/"
	}
	return redirect
}

func IsPublicHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
		return false
	}
	ips, err := net.LookupIP(parsed.Hostname())
	if err != nil || len(ips) == 0 {
		return false
	}
	for _, ip := range ips {
		if !isPublicIP(ip) {
			return false
		}
	}
	return true
}

func isPublicIP(ip net.IP) bool {
	if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		return ip4[0] != 0 && ip4[0] != 127 && ip4[0] < 224
	}
	return true
}
