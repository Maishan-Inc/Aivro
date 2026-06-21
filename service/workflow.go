package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/aivro/config"
	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const noWorkflowCreditsMessage = "当前账号暂无工作流创建次数，请完成 KYC 认证或购买套餐获取更多创建次数。"

type SaveWorkflowInput struct {
	Slug           string                 `json:"slug"`
	Title          string                 `json:"title"`
	Nodes          json.RawMessage        `json:"nodes"`
	Connections    json.RawMessage        `json:"connections"`
	ChatSessions   json.RawMessage        `json:"chatSessions"`
	ActiveChatID   string                 `json:"activeChatId"`
	BackgroundMode string                 `json:"backgroundMode"`
	ShowImageInfo  bool                   `json:"showImageInfo"`
	Viewport       json.RawMessage        `json:"viewport"`
	SourceSyncMode model.WorkflowSyncMode `json:"sourceSyncMode"`
}

type ShareWorkflowInput struct {
	PasswordEnabled bool   `json:"passwordEnabled"`
	Password        string `json:"password"`
}

type WorkflowSharePreview struct {
	ID               string          `json:"id"`
	Token            string          `json:"token"`
	Title            string          `json:"title"`
	Slug             string          `json:"slug"`
	Version          int             `json:"version"`
	RequiresPassword bool            `json:"requiresPassword"`
	Snapshot         json.RawMessage `json:"snapshot,omitempty"`
	Owner            model.AuthUser  `json:"owner"`
	SourceWorkflowID string          `json:"sourceWorkflowId"`
	StarCount        int64           `json:"starCount"`
	Starred          bool            `json:"starred"`
}

type WorkflowShareSummary struct {
	ID               string `json:"id"`
	Token            string `json:"token"`
	Title            string `json:"title"`
	Version          int    `json:"version"`
	PasswordEnabled  bool   `json:"passwordEnabled"`
	SourceWorkflowID string `json:"sourceWorkflowId"`
	UpdatedAt        string `json:"updatedAt"`
}

type CopyWorkflowShareInput struct {
	Slug             string                      `json:"slug"`
	Mode             model.WorkflowShareCopyMode `json:"mode"`
	Password         string                      `json:"password"`
	ShareAccessToken string                      `json:"shareAccessToken"`
}

type DeleteWorkflowInput struct {
	Name string `json:"name"`
}

type PublishCommunityWorkflowInput struct {
	WorkflowID string   `json:"workflowId"`
	Title      string   `json:"title"`
	Locale     string   `json:"locale"`
	Tags       []string `json:"tags"`
}

type SyncCommunityWorkflowInput struct {
	WorkflowTitle string `json:"workflowTitle"`
}

type BanCommunityWorkflowInput struct {
	Reason string `json:"reason"`
}

type WorkflowCommunityPreview struct {
	ID               string          `json:"id"`
	Token            string          `json:"token"`
	Title            string          `json:"title"`
	Locale           string          `json:"locale"`
	Tags             []string        `json:"tags"`
	Snapshot         json.RawMessage `json:"snapshot"`
	Owner            model.AuthUser  `json:"owner"`
	SourceWorkflowID string          `json:"sourceWorkflowId"`
	UpdatedAt        string          `json:"updatedAt"`
}

type shareAccessClaims struct {
	ShareID string `json:"shareId"`
	Token   string `json:"token"`
	UserID  string `json:"userId"`
	jwt.RegisteredClaims
}

func ListWorkflows(userID string, q model.Query) (model.WorkflowList, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowList{}, err
	}
	q.Normalize()
	tx := db.Model(&model.Workflow{}).Where("user_id = ? AND deleted_at = ?", userID, "")
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		tx = tx.Where("title LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return model.WorkflowList{}, err
	}
	items := []model.Workflow{}
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return model.WorkflowList{Items: items, Total: int(total)}, err
}

func GetWorkflow(userID string, id string) (model.Workflow, error) {
	db, err := repository.DB()
	if err != nil {
		return model.Workflow{}, err
	}
	item := model.Workflow{}
	err = db.Where("id = ? AND user_id = ? AND deleted_at = ?", id, userID, "").First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, safeMessageError{message: "工作流不存在或无权限访问"}
	}
	return item, err
}

func CreateWorkflow(userID string, input SaveWorkflowInput) (model.Workflow, error) {
	db, err := repository.DB()
	if err != nil {
		return model.Workflow{}, err
	}
	slug, err := normalizeWorkflowSlug(input.Slug)
	if err != nil {
		return model.Workflow{}, err
	}
	if err := ensureWorkflowSlugAvailable(db, userID, slug, ""); err != nil {
		return model.Workflow{}, err
	}
	input.Slug = slug
	input.Title = slug
	workflow := normalizeWorkflowInput(model.Workflow{ID: newID("workflow"), UserID: userID, CreatedAt: now()}, input)
	return workflow, db.Transaction(func(tx *gorm.DB) error {
		user, err := consumeWorkflowCreditTx(tx, userID, workflow.ID, "创建云端工作流")
		if err != nil {
			return err
		}
		if err := validateWorkflowCloudFilesTx(tx, userID, workflow.Nodes, workflow.ChatSessions); err != nil {
			return err
		}
		if err := tx.Create(&workflow).Error; err != nil {
			return err
		}
		if err := bindWorkflowCloudFilesTx(tx, userID, workflow.ID, workflow.Nodes, workflow.ChatSessions); err != nil {
			return err
		}
		return createEntitlementLogTx(tx, model.EntitlementLog{
			ID:                         newID("entitle"),
			UserID:                     user.ID,
			Source:                     model.EntitlementLogWorkflowCreate,
			SourceID:                   workflow.ID,
			WorkflowCreateCreditsDelta: -1,
			CreditsAfter:               user.Credits,
			WorkflowCreateCreditsAfter: user.WorkflowCreateCredits,
			Remark:                     "创建云端工作流",
			CreatedAt:                  now(),
		})
	})
}

