package service

import (
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/basketikun/aivro/model"
)

var pixelSizePattern = regexp.MustCompile(`^(\d+)x(\d+)$`)
var imageResolutionPixels = map[string]int{"1k": 1024, "2k": 2048, "4k": 4096, "8k": 8192}
var videoResolutionPixels = map[string]int{"480p": 854, "720p": 1280, "768p": 1366, "1080p": 1920, "1440p": 2560, "4k": 3840}

func normalizeModelResolutions(item model.ModelCost, mapping model.ModelChannelModel) model.ModelCost {
	var allowed, defaults []string
	switch mapping.Capability {
	case "image":
		allowed, defaults = []string{"1k", "2k", "4k", "8k"}, []string{"1k", "2k", "4k"}
	case "video":
		allowed = []string{"480p", "720p", "768p", "1080p", "1440p", "4k"}
		caps, err := videoCapabilities(ModelChannelRoute{Adapter: mapping.Adapter, UpstreamModel: mapping.UpstreamName})
		if err == nil { defaults = caps.Resolutions } else { defaults = []string{"720p"} }
	default:
		item.Resolutions = nil
		return item
	}
	if item.Resolutions == nil { item.Resolutions = defaults }
	values := []string{}
	for _, value := range item.Resolutions {
		value = strings.ToLower(strings.TrimSpace(value))
		if slices.Contains(allowed, value) && !slices.Contains(values, value) { values = append(values, value) }
	}
	item.Resolutions = values
	return item
}

func maxResolutionPixels(values []string, pixels map[string]int) int {
	limit := 0
	for _, value := range values { limit = max(limit, pixels[value]) }
	return limit
}

func validatePixelSize(size string, limit int) error {
	match := pixelSizePattern.FindStringSubmatch(size)
	if match == nil { return SafeAIError("请使用有效的像素尺寸") }
	width, widthErr := strconv.Atoi(match[1])
	height, heightErr := strconv.Atoi(match[2])
	if widthErr != nil || heightErr != nil || width < 1 || height < 1 || width > limit || height > limit { return SafeAIError("宽高不能超过模型配置的分辨率上限") }
	return nil
}

func ValidateImageResolution(parameters map[string]any, resolutions []string) error {
	value, exists := parameters["size"]
	if !exists { return nil }
	size, ok := value.(string)
	if !ok { return SafeAIError("请使用有效的像素尺寸") }
	size = strings.TrimSpace(size)
	if size == "" || size == "auto" { return nil }
	if slices.Contains([]string{"1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"}, size) { return nil }
	return validatePixelSize(size, maxResolutionPixels(resolutions, imageResolutionPixels))
}

func ValidateImageRequest(modelName string, body []byte, contentType string) error {
	parameters, err := ReadAIRequestParameters(body, contentType)
	if err != nil { return err }
	billing, err := ModelBilling(modelName)
	if err != nil { return err }
	return ValidateImageResolution(parameters, billing.Resolutions)
}
