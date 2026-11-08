package model

type SupportTicketStatus string

const (
	SupportTicketPending SupportTicketStatus = "pending"
	SupportTicketReplied SupportTicketStatus = "replied"
	SupportTicketClosed  SupportTicketStatus = "closed"
)

type SupportTicketCharge struct {
	ID        string        `json:"id"`
	Type      CreditLogType `json:"type"`
	Model     string        `json:"model"`
	Path      string        `json:"path"`
	Amount    int           `json:"amount"`
	Balance   int           `json:"balance"`
	RelatedID string        `json:"relatedId"`
	Remark    string        `json:"remark"`
	CreatedAt string        `json:"createdAt"`
}

type SupportTicket struct {
	ID          string               `json:"id" gorm:"primaryKey"`
	UserID      string               `json:"userId" gorm:"index"`
	Title       string               `json:"title"`
	Category    string               `json:"category" gorm:"index"`
	Content     string               `json:"content" gorm:"type:text"`
	Status      SupportTicketStatus  `json:"status" gorm:"index"`
	CreditLogID string               `json:"creditLogId" gorm:"index"`
	Charge      *SupportTicketCharge `json:"charge" gorm:"serializer:json"`
	User        *LogUser             `json:"user,omitempty" gorm:"-"`
	CreatedAt   string               `json:"createdAt"`
	UpdatedAt   string               `json:"updatedAt" gorm:"index"`
}

type SupportTicketReply struct {
	ID        string `json:"id" gorm:"primaryKey"`
	TicketID  string `json:"ticketId" gorm:"index"`
	AuthorID  string `json:"authorId"`
	IsAdmin   bool   `json:"isAdmin"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt string `json:"createdAt"`
}

type SupportTicketList struct {
	Items []SupportTicket `json:"items"`
	Total int64           `json:"total"`
}

type SupportTicketDetail struct {
	SupportTicket
	Replies []SupportTicketReply `json:"replies"`
}
