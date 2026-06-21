package model

import "encoding/json"

type CanvasAssistantSession struct {
	ID            string          `json:"id" gorm:"primaryKey"`
	UserID        string          `json:"userId" gorm:"index"`
	WorkflowID    string          `json:"workflowId" gorm:"index"`
	Title         string          `json:"title"`
	Messages      json.RawMessage `json:"messages" gorm:"serializer:json"`
	LastMessageAt string          `json:"lastMessageAt" gorm:"index"`
	ExpiresAt     string          `json:"expiresAt" gorm:"index"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
	DeletedAt     string          `json:"deletedAt" gorm:"index"`
}