func UpdateWorkflow(userID string, id string, input SaveWorkflowInput) (model.Workflow, error) {
	db, err := repository.DB()
	if err != nil {
		return model.Workflow{}, err
	}
	workflow, err := GetWorkflow(userID, id)
	if err != nil {
		return workflow, err
	}
	workflow = normalizeWorkflowInput(workflow, input)
	if err := validateWorkflowCloudFilesTx(db, userID, workflow.Nodes, workflow.ChatSessions); err != nil {
		return workflow, err
	}
	tx := db.Model(&model.Workflow{}).Where("id = ? AND user_id = ? AND deleted_at = ?", id, userID, "").Updates(workflowUpdateMap(workflow))
	if tx.Error != nil {
		return workflow, tx.Error
	}
	if tx.RowsAffected == 0 {
		return workflow, safeMessageError{message: "工作流不存在或无权限访问"}
	}
	if err := bindWorkflowCloudFiles(userID, id, workflow.Nodes, workflow.ChatSessions); err != nil {
		return workflow, err
	}
	return GetWorkflow(userID, id)
}

func DeleteWorkflow(userID string, id string) error {
	return DeleteWorkflowWithInput(userID, id, DeleteWorkflowInput{})
}

func DeleteWorkflowWithInput(userID string, id string, input DeleteWorkflowInput) error {
	db, err := repository.DB()
	if err != nil {
		return err
	}
	workflow, err := GetWorkflow(userID, id)
	if err != nil {
		return err
	}
	confirmName := strings.TrimSpace(input.Name)
	if confirmName == "" || (confirmName != workflow.Slug && confirmName != workflow.Title) {
		return safeMessageError{message: "请输入正确的工作流名称确认删除"}
	}
	tx := db.Model(&model.Workflow{}).Where("id = ? AND user_id = ? AND deleted_at = ?", id, userID, "").Updates(map[string]any{
		"deleted_at": now(),
		"updated_at": now(),
	})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return safeMessageError{message: "工作流不存在或无权限访问"}
	}
	return DeleteWorkflowCloudFiles(userID, id)
}

func ShareWorkflow(r *http.Request, userID string, workflowID string, input ShareWorkflowInput) (map[string]any, error) {
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	workflow, err := GetWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}
	workflow, err = ensureWorkflowSlugForShare(db, userID, workflow)
	if err != nil {
		return nil, err
	}
	owner, ok, err := repository.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if !ok || strings.TrimSpace(owner.Username) == "" {
		return nil, safeMessageError{message: "用户名称不存在，无法生成分享链接"}
	}
	if strings.TrimSpace(workflow.Slug) == "" {
		return nil, safeMessageError{message: "工作流名称不存在，无法生成分享链接"}
	}
	snapshot, _ := json.Marshal(workflow)
	share := model.WorkflowShare{}
	found := true
	if err := db.Where("owner_id = ? AND source_workflow_id = ? AND status = ?", userID, workflowID, model.WorkflowShareStatusActive).First(&share).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		found = false
	}
	passwordHash := share.PasswordHash
	if input.PasswordEnabled {
		if strings.TrimSpace(input.Password) != "" {
			hash, err := hashPassword(input.Password)
			if err != nil {
				return nil, err
			}
			passwordHash = hash
		} else if !found || passwordHash == "" {
			return nil, safeMessageError{message: "请填写分享密码"}
		}
	} else {
		passwordHash = ""
	}
	if !found {
		share = model.WorkflowShare{
			ID:               newID("share"),
			OwnerID:          userID,
			SourceWorkflowID: workflowID,
			Token:            mustRandomToken(24),
			Version:          1,
			Status:           model.WorkflowShareStatusActive,
			CreatedAt:        now(),
		}
	} else {
		share.Version++
	}
	share.Title = workflow.Title
	share.Snapshot = snapshot
	share.PasswordEnabled = input.PasswordEnabled
	share.PasswordHash = passwordHash
	share.UpdatedAt = now()
	if err := db.Save(&share).Error; err != nil {
		return nil, err
	}
	if found {
		if err := pushLinkedShareUpdates(db, share); err != nil {
			return nil, err
		}
	}
	return map[string]any{
		"share":    workflowShareSummary(share),
		"shareUrl": workflowShareURL(r, owner.Username, workflow.Slug),
	}, nil
}

