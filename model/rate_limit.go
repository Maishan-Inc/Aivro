package model

import "time"

type RateLimitBucket struct {
	BucketKey string `gorm:"primaryKey;size:64"`
	Count     int
	ResetAt   time.Time `gorm:"index"`
	BlockedAt time.Time `gorm:"index"`
}
