package repository

import (
	"errors"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

// ListUsers 分页查询用户。
func ListUsers(q model.Query) ([]model.User, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.User{})
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("username LIKE ? OR display_name LIKE ? OR email LIKE ? OR linux_do_id LIKE ? OR github_id LIKE ? OR google_id LIKE ? OR metamask_address LIKE ?", like, like, like, like, like, like, like)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []model.User
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&users).Error
	return users, total, err
}

// CountUsers 返回用户总数。
func CountUsers() (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var total int64
	return total, db.Model(&model.User{}).Count(&total).Error
}

func CountAuthProviderUsers() (map[string]int64, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	counts := map[string]int64{}
	countProvider := func(key string, query string, args ...any) error {
		var total int64
		if err := db.Model(&model.User{}).Where(query, args...).Count(&total).Error; err != nil {
			return err
		}
		counts[key] = total
		return nil
	}
	if err := countProvider("linux-do", "linux_do_id <> '' OR auth_provider = ?", "linux-do"); err != nil {
		return nil, err
	}
	if err := countProvider("google", "google_id <> '' OR auth_provider = ?", "google"); err != nil {
		return nil, err
	}
	if err := countProvider("github", "github_id <> '' OR auth_provider = ?", "github"); err != nil {
		return nil, err
	}
	if err := countProvider("metamask", "metamask_address <> '' OR auth_provider = ?", "metamask"); err != nil {
		return nil, err
	}
	rows, err := db.Model(&model.User{}).Select("auth_provider, count(*) as total").Where("auth_provider <> ''").Group("auth_provider").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var provider string
		var total int64
		if err := rows.Scan(&provider, &total); err != nil {
			return nil, err
		}
		if provider != "" {
			counts[provider] = total
		}
	}
	return counts, rows.Err()
}

// HasAdmin 判断系统中是否存在管理员。
func HasAdmin() (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	var total int64
	err = db.Model(&model.User{}).Where("role = ?", model.UserRoleAdmin).Count(&total).Error
	return total > 0, err
}

// GetUserByID 根据 ID 查询用户。
func GetUserByID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "id = ?", id)
}

// ListUsersByIDs 根据 ID 批量查询用户。
func ListUsersByIDs(ids []string) ([]model.User, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []model.User{}, nil
	}
	var users []model.User
	return users, db.Where("id IN ?", ids).Find(&users).Error
}

// GetUserByUsername 根据用户名查询用户。
func GetUserByUsername(username string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "username = ?", username)
}

// GetUserByEmail 根据邮箱查询用户。
func GetUserByEmail(email string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "email = ?", email)
}

// SaveUser 保存用户信息。
func SaveUser(user model.User) (model.User, error) {
	db, err := DB()
	if err != nil {
		return user, err
	}
	return user, db.Save(&user).Error
}

func ConsumeUserCredits(id string, credits int, now string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	if credits <= 0 {
		user, ok, err := GetUserByID(id)
		return user, ok, err
	}
	tx := db.Model(&model.User{}).Where("id = ? AND credits >= ?", id, credits).Updates(map[string]any{
		"credits":    gorm.Expr("credits - ?", credits),
		"updated_at": now,
	})
	if tx.Error != nil {
		return model.User{}, false, tx.Error
	}
	user, ok, err := GetUserByID(id)
	return user, ok && tx.RowsAffected > 0, err
}

func RefundUserCredits(id string, credits int, now string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	if credits <= 0 {
		user, ok, err := GetUserByID(id)
		return user, ok, err
	}
	tx := db.Model(&model.User{}).Where("id = ?", id).Updates(map[string]any{
		"credits":    gorm.Expr("credits + ?", credits),
		"updated_at": now,
	})
	if tx.Error != nil {
		return model.User{}, false, tx.Error
	}
	user, ok, err := GetUserByID(id)
	return user, ok && tx.RowsAffected > 0, err
}

// SaveCreditLog 保存算力点变更流水。
func SaveCreditLog(log model.CreditLog) (model.CreditLog, error) {
	db, err := DB()
	if err != nil {
		return log, err
	}
	return log, db.Save(&log).Error
}

func ListCreditLogs(q model.Query) ([]model.CreditLog, int64, error) {
	return listCreditLogs("", q)
}

func ListUserCreditLogs(userID string, q model.Query) ([]model.CreditLog, int64, error) {
	return listCreditLogs(userID, q)
}