func GetWorkflowActiveShare(r *http.Request, userID string, workflowID string) (map[string]any, error) {
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	workflow, err := GetWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}
	workflow, err = ensureWorkflowSlugForShare(db, userID, workflow)
	if err != nil {
		return nil, err
	}
	share := model.WorkflowShare{}
	err = db.Where("owner_id = ? AND source_workflow_id = ? AND status = ?", userID, workflowID, model.WorkflowShareStatusActive).First(&share).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return map[string]any{"share": nil, "shareUrl": ""}, nil
	}
	if err != nil {
		return nil, err
	}
	owner, _, _ := repository.GetUserByID(userID)
	return map[string]any{"share": workflowShareSummary(share), "shareUrl": workflowShareURL(r, owner.Username, workflow.Slug)}, nil
}

func GetWorkflowSharePreview(userID string, token string, accessToken string) (WorkflowSharePreview, error) {
	share, err := findActiveShare(token)
	if err != nil {
		return WorkflowSharePreview{}, err
	}
	if share.PasswordEnabled && !validShareAccessToken(userID, share, accessToken) {
		return sharePreviewForUser(share, true, userID, false), nil
	}
	return sharePreviewForUser(share, false, userID, true), nil
}

func VerifyWorkflowShare(userID string, token string, password string) (map[string]any, error) {
	share, err := findActiveShare(token)
	if err != nil {
		return nil, err
	}
	if !share.PasswordEnabled {
		preview := sharePreviewForUser(share, false, userID, true)
		return map[string]any{"preview": preview, "shareAccessToken": ""}, nil
	}
	if bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)) != nil {
		return nil, safeMessageError{message: "分享密码错误"}
	}
	accessToken, err := newShareAccessToken(userID, share)
	if err != nil {
		return nil, err
	}
	preview := sharePreviewForUser(share, false, userID, true)
	return map[string]any{"preview": preview, "shareAccessToken": accessToken}, nil
}

func GetWorkflowSharePreviewByPath(username string, slug string, userID string, accessToken string) (WorkflowSharePreview, error) {
	share, err := findActiveShareByPath(username, slug)
	if err != nil {
		return WorkflowSharePreview{}, err
	}
	if share.PasswordEnabled && !validShareAccessToken(userID, share, accessToken) {
		return sharePreviewForUser(share, true, userID, false), nil
	}
	return sharePreviewForUser(share, false, userID, true), nil
}

func VerifyWorkflowShareByPath(userID string, username string, slug string, password string) (map[string]any, error) {
	share, err := findActiveShareByPath(username, slug)
	if err != nil {
		return nil, err
	}
	if !share.PasswordEnabled {
		return map[string]any{"preview": sharePreviewForUser(share, false, userID, true), "shareAccessToken": ""}, nil
	}
	if bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)) != nil {
		return nil, safeMessageError{message: "分享密码错误"}
	}
	accessToken, err := newShareAccessToken(userID, share)
	if err != nil {
		return nil, err
	}
	return map[string]any{"preview": sharePreviewForUser(share, false, userID, true), "shareAccessToken": accessToken}, nil
}

func CopyWorkflowShare(userID string, token string, input CopyWorkflowShareInput) (model.Workflow, error) {
	if input.Mode != model.WorkflowShareCopyLinked {
		input.Mode = model.WorkflowShareCopyDetached
	}
	slug, err := normalizeWorkflowSlug(input.Slug)
	if err != nil {
		return model.Workflow{}, err
	}
	share, err := findActiveShare(token)
	if err != nil {
		return model.Workflow{}, err
	}
	if share.PasswordEnabled && !validShareAccessToken(userID, share, input.ShareAccessToken) {
		if bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(input.Password)) != nil {
			return model.Workflow{}, safeMessageError{message: "请先验证分享密码"}
		}
	}
	source := model.Workflow{}
	_ = json.Unmarshal(share.Snapshot, &source)
	db, err := repository.DB()
	if err != nil {
		return model.Workflow{}, err
	}
	if err := ensureWorkflowSlugAvailable(db, userID, slug, ""); err != nil {
		return model.Workflow{}, err
	}
	workflow := model.Workflow{
		ID:               newID("workflow"),
		UserID:           userID,
		Slug:             slug,
		Title:            slug,
		Nodes:            source.Nodes,
		Connections:      source.Connections,
		ChatSessions:     source.ChatSessions,
		ActiveChatID:     source.ActiveChatID,
		BackgroundMode:   source.BackgroundMode,
		ShowImageInfo:    source.ShowImageInfo,
		Viewport:         source.Viewport,
		SourceShareID:    share.ID,
		SourceWorkflowID: share.SourceWorkflowID,
		SourceVersion:    share.Version,
		CreatedAt:        now(),
		UpdatedAt:        now(),
	}
	if input.Mode == model.WorkflowShareCopyLinked {
		workflow.SourceSyncMode = model.WorkflowSyncLinked
	} else {
		workflow.SourceSyncMode = model.WorkflowSyncDetached
	}
	return workflow, db.Transaction(func(tx *gorm.DB) error {
		user, err := consumeWorkflowCreditTx(tx, userID, workflow.ID, "复制分享工作流")
		if err != nil {
			return err
		}
		if err := tx.Create(&workflow).Error; err != nil {
			return err
		}
		copy := model.WorkflowShareCopy{
			ID:               newID("share-copy"),
			ShareID:          share.ID,
			SourceWorkflowID: share.SourceWorkflowID,
			SourceOwnerID:    share.OwnerID,
			UserID:           userID,
			WorkflowID:       workflow.ID,
			Mode:             input.Mode,
			SourceVersion:    share.Version,
			CreatedAt:        now(),
			UpdatedAt:        now(),
		}
		if err := tx.Create(&copy).Error; err != nil {
			return err
		}
		return createEntitlementLogTx(tx, model.EntitlementLog{
			ID:                         newID("entitle"),
			UserID:                     user.ID,
			Source:                     model.EntitlementLogWorkflowCreate,
			SourceID:                   workflow.ID,
			WorkflowCreateCreditsDelta: -1,
			CreditsAfter:               user.Credits,
			WorkflowCreateCreditsAfter: user.WorkflowCreateCredits,
			Remark:                     "复制分享工作流",
			CreatedAt:                  now(),
		})
	})
}

