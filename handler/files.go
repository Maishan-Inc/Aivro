package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func RetainAssetFiles(w http.ResponseWriter, r *http.Request, id string) {
	user, _ := service.UserFromContext(r.Context())
	var input struct { FileIDs []string `json:"fileIds"` }
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "素材文件参数无效")
		return
	}
	assetID, err := service.RetainAssetFiles(user.ID, id, input.FileIDs)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, assetID)
}

func ReleaseAssetFiles(w http.ResponseWriter, r *http.Request, id string) {
	user, _ := service.UserFromContext(r.Context())
	if err := service.ReleaseAssetFiles(user.ID, id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func UploadAvatar(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.CheckUploadRateLimit(user.ID); err != nil { FailError(w, err); return }
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		Fail(w, "请选择头像图片，文件不能超过 5MB")
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, _, err := r.FormFile("file")
	if err != nil {
		Fail(w, "请选择头像图片")
		return
	}
	defer file.Close()
	result, err := service.UploadUserAvatar(r.Context(), user, file)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func UploadFile(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	if err := service.CheckUploadRateLimit(user.ID); err != nil { FailError(w, err); return }
	r.Body = http.MaxBytesReader(w, r.Body, 51<<20)
	reader, err := r.MultipartReader()
	if err != nil {
		Fail(w, "请选择文件")
		return
	}
	var result service.StoredFileResult
	found := false
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			Fail(w, "读取文件失败")
			return
		}
		if part.FormName() != "file" {
			_ = part.Close()
			continue
		}
		found = true
		result, err = service.StoreUserFileReader(r.Context(), user, part.FileName(), part, part.Header.Get("Content-Type"), "/files", model.CloudFilePurposeTemp)
		_ = part.Close()
		if err != nil {
			FailError(w, err)
			return
		}
		break
	}
	if !found {
		Fail(w, "请选择文件")
		return
	}
	OK(w, result)
}

func FileContent(w http.ResponseWriter, r *http.Request, id string) {
	user, _ := service.UserFromContext(r.Context())
	file, content, err := service.GetFileContent(r.Context(), user, id, r.URL.Query().Get("accessToken"))
	if err != nil {
		FailError(w, err)
		return
	}
	defer content.Close()
	copyResponseHeaders(w, http.Header{"Content-Type": []string{file.ContentType}})
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate")
	w.Header().Set("CDN-Cache-Control", "no-store")
	w.Header().Set("Surrogate-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	_, _ = io.Copy(w, content)
}
