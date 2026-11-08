package repository

import (
	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

func GetUserCreditLog(userID, id string) (model.CreditLog, error) {
	db, err := DB()
	var item model.CreditLog
	if err == nil {
		err = db.Where("id = ? AND user_id = ?", id, userID).First(&item).Error
	}
	return item, err
}

func CreateSupportTicket(item model.SupportTicket) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Create(&item).Error
}

func ListSupportTickets(userID string, q model.Query) (model.SupportTicketList, error) {
	db, err := DB()
	result := model.SupportTicketList{Items: []model.SupportTicket{}}
	if err != nil {
		return result, err
	}
	query := db.Model(&model.SupportTicket{})
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if q.Type != "" {
		query = query.Where("status = ?", q.Type)
	}
	if q.Category != "" {
		query = query.Where("category = ?", q.Category)
	}
	if q.Keyword != "" {
		like := LikePattern(q.Keyword)
		query = query.Where("id LIKE ? ESCAPE '!' OR title LIKE ? ESCAPE '!' OR user_id LIKE ? ESCAPE '!' OR credit_log_id LIKE ? ESCAPE '!'", like, like, like, like)
	}
	if err := query.Count(&result.Total).Error; err != nil {
		return result, err
	}
	err = query.Order("updated_at desc, id desc").Offset(q.Offset()).Limit(q.PageSize).Find(&result.Items).Error
	return result, err
}

func GetSupportTicket(userID, id string) (model.SupportTicketDetail, error) {
	db, err := DB()
	result := model.SupportTicketDetail{Replies: []model.SupportTicketReply{}}
	if err != nil {
		return result, err
	}
	query := db.Where("id = ?", id)
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&result.SupportTicket).Error; err != nil {
		return result, err
	}
	err = db.Where("ticket_id = ?", id).Order("created_at asc, id asc").Find(&result.Replies).Error
	return result, err
}

// Serialize replies and status changes on the ticket, including on SQLite.
func UpdateSupportTicket(userID, id, updatedAt string, change func(*model.SupportTicket) (*model.SupportTicketReply, error)) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		query := tx.Model(&model.SupportTicket{}).Where("id = ?", id)
		if userID != "" {
			query = query.Where("user_id = ?", userID)
		}
		query = query.Session(&gorm.Session{})
		if err := query.Update("updated_at", gorm.Expr("updated_at")).Error; err != nil {
			return err
		}
		var item model.SupportTicket
		if err := query.First(&item).Error; err != nil {
			return err
		}
		reply, err := change(&item)
		if err != nil {
			return err
		}
		if err := query.Updates(map[string]any{"status": item.Status, "updated_at": updatedAt}).Error; err != nil {
			return err
		}
		if reply != nil {
			return tx.Create(reply).Error
		}
		return nil
	})
}