func listCreditLogs(userID string, q model.Query) ([]model.CreditLog, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.CreditLog{})
	if userID != "" {
		tx = tx.Where("user_id = ?", userID)
	}
	if q.Category != "" {
		tx = tx.Where("category = ?", q.Category)
	}
	if q.Type != "" {
		tx = tx.Where("type = ?", q.Type)
	}
	if q.StartTime != "" {
		tx = tx.Where("created_at >= ?", normalizeQueryTime(q.StartTime))
	}
	if q.EndTime != "" {
		tx = tx.Where("created_at <= ?", normalizeQueryTime(q.EndTime))
	}
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("user_id LIKE ? OR category LIKE ? OR type LIKE ? OR model LIKE ? OR path LIKE ? OR remark LIKE ? OR related_id LIKE ? OR ip LIKE ? OR country LIKE ?", like, like, like, like, like, like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.CreditLog
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&logs).Error
	return logs, total, err
}

func DeleteCreditLog(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.CreditLog{}, "id = ?", id).Error
}

func SaveAuditLog(log model.AuditLog) (model.AuditLog, error) {
	db, err := DB()
	if err != nil {
		return log, err
	}
	return log, db.Save(&log).Error
}

func ListAuditLogs(q model.Query) ([]model.AuditLog, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.AuditLog{})
	if q.Category != "" {
		tx = tx.Where("category = ?", q.Category)
	}
	if q.Type != "" {
		tx = tx.Where("action = ?", q.Type)
	}
	if q.StartTime != "" {
		tx = tx.Where("created_at >= ?", normalizeQueryTime(q.StartTime))
	}
	if q.EndTime != "" {
		tx = tx.Where("created_at <= ?", normalizeQueryTime(q.EndTime))
	}
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("category LIKE ? OR action LIKE ? OR actor_id LIKE ? OR actor_username LIKE ? OR target_type LIKE ? OR target_id LIKE ? OR remark LIKE ? OR ip LIKE ? OR country LIKE ?", like, like, like, like, like, like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.AuditLog
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&logs).Error
	return logs, total, err
}

// DeleteUser 删除指定用户。
func DeleteUser(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.User{}, "id = ?", id).Error
}

// GetUserByLinuxDoID 根据 Linux.do ID 查询用户。
func GetUserByLinuxDoID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "linux_do_id = ?", id)
}

func GetUserByGithubID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "github_id = ?", id)
}

func GetUserByGoogleID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "google_id = ?", id)
}

func GetUserByMetaMaskAddress(address string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "metamask_address = ?", address)
}

func GetUserByAuthProviderOAuthID(provider string, id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	id = escapeLike(id)
	return findUser(db, "auth_provider = ? AND (extra LIKE ? ESCAPE '\\' OR extra LIKE ? ESCAPE '\\')", provider, `%"ID":"`+id+`"%`, `%"id":"`+id+`"%`)
}

func escapeLike(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `%`, `\%`)
	return strings.ReplaceAll(value, `_`, `\_`)
}

func normalizeQueryTime(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.In(time.Local).Format(time.RFC3339)
	}
	return value
}

func SaveEmailVerification(item model.EmailVerification) (model.EmailVerification, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func GetLatestActiveEmailVerification(purpose string, target string, now string) (model.EmailVerification, bool, error) {
	db, err := DB()
	if err != nil {
		return model.EmailVerification{}, false, err
	}
	item := model.EmailVerification{}
	err = db.Where("purpose = ? AND target = ? AND used_at = '' AND expires_at > ?", purpose, target, now).Order("created_at desc").First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.EmailVerification{}, false, nil
	}
	return item, err == nil, err
}

func GetLatestEmailVerification(purpose string, target string) (model.EmailVerification, bool, error) {
	db, err := DB()
	if err != nil {
		return model.EmailVerification{}, false, err
	}
	item := model.EmailVerification{}
	err = db.Where("purpose = ? AND target = ?", purpose, target).Order("created_at desc").First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.EmailVerification{}, false, nil
	}
	return item, err == nil, err
}

func SaveMetaMaskChallenge(item model.MetaMaskChallenge) (model.MetaMaskChallenge, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func GetActiveMetaMaskChallenge(nonce string, currentTime string) (model.MetaMaskChallenge, bool, error) {
	db, err := DB()
	if err != nil {
		return model.MetaMaskChallenge{}, false, err
	}
	item := model.MetaMaskChallenge{}
	err = db.Where("nonce = ? AND used_at = '' AND expires_at > ?", nonce, currentTime).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.MetaMaskChallenge{}, false, nil
	}
	return item, err == nil, err
}

func ConsumeMetaMaskChallenge(id string, usedAt string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	tx := db.Model(&model.MetaMaskChallenge{}).Where("id = ? AND used_at = '' AND expires_at > ?", id, usedAt).Update("used_at", usedAt)
	return tx.RowsAffected > 0, tx.Error
}

// findUser 查询单个用户，并将未命中转换为 ok=false。
func findUser(db *gorm.DB, query string, args ...any) (model.User, bool, error) {
	user := model.User{}
	err := db.Where(query, args...).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, false, nil
	}
	return user, err == nil, err
}
