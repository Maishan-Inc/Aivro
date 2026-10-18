package repository

import (
	"github.com/basketikun/aivro/model"
	"gorm.io/gorm"
)

func GetPlanOrder(id string) (model.PlanOrder, error) {
	db, err := DB()
	var order model.PlanOrder
	if err == nil {
		err = db.Where("id = ?", id).First(&order).Error
	}
	return order, err
}

func CompletePlanOrder(order model.PlanOrder, sessionID string, intentID string, log model.EntitlementLog) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		changed := tx.Model(&model.PlanOrder{}).Where("id = ? AND status = ? AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = ?)", order.ID, model.PlanOrderStatusPending, sessionID).Updates(map[string]any{
			"status": model.PlanOrderStatusPaid, "stripe_checkout_session_id": sessionID, "stripe_payment_intent_id": intentID, "paid_at": log.CreatedAt, "updated_at": log.CreatedAt,
		})
		if changed.Error != nil || changed.RowsAffected == 0 {
			return changed.Error
		}
		changed = tx.Model(&model.User{}).Where("id = ?", order.UserID).Updates(map[string]any{"credits": gorm.Expr("credits + ?", order.Credits), "workflow_create_credits": gorm.Expr("workflow_create_credits + ?", order.WorkflowCreateCredits), "updated_at": log.CreatedAt})
		if changed.Error != nil {
			return changed.Error
		}
		if changed.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		var user model.User
		if err := tx.Where("id = ?", order.UserID).First(&user).Error; err != nil {
			return err
		}
		log.CreditsAfter, log.WorkflowCreateCreditsAfter = user.Credits, user.WorkflowCreateCredits
		return tx.Create(&log).Error
	})
}
