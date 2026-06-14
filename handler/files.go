package handler

import (
	"io"
	"net/http"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/service"
)

func UploadFile(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
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
	file, content, err := service.GetFileContent(user, id, r.URL.Query().Get("accessToken"))
	if err != nil {
		FailError(w, err)
		return
	}
	defer content.Close()
	if file.ContentType != "" {
		w.Header().Set("Content-Type", file.ContentType)
	}
	w.Header().Set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate")
	w.Header().Set("CDN-Cache-Control", "no-store")
	w.Header().Set("Surrogate-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	_, _ = io.Copy(w, content)
}
