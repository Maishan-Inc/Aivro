package service

import (
	"mime"
	"net/http"
)

// SafeResponseHeaders deliberately excludes upstream cookies, redirects and policies.
func SafeResponseHeaders(header http.Header) http.Header {
	result := http.Header{}
	for _, key := range []string{"X-Request-Id", "Retry-After"} {
		if value := header.Get(key); value != "" { result.Set(key, value) }
	}
	contentType, _, _ := mime.ParseMediaType(header.Get("Content-Type"))
	switch contentType {
	case "application/json", "text/event-stream", "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "model/gltf-binary", "model/gltf+json":
		result.Set("Content-Type", contentType)
	default:
		result.Set("Content-Type", "application/octet-stream")
		result.Set("Content-Disposition", `attachment; filename="download.bin"`)
	}
	result.Set("X-Content-Type-Options", "nosniff")
	result.Set("Cache-Control", "no-store")
	return result
}