func CopyWorkflowShareByPath(userID string, username string, slug string, input CopyWorkflowShareInput) (model.Workflow, error) {
	share, err := findActiveShareByPath(username, slug)
	if err != nil {
		return model.Workflow{}, err
	}
	return CopyWorkflowShare(userID, share.Token, input)
}

func ToggleWorkflowShareStar(userID string, username string, slug string) (map[string]any, error) {
	share, err := findActiveShareByPath(username, slug)
	if err != nil {
		return nil, err
	}
	db, err := repository.DB()
	if err != nil {
		return nil, err
	}
	item := model.WorkflowShareStar{}
	err = db.Where("share_id = ? AND user_id = ?", share.ID, userID).First(&item).Error
	starred := false
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := db.Create(&model.WorkflowShareStar{ID: newID("share-star"), ShareID: share.ID, UserID: userID, CreatedAt: now()}).Error; err != nil {
			return nil, err
		}
		starred = true
	} else if err != nil {
		return nil, err
	} else if err := db.Delete(&item).Error; err != nil {
		return nil, err
	}
	count := shareStarCount(db, share.ID)
	return map[string]any{"starred": starred, "starCount": count}, nil
}

func RevokeWorkflowShare(userID string, token string) error {
	db, err := repository.DB()
	if err != nil {
		return err
	}
	tx := db.Model(&model.WorkflowShare{}).Where("token = ? AND owner_id = ? AND status = ?", token, userID, model.WorkflowShareStatusActive).Updates(map[string]any{
		"status":     model.WorkflowShareStatusRevoked,
		"updated_at": now(),
	})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return safeMessageError{message: "分享不存在或无权限操作"}
	}
	return nil
}

func ListCommunityWorkflows(q model.Query) (model.WorkflowCommunityPostList, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	q.Normalize()
	if err := cleanupExpiredBannedCommunityPosts(db); err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	tx := db.Model(&model.WorkflowCommunityPost{}).Where("status = ? AND deleted_at = ?", model.WorkflowCommunityStatusActive, "")
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		tx = tx.Where("title LIKE ? OR source_workflow_title LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if q.Locale != "" {
		tx = tx.Where("locale = ?", q.Locale)
	}
	if len(q.Tags) > 0 {
		for _, tag := range q.Tags {
			if tag = strings.TrimSpace(tag); tag != "" {
				tx = tx.Where(communityJSONTagsContains(db), tag)
			}
		}
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	items := []model.WorkflowCommunityPost{}
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return model.WorkflowCommunityPostList{Items: items, Total: int(total)}, err
}

func ListMyCommunityWorkflows(userID string, q model.Query) (model.WorkflowCommunityPostList, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	q.Normalize()
	if err := cleanupExpiredBannedCommunityPosts(db); err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	tx := db.Model(&model.WorkflowCommunityPost{}).Where("user_id = ? AND deleted_at = ?", userID, "")
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		tx = tx.Where("title LIKE ? OR source_workflow_title LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	items := []model.WorkflowCommunityPost{}
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return model.WorkflowCommunityPostList{Items: items, Total: int(total)}, err
}

func PublishCommunityWorkflow(userID string, input PublishCommunityWorkflowInput) (model.WorkflowCommunityPost, error) {
	workflow, err := GetWorkflow(userID, input.WorkflowID)
	if err != nil {
		return model.WorkflowCommunityPost{}, err
	}
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPost{}, err
	}
	snapshot, _ := json.Marshal(workflow)
	post := model.WorkflowCommunityPost{}
	found := true
	if err := db.Where("user_id = ? AND source_workflow_id = ? AND deleted_at = ?", userID, workflow.ID, "").First(&post).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return post, err
		}
		found = false
	}
	if !found {
		post = model.WorkflowCommunityPost{
			ID:               newID("community"),
			UserID:           userID,
			SourceWorkflowID: workflow.ID,
			Token:            mustRandomToken(24),
			Status:           model.WorkflowCommunityStatusActive,
			CreatedAt:        now(),
		}
	} else if post.Status == model.WorkflowCommunityStatusBanned {
		return post, safeMessageError{message: "作品已被封禁，无法重新上传"}
	}
	post.Title = normalizedCommunityTitle(input.Title)
	post.SourceWorkflowTitle = workflow.Title
	post.Locale = normalizedCommunityLocale(input.Locale)
	post.Tags = normalizedCommunityTags(input.Tags)
	post.Snapshot = snapshot
	post.SnapshotWorkflowAt = workflow.UpdatedAt
	post.UpdatedAt = now()
	if err := db.Save(&post).Error; err != nil {
		return post, err
	}
	return post, nil
}

