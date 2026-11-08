package service

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"gorm.io/gorm"
)

type CreateSupportTicketInput struct {
	Title       string `json:"title"`
	Category    string `json:"category"`
	Content     string `json:"content"`
	CreditLogID string `json:"creditLogId"`
}

func supportTicketScope(user model.AuthUser, admin bool) (string, error) {
	if user.ID == "" || (admin && user.Role != model.UserRoleAdmin) {
		return "", safeMessageError{message: "未登录或权限不足"}
	}
	if admin {
		return "", nil
	}
	return user.ID, nil
}

func supportTicketError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return safeMessageError{message: "工单不存在或无权限操作"}
	}
	return err
}

func GetUserCreditLog(user model.AuthUser, id string) (model.SupportTicketCharge, error) {
	if _, err := supportTicketScope(user, false); err != nil {
		return model.SupportTicketCharge{}, err
	}
	item, err := repository.GetUserCreditLog(user.ID, strings.TrimSpace(id))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.SupportTicketCharge{}, safeMessageError{message: "扣费记录不存在或无权限查看"}
	}
	return model.SupportTicketCharge{ID: item.ID, Type: item.Type, Model: item.Model, Path: item.Path, Amount: item.Amount, Balance: item.Balance, RelatedID: item.RelatedID, Remark: item.Remark, CreatedAt: item.CreatedAt}, err
}

func CreateSupportTicket(user model.AuthUser, input CreateSupportTicketInput) (model.SupportTicket, error) {
	item := model.SupportTicket{}
	if _, err := supportTicketScope(user, false); err != nil {
		return item, err
	}
	input.Title, input.Content = strings.TrimSpace(input.Title), strings.TrimSpace(input.Content)
	if input.Title == "" || utf8.RuneCountInString(input.Title) > 100 {
		return item, safeMessageError{message: "工单标题需为 1–100 个字符"}
	}
	if input.Content == "" || utf8.RuneCountInString(input.Content) > 5000 {
		return item, safeMessageError{message: "问题描述需为 1–5000 个字符"}
	}
	switch input.Category {
	case "billing", "generation", "account", "other":
	default:
		return item, safeMessageError{message: "请选择有效的问题分类"}
	}
	if id := strings.TrimSpace(input.CreditLogID); id != "" {
		charge, err := GetUserCreditLog(user, id)
		if err != nil {
			return item, err
		}
		if charge.Amount >= 0 || input.Category != "billing" {
			return item, safeMessageError{message: "仅扣费问题可以关联负数扣费记录"}
		}
		item.CreditLogID, item.Charge = charge.ID, &charge
	}
	if err := hitRateBucket("support-ticket-create:"+user.ID, 5, time.Minute, time.Minute); err != nil {
		return item, err
	}
	item.ID, item.UserID = newID("ticket"), user.ID
	item.Title, item.Category, item.Content = input.Title, input.Category, input.Content
	item.Status, item.CreatedAt = model.SupportTicketPending, time.Now().UTC().Format(time.RFC3339Nano)
	item.UpdatedAt = item.CreatedAt
	return item, repository.CreateSupportTicket(item)
}

func ListSupportTickets(user model.AuthUser, q model.Query, admin bool) (model.SupportTicketList, error) {
	userID, err := supportTicketScope(user, admin)
	if err != nil {
		return model.SupportTicketList{}, err
	}
	q.Normalize()
	q.Keyword = strings.TrimSpace(q.Keyword)
	result, err := repository.ListSupportTickets(userID, q)
	if err == nil && admin {
		ids := make([]string, 0, len(result.Items))
		for _, item := range result.Items {
			ids = append(ids, item.UserID)
		}
		users, err := repository.ListUsersByIDs(ids)
		if err != nil {
			return result, err
		}
		byID := map[string]model.LogUser{}
		for _, user := range users {
			byID[user.ID] = logUserFromModel(user)
		}
		for i := range result.Items {
			if user, ok := byID[result.Items[i].UserID]; ok {
				result.Items[i].User = &user
			}
		}
	}
	return result, err
}

func GetSupportTicket(user model.AuthUser, id string, admin bool) (model.SupportTicketDetail, error) {
	userID, err := supportTicketScope(user, admin)
	if err != nil {
		return model.SupportTicketDetail{}, err
	}
	result, err := repository.GetSupportTicket(userID, strings.TrimSpace(id))
	if err == nil && admin {
		owner, ok, lookupErr := repository.GetUserByID(result.UserID)
		if lookupErr != nil {
			return result, lookupErr
		}
		if ok {
			info := logUserFromModel(owner)
			result.User = &info
		}
	}
	return result, supportTicketError(err)
}

func ReplySupportTicket(user model.AuthUser, id, content string, admin bool) error {
	userID, err := supportTicketScope(user, admin)
	if err != nil {
		return err
	}
	content = strings.TrimSpace(content)
	if content == "" || utf8.RuneCountInString(content) > 5000 {
		return safeMessageError{message: "回复内容需为 1–5000 个字符"}
	}
	if err := hitRateBucket("support-ticket-reply:"+user.ID, 30, time.Minute, time.Minute); err != nil {
		return err
	}
	reply := model.SupportTicketReply{ID: newID("reply"), TicketID: strings.TrimSpace(id), AuthorID: user.ID, IsAdmin: admin, Content: content, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	err = repository.UpdateSupportTicket(userID, reply.TicketID, reply.CreatedAt, func(item *model.SupportTicket) (*model.SupportTicketReply, error) {
		if item.Status == model.SupportTicketClosed {
			return nil, safeMessageError{message: "工单已关闭，请重新打开后回复"}
		}
		item.Status = model.SupportTicketPending
		if admin {
			item.Status = model.SupportTicketReplied
		}
		return &reply, nil
	})
	return supportTicketError(err)
}

func SetSupportTicketStatus(user model.AuthUser, id string, status model.SupportTicketStatus, admin bool) error {
	userID, err := supportTicketScope(user, admin)
	if err != nil {
		return err
	}
	if status != model.SupportTicketClosed && status != model.SupportTicketPending {
		return safeMessageError{message: "工单状态无效"}
	}
	err = repository.UpdateSupportTicket(userID, strings.TrimSpace(id), time.Now().UTC().Format(time.RFC3339Nano), func(item *model.SupportTicket) (*model.SupportTicketReply, error) {
		if status == model.SupportTicketPending && item.Status != model.SupportTicketClosed {
			return nil, safeMessageError{message: "只有已关闭的工单可以重新打开"}
		}
		item.Status = status
		return nil, nil
	})
	return supportTicketError(err)
}
