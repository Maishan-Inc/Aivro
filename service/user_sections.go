package service

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func CheckSectionAccess(user model.AuthUser, section model.UserSection) error {
	if slices.Contains(user.DisabledSections, section) {
		return safeMessageError{message: "该区块访问已被管理员禁用"}
	}
	return nil
}

func generationSection(path string) model.UserSection {
	switch {
	case strings.HasPrefix(path, "/images/"):
		return model.UserSectionImage
	case strings.HasPrefix(path, "/videos"):
		return model.UserSectionVideo
	case strings.HasPrefix(path, "/model-3d/"):
		return model.UserSectionModel3D
	}
	return ""
}

func SaveUserSections(id string, sections []model.UserSection) (model.User, error) {
	valid := []model.UserSection{model.UserSectionWorkflow, model.UserSectionImage, model.UserSectionVideo, model.UserSectionModel3D, model.UserSectionShares, model.UserSectionCommunity}
	for _, section := range sections {
		if !slices.Contains(valid, section) {
			return model.User{}, safeMessageError{message: "区块权限无效"}
		}
	}
	value, err := json.Marshal(append([]model.UserSection{}, sections...))
	if err != nil {
		return model.User{}, err
	}
	user, err := repository.UpdateUser(id, map[string]any{"disabled_sections": string(value), "updated_at": now()})
	user.Password = ""
	return user, err
}