func SyncCommunityWorkflow(userID string, id string, input SyncCommunityWorkflowInput) (model.WorkflowCommunityPost, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPost{}, err
	}
	post := model.WorkflowCommunityPost{}
	err = db.Where("id = ? AND user_id = ? AND deleted_at = ?", id, userID, "").First(&post).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return post, safeMessageError{message: "社区作品不存在或无权限操作"}
	}
	if err != nil {
		return post, err
	}
	if post.Status == model.WorkflowCommunityStatusBanned {
		return post, safeMessageError{message: "作品已被封禁，无法同步"}
	}
	workflow, err := GetWorkflow(userID, post.SourceWorkflowID)
	if err != nil {
		return post, err
	}
	if strings.TrimSpace(input.WorkflowTitle) != workflow.Title {
		return post, safeMessageError{message: "工作流名称不匹配"}
	}
	snapshot, _ := json.Marshal(workflow)
	post.SourceWorkflowTitle = workflow.Title
	post.Snapshot = snapshot
	post.SnapshotWorkflowAt = workflow.UpdatedAt
	post.UpdatedAt = now()
	if err := db.Save(&post).Error; err != nil {
		return post, err
	}
	return post, nil
}

func DeleteCommunityWorkflow(userID string, id string) error {
	db, err := repository.DB()
	if err != nil {
		return err
	}
	tx := db.Model(&model.WorkflowCommunityPost{}).Where("id = ? AND user_id = ? AND deleted_at = ?", id, userID, "").Updates(map[string]any{"deleted_at": now(), "updated_at": now()})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return safeMessageError{message: "社区作品不存在或无权限操作"}
	}
	return nil
}

func GetCommunityWorkflowPreview(token string) (WorkflowCommunityPreview, error) {
	db, err := repository.DB()
	if err != nil {
		return WorkflowCommunityPreview{}, err
	}
	post := model.WorkflowCommunityPost{}
	err = db.Where("token = ? AND status = ? AND deleted_at = ?", token, model.WorkflowCommunityStatusActive, "").First(&post).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return WorkflowCommunityPreview{}, safeMessageError{message: "社区作品不存在或已下架"}
	}
	if err != nil {
		return WorkflowCommunityPreview{}, err
	}
	return communityPreview(post), nil
}

func AdminListCommunityWorkflows(q model.Query) (model.WorkflowCommunityPostList, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	q.Normalize()
	if err := cleanupExpiredBannedCommunityPosts(db); err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	tx := db.Model(&model.WorkflowCommunityPost{}).Where("deleted_at = ?", "")
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		tx = tx.Where("title LIKE ? OR source_workflow_title LIKE ? OR user_id LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	if q.Type != "" {
		tx = tx.Where("status = ?", q.Type)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return model.WorkflowCommunityPostList{}, err
	}
	items := []model.WorkflowCommunityPost{}
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return model.WorkflowCommunityPostList{Items: items, Total: int(total)}, err
}

func AdminBanCommunityWorkflow(id string, input BanCommunityWorkflowInput) (model.WorkflowCommunityPost, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return model.WorkflowCommunityPost{}, safeMessageError{message: "请填写封禁原因"}
	}
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowCommunityPost{}, err
	}
	tx := db.Model(&model.WorkflowCommunityPost{}).Where("id = ? AND deleted_at = ?", id, "").Updates(map[string]any{
		"status":     model.WorkflowCommunityStatusBanned,
		"ban_reason": reason,
		"banned_at":  now(),
		"updated_at": now(),
	})
	if tx.Error != nil {
		return model.WorkflowCommunityPost{}, tx.Error
	}
	if tx.RowsAffected == 0 {
		return model.WorkflowCommunityPost{}, safeMessageError{message: "社区作品不存在"}
	}
	post := model.WorkflowCommunityPost{}
	return post, db.Where("id = ?", id).First(&post).Error
}

