package model

type StorageReservation struct {
	ID        string `gorm:"primaryKey"`
	UserID    string `gorm:"index"`
	Size      int64
	ExpiresAt int64 `gorm:"index"`
}

// UserAsset records ownership of a local library entry; its content remains local.
type UserAsset struct {
	ID        string `gorm:"primaryKey"`
	UserID    string `gorm:"index"`
	CreatedAt string
}
