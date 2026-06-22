package service

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateBucket struct {
	count     int
	resetAt   time.Time
	blockedAt time.Time
}

var (
	loginRateMu      sync.Mutex
	loginRateBuckets = map[string]rateBucket{}
)

func CheckAuthRateLimit(r *http.Request, action string, account string) error {
	ip := requestIP(r)
	account = strings.ToLower(strings.TrimSpace(account))
	limits := []struct {
		key      string
		limit    int
		window   time.Duration
		blockFor time.Duration
	}{
		{key: "ip:" + action + ":" + ip, limit: 20, window: time.Minute, blockFor: 2 * time.Minute},
	}
	if account != "" {
		limits = append(limits, struct {
			key      string
			limit    int
			window   time.Duration
			blockFor time.Duration
		}{key: "acct:" + action + ":" + account, limit: 8, window: 5 * time.Minute, blockFor: 10 * time.Minute})
	}
	for _, item := range limits {
		if err := hitRateBucket(item.key, item.limit, item.window, item.blockFor); err != nil {
			return err
		}
	}
	return nil
}

func CheckAdminLoginBlocked(r *http.Request, account string) error {
	return checkRateBlocked("admin-fail:" + requestIP(r) + ":" + strings.ToLower(strings.TrimSpace(account)))
}

func RecordAdminLoginFailure(r *http.Request, account string) {
	_ = hitRateBucket("admin-fail:"+requestIP(r)+":"+strings.ToLower(strings.TrimSpace(account)), 5, 10*time.Minute, 15*time.Minute)
}

func RecordAdminLoginSuccess(r *http.Request, account string) {
	clearRateBucket("admin-fail:" + requestIP(r) + ":" + strings.ToLower(strings.TrimSpace(account)))
}

func hitRateBucket(key string, limit int, window time.Duration, blockFor time.Duration) error {
	loginRateMu.Lock()
	defer loginRateMu.Unlock()
	now := time.Now()
	bucket := loginRateBuckets[key]
	if !bucket.blockedAt.IsZero() && now.Before(bucket.blockedAt) {
		return safeMessageError{message: "请求太频繁，请稍后再试"}
	}
	if bucket.resetAt.IsZero() || now.After(bucket.resetAt) {
		bucket = rateBucket{resetAt: now.Add(window)}
	}
	bucket.count++
	if bucket.count > limit {
		bucket.blockedAt = now.Add(blockFor)
		loginRateBuckets[key] = bucket
		return safeMessageError{message: "请求太频繁，请稍后再试"}
	}
	loginRateBuckets[key] = bucket
	return nil
}

func checkRateBlocked(key string) error {
	loginRateMu.Lock()
	defer loginRateMu.Unlock()
	bucket := loginRateBuckets[key]
	if !bucket.blockedAt.IsZero() && time.Now().Before(bucket.blockedAt) {
		return safeMessageError{message: "登录失败次数过多，请稍后再试"}
	}
	return nil
}

func clearRateBucket(key string) {
	loginRateMu.Lock()
	defer loginRateMu.Unlock()
	delete(loginRateBuckets, key)
}