func normalizeWorkflowInput(workflow model.Workflow, input SaveWorkflowInput) model.Workflow {
	if input.Slug != "" {
		workflow.Slug = input.Slug
	}
	workflow.Title = strings.TrimSpace(input.Title)
	if workflow.Title == "" {
		workflow.Title = workflow.Slug
	}
	if workflow.Title == "" {
		workflow.Title = "untitled"
	}
	workflow.Nodes = normalizeJSON(input.Nodes, "[]")
	workflow.Connections = normalizeJSON(input.Connections, "[]")
	workflow.ChatSessions = normalizeJSON(input.ChatSessions, "[]")
	workflow.ActiveChatID = input.ActiveChatID
	workflow.BackgroundMode = input.BackgroundMode
	if workflow.BackgroundMode == "" {
		workflow.BackgroundMode = "lines"
	}
	workflow.ShowImageInfo = input.ShowImageInfo
	workflow.Viewport = normalizeJSON(input.Viewport, `{"x":0,"y":0,"k":1}`)
	if workflow.SourceSyncMode == "" {
		workflow.SourceSyncMode = model.WorkflowSyncNone
	}
	workflow.UpdatedAt = now()
	return workflow
}

func normalizeWorkflowSlug(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", safeMessageError{message: "请填写工作流名称"}
	}
	if len(value) > 40 {
		return "", safeMessageError{message: "工作流名称不能超过 40 位"}
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return "", safeMessageError{message: "工作流名称仅限小写字母与数字"}
		}
	}
	return value, nil
}

func ensureWorkflowSlugAvailable(db *gorm.DB, userID string, slug string, exceptID string) error {
	tx := db.Model(&model.Workflow{}).Where("user_id = ? AND slug = ? AND deleted_at = ?", userID, slug, "")
	if exceptID != "" {
		tx = tx.Where("id <> ?", exceptID)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return err
	}
	if total > 0 {
		return safeMessageError{message: "该工作流名称已存在"}
	}
	return nil
}

func ensureWorkflowSlugForShare(db *gorm.DB, userID string, workflow model.Workflow) (model.Workflow, error) {
	if strings.TrimSpace(workflow.Slug) != "" {
		return workflow, nil
	}
	base := workflowSlugCandidate(workflow.Title)
	if base == "" {
		base = workflowSlugCandidate(workflow.ID)
	}
	if base == "" {
		base = "workflow"
	}
	if len(base) > 32 {
		base = base[:32]
	}
	for index := 0; index < 100; index++ {
		slug := base
		if index > 0 {
			suffix := fmt.Sprint(index + 1)
			prefix := base
			if len(prefix)+len(suffix) > 40 {
				prefix = prefix[:40-len(suffix)]
			}
			slug = prefix + suffix
		}
		var total int64
		if err := db.Model(&model.Workflow{}).Where("user_id = ? AND slug = ? AND deleted_at = ? AND id <> ?", userID, slug, "", workflow.ID).Count(&total).Error; err != nil {
			return workflow, err
		}
		if total > 0 {
			continue
		}
		workflow.Slug = slug
		workflow.UpdatedAt = now()
		return workflow, db.Model(&model.Workflow{}).Where("id = ? AND user_id = ? AND deleted_at = ?", workflow.ID, userID, "").Updates(map[string]any{"slug": workflow.Slug, "updated_at": workflow.UpdatedAt}).Error
	}
	return workflow, safeMessageError{message: "无法生成可用的工作流名称"}
}

func workflowSlugCandidate(value string) string {
	var builder strings.Builder
	for _, char := range strings.ToLower(value) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

func workflowUpdateMap(workflow model.Workflow) map[string]any {
	return map[string]any{
		"title":           workflow.Title,
		"nodes":           workflow.Nodes,
		"connections":     workflow.Connections,
		"chat_sessions":   workflow.ChatSessions,
		"active_chat_id":  workflow.ActiveChatID,
		"background_mode": workflow.BackgroundMode,
		"show_image_info": workflow.ShowImageInfo,
		"viewport":        workflow.Viewport,
		"updated_at":      workflow.UpdatedAt,
	}
}

func normalizeJSON(value json.RawMessage, fallback string) json.RawMessage {
	if len(value) == 0 || !json.Valid(value) {
		return json.RawMessage(fallback)
	}
	return value
}

func consumeWorkflowCreditTx(tx *gorm.DB, userID string, sourceID string, remark string) (model.User, error) {
	result := tx.Model(&model.User{}).Where("id = ? AND workflow_create_credits > 0", userID).Updates(map[string]any{
		"workflow_create_credits": gorm.Expr("workflow_create_credits - 1"),
		"updated_at":              now(),
	})
	if result.Error != nil {
		return model.User{}, result.Error
	}
	if result.RowsAffected == 0 {
		return model.User{}, safeMessageError{message: noWorkflowCreditsMessage}
	}
	user := model.User{}
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		return user, err
	}
	return user, nil
}

func createEntitlementLogTx(tx *gorm.DB, log model.EntitlementLog) error {
	return tx.Create(&log).Error
}

func validateWorkflowCloudFilesTx(tx *gorm.DB, userID string, chunks ...json.RawMessage) error {
	ids := collectCloudFileIDsFromChunks(chunks...)
	for id := range ids {
		var total int64
		if err := tx.Model(&model.CloudFile{}).Where("id = ? AND user_id = ?", id, userID).Count(&total).Error; err != nil {
			return err
		}
		if total == 0 {
			return safeMessageError{message: "工作流引用了无权限访问的云端文件"}
		}
	}
	return nil
}

