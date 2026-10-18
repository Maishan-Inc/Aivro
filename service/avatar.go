package service

import (
	"bytes"
	"context"
	"image/png"
	"io"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

func UploadUserAvatar(ctx context.Context, user model.AuthUser, reader io.Reader) (model.AuthUser, error) {
	body, err := io.ReadAll(io.LimitReader(reader, (5<<20)+1))
	if err != nil {
		return model.AuthUser{}, err
	}
	if len(body) > 5<<20 {
		return model.AuthUser{}, safeMessageError{message: "头像不能超过 5MB"}
	}
	config, err := png.DecodeConfig(bytes.NewReader(body))
	if err != nil || config.Width != 512 || config.Height != 512 {
		return model.AuthUser{}, safeMessageError{message: "头像必须是裁剪后的 512 × 512 PNG 图片"}
	}
	image, err := png.Decode(bytes.NewReader(body))
	if err != nil {
		return model.AuthUser{}, safeMessageError{message: "头像图片无效"}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, image); err != nil {
		return model.AuthUser{}, err
	}
	saved, ok, err := repository.GetUserByID(user.ID)
	if err != nil {
		return model.AuthUser{}, err
	}
	if !ok {
		return model.AuthUser{}, safeMessageError{message: "用户不存在"}
	}
	result, err := storeObject(ctx, CloudObjectUpload{User: user, FileType: model.CloudFileTypeImage, Purpose: model.CloudFilePurposeAvatar, Filename: newID("avatar") + ".png", ContentType: "image/png", Source: "/profile/avatar", Body: encoded.Bytes()})
	if err != nil {
		return model.AuthUser{}, err
	}
	saved, err = repository.UpdateUser(saved.ID, map[string]any{"avatar_url": result.PublicURL, "updated_at": now()})
	if err != nil {
		return model.AuthUser{}, err
	}
	return model.PublicUser(saved), nil
}
