package service

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func normalizedRateAccount(account string) (string, error) {
	account = strings.TrimSpace(account)
	user, ok, err := repository.GetUserByUsername(account)
	if err == nil && !ok && strings.Contains(account, "@") { user, ok, err = repository.GetUserByEmail(strings.ToLower(account)) }
	if ok { return user.ID, err }
	return strings.ToLower(account), err
}

func CheckAuthRateLimit(r *http.Request, action string, account string) error {
	// Missing trusted client IP must never collapse visitors into one shared bucket.
	if ip := requestIP(r); ip != "" {
		if err := hitRateBucket("ip:"+action+":"+ip, 20, time.Minute, 2*time.Minute); err != nil { return err }
	}
	account, err := normalizedRateAccount(account)
	if err != nil { return err }
	if account == "" { return safeMessageError{message: "请输入账号"} }
	return hitRateBucket("acct:"+action+":"+account, 8, 5*time.Minute, 10*time.Minute)
}

func adminRateKey(r *http.Request, account string) string {
	key, _ := normalizedRateAccount(account)
	return "admin-fail:"+requestIP(r)+":"+key
}

func CheckAdminLoginBlocked(r *http.Request, account string) error {
	blocked := false
	err := repository.MutateRateBucket(rateKey(adminRateKey(r, account)), func(bucket *model.RateLimitBucket) { blocked = time.Now().Before(bucket.BlockedAt) })
	if err != nil { return err }
	if blocked { return safeMessageError{message: "登录失败次数过多，请稍后再试"} }
	return nil
}

func RecordAdminLoginFailure(r *http.Request, account string) {
	// The fifth failed attempt blocks subsequent logins.
	_ = hitRateBucket(adminRateKey(r, account), 4, 10*time.Minute, 15*time.Minute)
}

func RecordAdminLoginSuccess(r *http.Request, account string) {
	_ = repository.MutateRateBucket(rateKey(adminRateKey(r, account)), func(bucket *model.RateLimitBucket) { bucket.Count = 0; bucket.ResetAt = time.Now(); bucket.BlockedAt = time.Now() })
}

func rateKey(key string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(key))) }

func hitRateBucket(key string, limit int, window time.Duration, blockFor time.Duration) error {
	blocked := false
	err := repository.MutateRateBucket(rateKey(key), func(bucket *model.RateLimitBucket) {
		current := time.Now()
		if current.Before(bucket.BlockedAt) { blocked = true; return }
		if !current.Before(bucket.ResetAt) { bucket.Count = 0; bucket.ResetAt = current.Add(window) }
		bucket.Count++
		if bucket.Count > limit { bucket.BlockedAt = current.Add(blockFor); blocked = true }
	})
	if err != nil { return err }
	if blocked { return safeMessageError{message: "请求太频繁，请稍后再试"} }
	return nil
}