func bindWorkflowCloudFiles(userID string, workflowID string, chunks ...json.RawMessage) error {
	db, err := repository.DB()
	if err != nil {
		return err
	}
	return bindWorkflowCloudFilesTx(db, userID, workflowID, chunks...)
}

func bindWorkflowCloudFilesTx(tx *gorm.DB, userID string, workflowID string, chunks ...json.RawMessage) error {
	ids := collectCloudFileIDsFromChunks(chunks...)
	if len(ids) == 0 {
		return nil
	}
	return tx.Model(&model.CloudFile{}).Where("id IN ? AND user_id = ? AND deleted_at = ?", mapKeys(ids), userID, "").Updates(map[string]any{
		"purpose":     model.CloudFilePurposeWorkflow,
		"workflow_id": workflowID,
		"history_id":  "",
		"expires_at":  "",
		"updated_at":  now(),
	}).Error
}

func collectCloudFileIDsFromChunks(chunks ...json.RawMessage) map[string]bool {
	ids := map[string]bool{}
	for _, chunk := range chunks {
		var value any
		if len(chunk) == 0 || json.Unmarshal(chunk, &value) != nil {
			continue
		}
		collectCloudFileIDs(value, ids)
	}
	return ids
}

func collectCloudFileIDs(value any, ids map[string]bool) {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			if (key == "cloudFileId" || key == "cloud_file_id") && fmt.Sprint(item) != "" {
				ids[fmt.Sprint(item)] = true
			}
			if key == "storageKey" {
				text := fmt.Sprint(item)
				if strings.HasPrefix(text, "cloud:") {
					ids[strings.TrimPrefix(text, "cloud:")] = true
				}
			}
			collectCloudFileIDs(item, ids)
		}
	case []any:
		for _, item := range typed {
			collectCloudFileIDs(item, ids)
		}
	}
}

func mapKeys(items map[string]bool) []string {
	result := make([]string, 0, len(items))
	for key := range items {
		if key != "" {
			result = append(result, key)
		}
	}
	return result
}

func pushLinkedShareUpdates(db *gorm.DB, share model.WorkflowShare) error {
	source := model.Workflow{}
	_ = json.Unmarshal(share.Snapshot, &source)
	copies := []model.WorkflowShareCopy{}
	if err := db.Where("share_id = ? AND mode = ?", share.ID, model.WorkflowShareCopyLinked).Find(&copies).Error; err != nil {
		return err
	}
	for _, item := range copies {
		if err := db.Model(&model.Workflow{}).Where("id = ? AND user_id = ? AND deleted_at = ?", item.WorkflowID, item.UserID, "").Updates(map[string]any{
			"nodes":              source.Nodes,
			"connections":        source.Connections,
			"chat_sessions":      source.ChatSessions,
			"active_chat_id":     source.ActiveChatID,
			"background_mode":    source.BackgroundMode,
			"show_image_info":    source.ShowImageInfo,
			"viewport":           source.Viewport,
			"source_version":     share.Version,
			"source_share_id":    share.ID,
			"source_workflow_id": share.SourceWorkflowID,
			"source_sync_mode":   model.WorkflowSyncLinked,
			"updated_at":         now(),
		}).Error; err != nil {
			return err
		}
		_ = db.Model(&model.WorkflowShareCopy{}).Where("id = ?", item.ID).Updates(map[string]any{"source_version": share.Version, "updated_at": now()}).Error
	}
	return nil
}

func findActiveShare(token string) (model.WorkflowShare, error) {
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowShare{}, err
	}
	share := model.WorkflowShare{}
	err = db.Where("token = ? AND status = ?", token, model.WorkflowShareStatusActive).First(&share).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return share, safeMessageError{message: "分享链接不存在或已失效"}
	}
	return share, err
}

func findActiveShareByPath(username string, slug string) (model.WorkflowShare, error) {
	owner, ok, err := repository.GetUserByUsername(username)
	if err != nil {
		return model.WorkflowShare{}, err
	}
	if !ok {
		return model.WorkflowShare{}, safeMessageError{message: "分享链接不存在或已失效"}
	}
	db, err := repository.DB()
	if err != nil {
		return model.WorkflowShare{}, err
	}
	workflow := model.Workflow{}
	err = db.Where("user_id = ? AND slug = ? AND deleted_at = ?", owner.ID, slug, "").First(&workflow).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.WorkflowShare{}, safeMessageError{message: "分享链接不存在或已失效"}
	}
	if err != nil {
		return model.WorkflowShare{}, err
	}
	share := model.WorkflowShare{}
	err = db.Where("owner_id = ? AND source_workflow_id = ? AND status = ?", owner.ID, workflow.ID, model.WorkflowShareStatusActive).First(&share).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return share, safeMessageError{message: "分享链接不存在或已失效"}
	}
	return share, err
}

