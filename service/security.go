package service

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/netip"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const hCaptchaVerifyURL = "https://api.hcaptcha.com/siteverify"

func CheckRequestOrigin(r *http.Request) error {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions || strings.HasPrefix(r.URL.Path, "/api/webhooks/") { return nil }
	origin := r.Header.Get("Origin")
	if origin == "" && r.Header.Get("Referer") != "" {
		parsed, err := url.Parse(r.Header.Get("Referer"))
		if err == nil { origin = parsed.Scheme+"://"+parsed.Host }
	}
	if origin == "" && len(r.Cookies()) == 0 { return nil }
	if origin == RequestOrigin(r) { return nil }
	for _, allowed := range strings.Split(configuredAllowedOrigins(), ",") {
		if origin != "" && origin == strings.TrimRight(strings.TrimSpace(allowed), "/") { return nil }
	}
	return errors.New("请求来源无效")
}

func CaptchaSessionFromRequest(r *http.Request) map[string]string {
	meta := RequestLogMetaFromRequest(r)
	return map[string]string{"sessionId": newID("verify"), "clientIP": meta.IP, "country": meta.Country}
}

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

func publicHTTPClient() *http.Client { return publicClient }

var publicClient = newPublicHTTPClient()

func newPublicHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil || len(ips) == 0 {
			return nil, errors.New("无法解析远程地址")
		}
		for _, ip := range ips {
			if !isPublicIP(ip.IP) {
				return nil, errors.New("远程地址不安全")
			}
		}
		return (&net.Dialer{Timeout: 15 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	}
	return &http.Client{
		Transport: transport,
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

const AIRequestTimeout = 5 * time.Minute

var AIHTTPClient = func() *http.Client {
	client := newPublicHTTPClient()
	client.Timeout = AIRequestTimeout
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return client
}()

func VerifyCaptcha(r *http.Request, token string) error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	captcha := normalizeCaptchaSetting(settings.Private.Captcha, settings.Private.Turnstile)
	provider := captchaProviderSetting(captcha)
	if !captcha.Enabled {
		return nil
	}
	if provider.SiteKey == "" || provider.SecretKey == "" {
		return safeMessageError{message: "人机验证配置不完整，请联系管理员"}
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
	resp, err := publicHTTPClient().PostForm(captchaVerifyURL(captcha.Provider), values)
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

var redirectPagePattern = regexp.MustCompile(`^/(assets|asset-library|image|video|model-3d|prompts|models|developers|pricing(/success)?|terms|privacy|login|forgot-password|metamask-email|profile/setup|canvas(/[A-Za-z0-9_-]+|/community/[A-Za-z0-9_-]+)?|share/workflows/[A-Za-z0-9_-]+|console(/(workflows|wallet|shares|profile|community|api-keys))?|admin(/(database|workflow-community|settings|credit-logs|users|ads|request-logs|prompts|audit-logs|assets|plans))?)$`)
var redirectSharePattern = regexp.MustCompile(`^/[a-z0-9]{3,24}/[a-z0-9]{1,40}$`)

func SafeRedirectPath(redirect string) string {
	decoded, err := url.PathUnescape(redirect)
	if err != nil || strings.Contains(decoded, "\\") || strings.IndexFunc(decoded, func(r rune) bool { return r < 32 || r == 127 }) >= 0 || !strings.HasPrefix(redirect, "/") || strings.HasPrefix(decoded, "//") { return "/" }
	parsed, err := url.Parse(redirect)
	if err != nil || parsed.Host != "" || strings.Contains(parsed.Path, "%") { return "/" }
	parsed.Path = path.Clean(parsed.Path)
	parsed.RawPath = ""
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	switch parts[0] { case "zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR", "fr-FR": parts = parts[1:] }
	page := "/"+strings.Join(parts, "/")
	if len(parts) > 0 { switch parts[0] { case "api", "_next", "icons": return "/" } }
	if page != "/" && !redirectPagePattern.MatchString(page) && !redirectSharePattern.MatchString(page) { return "/" }
	return parsed.String()
}

func IsPublicHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" || parsed.User != nil {
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
	address, ok := netip.AddrFromSlice(ip)
	if !ok || !ip.IsGlobalUnicast() { return false }
	for _, prefix := range reservedPublicRanges { if prefix.Contains(address.Unmap()) { return false } }
	return true
}

var reservedPublicRanges = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"), netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"), netip.MustParsePrefix("192.0.2.0/24"), netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"), netip.MustParsePrefix("203.0.113.0/24"), netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::/96"), netip.MustParsePrefix("64:ff9b::/96"), netip.MustParsePrefix("64:ff9b:1::/48"),
	netip.MustParsePrefix("100::/64"), netip.MustParsePrefix("2001::/23"), netip.MustParsePrefix("2001:db8::/32"), netip.MustParsePrefix("2002::/16"),
}