func sharePreviewForUser(share model.WorkflowShare, requiresPassword bool, userID string, includeSnapshot bool) WorkflowSharePreview {
	db, _ := repository.DB()
	workflowSlug := ""
	source := model.Workflow{}
	if db != nil {
		_ = db.Where("id = ?", share.SourceWorkflowID).First(&source).Error
		workflowSlug = source.Slug
	}
	snapshot := json.RawMessage(nil)
	if includeSnapshot {
		snapshot = share.Snapshot
	}
	return WorkflowSharePreview{
		ID:               share.ID,
		Token:            share.Token,
		Title:            share.Title,
		Slug:             workflowSlug,
		Version:          share.Version,
		RequiresPassword: requiresPassword,
		Snapshot:         snapshot,
		Owner:            shareOwner(share.OwnerID),
		SourceWorkflowID: share.SourceWorkflowID,
		StarCount:        shareStarCount(db, share.ID),
		Starred:          userID != "" && shareStarredByUser(db, share.ID, userID),
	}
}

func shareStarCount(db *gorm.DB, shareID string) int64 {
	if db == nil {
		return 0
	}
	var total int64
	_ = db.Model(&model.WorkflowShareStar{}).Where("share_id = ?", shareID).Count(&total).Error
	return total
}

func shareStarredByUser(db *gorm.DB, shareID string, userID string) bool {
	if db == nil || userID == "" {
		return false
	}
	var total int64
	_ = db.Model(&model.WorkflowShareStar{}).Where("share_id = ? AND user_id = ?", shareID, userID).Count(&total).Error
	return total > 0
}

func workflowShareURL(r *http.Request, username string, slug string) string {
	return RequestOrigin(r) + "/" + username + "/" + slug
}

func workflowShareSummary(share model.WorkflowShare) WorkflowShareSummary {
	return WorkflowShareSummary{
		ID:               share.ID,
		Token:            share.Token,
		Title:            share.Title,
		Version:          share.Version,
		PasswordEnabled:  share.PasswordEnabled,
		SourceWorkflowID: share.SourceWorkflowID,
		UpdatedAt:        share.UpdatedAt,
	}
}

func communityPreview(post model.WorkflowCommunityPost) WorkflowCommunityPreview {
	return WorkflowCommunityPreview{
		ID:               post.ID,
		Token:            post.Token,
		Title:            post.Title,
		Locale:           post.Locale,
		Tags:             decodeStringList(post.Tags),
		Snapshot:         post.Snapshot,
		Owner:            shareOwner(post.UserID),
		SourceWorkflowID: post.SourceWorkflowID,
		UpdatedAt:        post.UpdatedAt,
	}
}

func shareOwner(ownerID string) model.AuthUser {
	user, ok, _ := repository.GetUserByID(ownerID)
	if !ok {
		return model.AuthUser{ID: ownerID}
	}
	return model.PublicUser(user)
}

func normalizedCommunityTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return "未命名社区作品"
	}
	return title
}

func normalizedCommunityLocale(locale string) string {
	switch strings.TrimSpace(locale) {
	case "en-US":
		return "en-US"
	default:
		return "zh-CN"
	}
}

func normalizedCommunityTags(tags []string) json.RawMessage {
	items := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, item := range tags {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		items = append(items, item)
		if len(items) >= 8 {
			break
		}
	}
	data, _ := json.Marshal(items)
	return data
}

func decodeStringList(raw json.RawMessage) []string {
	items := []string{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &items)
	}
	return items
}

func cleanupExpiredBannedCommunityPosts(db *gorm.DB) error {
	return db.Model(&model.WorkflowCommunityPost{}).
		Where("status = ? AND deleted_at = ? AND banned_at <> ? AND banned_at < ?", model.WorkflowCommunityStatusBanned, "", "", time.Now().AddDate(0, 0, -7).Format(time.RFC3339)).
		Updates(map[string]any{"deleted_at": now(), "updated_at": now()}).Error
}

func communityJSONTagsContains(db *gorm.DB) string {
	switch db.Dialector.Name() {
	case "mysql":
		return "JSON_CONTAINS(tags, JSON_QUOTE(?))"
	case "postgres":
		return "jsonb_exists(tags::jsonb, ?)"
	default:
		return "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)"
	}
}

func newShareAccessToken(userID string, share model.WorkflowShare) (string, error) {
	claims := shareAccessClaims{
		ShareID: share.ID,
		Token:   share.Token,
		UserID:  userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   share.ID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.Cfg.JWTSecret))
}

func validShareAccessToken(userID string, share model.WorkflowShare, tokenText string) bool {
	if strings.TrimSpace(tokenText) == "" {
		return false
	}
	claims := shareAccessClaims{}
	token, err := jwt.ParseWithClaims(tokenText, &claims, func(token *jwt.Token) (any, error) {
		return []byte(config.Cfg.JWTSecret), nil
	})
	return err == nil && token.Valid && claims.UserID == userID && claims.ShareID == share.ID && claims.Token == share.Token
}

func mustRandomToken(size int) string {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return base64.RawURLEncoding.EncodeToString([]byte(uuid.NewString()))
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func copyTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "未命名工作流"
	}
	return title + " 副本"
}

func hmacSHA256Hex(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return fmt.Sprintf("%x", mac.Sum(nil))
}
