package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
)

// 专用适配只开放已核对文档的型号和规格；空适配保留通用 /v1/videos 协议。
func videoCapabilities(route ModelChannelRoute) (model.VideoCapabilities, error) {
	c := model.VideoCapabilities{MaxImages: 1, Durations: []int{5}, Resolutions: []string{"720p"}, AspectRatios: []string{"16:9", "9:16", "1:1"}}
	valid := false
	switch route.Adapter {
	case "":
		c.MaxImages, c.Durations, c.Resolutions = 7, videoDurations(1, 20), []string{"720p", "480p", "1080p"}
		return c, nil
	case model.VideoAdapterKling:
		valid = slices.Contains([]string{"kling-v1-5", "kling-v1-6"}, route.UpstreamModel)
	case model.VideoAdapterJimeng:
		valid = slices.Contains([]string{"jimeng_t2v_v30", "jimeng_i2v_first_v30", "jimeng_i2v_first_tail_v30"}, route.UpstreamModel)
		c.MaxImages = 0
		if route.UpstreamModel == "jimeng_i2v_first_v30" { c.MinImages, c.MaxImages = 1, 1 }
		if route.UpstreamModel == "jimeng_i2v_first_tail_v30" { c.MinImages, c.MaxImages = 2, 2 }
	case model.VideoAdapterBailian:
		valid = slices.Contains([]string{"happyhorse-1.1-t2v", "happyhorse-1.1-i2v", "happyhorse-1.1-r2v"}, route.UpstreamModel)
		c.MaxImages = 0
		if strings.HasSuffix(route.UpstreamModel, "-i2v") { c.MinImages, c.MaxImages = 1, 1 }
		if strings.HasSuffix(route.UpstreamModel, "-r2v") { c.MinImages, c.MaxImages = 1, 3 }
	case model.VideoAdapterVidu:
		valid = slices.Contains([]string{"vidu1.5", "vidu2.0", "viduq3-pro"}, route.UpstreamModel)
		c.Durations, c.MaxImages = []int{4}, 0
		if route.UpstreamModel == "vidu2.0" { c.MinImages, c.MaxImages = 1, 3 }
		if route.UpstreamModel == "viduq3-pro" { c.MinImages, c.MaxImages, c.Durations, c.Resolutions = 1, 1, []int{5}, []string{"1080p"} }
	case model.VideoAdapterSeedance:
		valid = route.UpstreamModel == "doubao-seedance-1-5-pro-251215"
		c.MaxImages = 2
	case model.VideoAdapterArkSeedance:
		valid = slices.Contains([]string{"doubao-seedance-2-0-260128", "doubao-seedance-2-0-fast-260128", "doubao-seedance-2-0-mini-260615", "doubao-seedance-2-5-260628"}, route.UpstreamModel)
		c.MaxImages, c.Durations = 2, videoDurations(4, 15)
		if route.UpstreamModel == "doubao-seedance-2-5-260628" { c.Durations = videoDurations(4, 30) }
		c.AspectRatios = []string{"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"}
	case model.VideoAdapterHailuo:
		valid = route.UpstreamModel == "MiniMax-Hailuo-02"
		c.MaxImages, c.Durations, c.Resolutions = 2, []int{6, 10}, []string{"768p", "1080p"}
		c.AspectRatios = []string{"auto"}
	case model.VideoAdapterFalVeo:
		valid = slices.Contains([]string{"fal-ai/veo3.1", "fal-ai/veo3.1/fast"}, route.UpstreamModel)
		c.Durations, c.Resolutions, c.AspectRatios = []int{4, 6, 8}, []string{"720p", "1080p", "4k"}, []string{"16:9", "9:16"}
	case model.VideoAdapterFalGrok:
		valid = route.UpstreamModel == "xai/grok-imagine-video"
		c.Durations, c.Resolutions = videoDurations(1, 15), []string{"720p", "480p"}
		c.AspectRatios = []string{"16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"}
	case model.VideoAdapterFalWan:
		valid = route.UpstreamModel == "wan/v2.6"
		c.Durations, c.Resolutions = []int{5, 10, 15}, []string{"720p", "1080p"}
		c.AspectRatios = []string{"16:9", "9:16", "1:1", "4:3", "3:4"}
	case model.VideoAdapterFalKling:
		valid = route.UpstreamModel == "fal-ai/kling-video/v3/pro"
		c.MaxImages, c.Durations, c.Resolutions = 2, videoDurations(3, 15), []string{"1080p"}
	}
	if !valid { return c, SafeAIError("视频适配方式与上游模型名称不匹配") }
	return c, nil
}

func videoDurations(start, end int) []int {
	items := make([]int, 0, end-start+1)
	for n := start; n <= end; n++ { items = append(items, n) }
	return items
}

func videoPixelSize(ratio, resolution string) string {
	height, _ := strconv.Atoi(strings.TrimSuffix(resolution, "p"))
	if height == 0 { height = 720 }
	parts := strings.Split(ratio, ":")
	w, _ := strconv.Atoi(parts[0]); h, _ := strconv.Atoi(parts[1])
	if w < h { return fmt.Sprintf("%dx%d", height, (height*h/w)/2*2) }
	return fmt.Sprintf("%dx%d", (height*w/h)/2*2, height)
}

func videoProviderRequest(ctx context.Context, route ModelChannelRoute, method, path string, body []byte, contentType string, output any, polling bool) (time.Duration, error) {
	base, err := url.Parse(normalizeModelChannelBaseURL(route.Channel.BaseURL))
	if err != nil { return 0, err }
	base.Path = strings.TrimSuffix(strings.TrimRight(base.Path, "/"), "/v1")
	base.RawPath = ""
	if route.Adapter == model.VideoAdapterArkSeedance { base.Path = strings.TrimSuffix(base.Path, "/api/v3") }
	if strings.HasPrefix(route.Adapter, "fal-") && base.Host == "fal.run" { base.Host = "queue.fal.run" }
	endpointPath, err := url.Parse(path)
	if err != nil { return 0, err }
	endpoint := base.JoinPath(endpointPath.Path)
	endpoint.RawQuery = endpointPath.RawQuery
	failure := "视频生成请求失败"
	if polling { failure = "视频任务查询失败" }
	for {
		request, err := http.NewRequestWithContext(ctx, method, endpoint.String(), bytes.NewReader(body))
		if err != nil { return 0, err }
		scheme := "Bearer "
		if strings.HasPrefix(route.Adapter, "fal-") { scheme = "Key " }
		request.Header.Set("Authorization", scheme+route.Channel.APIKey)
		if len(body) > 0 { request.Header.Set("Content-Type", contentType) }
		response, err := AIHTTPClientForContext(ctx).Do(request)
		delay := 5 * time.Second
		if err != nil {
			if !polling { return 0, SafeAIError(failure) }
			if err := waitModel3D(ctx, delay); err != nil { return 0, err }
			continue
		}
		if seconds, err := strconv.Atoi(response.Header.Get("Retry-After")); err == nil && seconds > 0 { delay = time.Duration(seconds)*time.Second
		} else if retryAt, err := http.ParseTime(response.Header.Get("Retry-After")); err == nil && time.Until(retryAt) > delay { delay = time.Until(retryAt) }
		if polling && (response.StatusCode == 429 || response.StatusCode >= 500) {
			_ = response.Body.Close()
			if err := waitModel3D(ctx, delay); err != nil { return 0, err }
			continue
		}
		payload, readErr := readLimited(response.Body, 4<<20, "视频接口响应过大")
		_ = response.Body.Close()
		if response.StatusCode < 200 || response.StatusCode >= 300 { return 0, SafeAIError(fmt.Sprintf("%s（HTTP %d）", failure, response.StatusCode)) }
		if readErr != nil { return 0, readErr }
		if err := json.Unmarshal(payload, output); err != nil { return 0, SafeAIError("视频接口返回格式错误") }
		return delay, nil
	}
}

func videoJSON(ctx context.Context, route ModelChannelRoute, method, path string, input, output any, polling bool) (time.Duration, error) {
	var body []byte
	var err error
	if input != nil { body, err = json.Marshal(input); if err != nil { return 0, err } }
	return videoProviderRequest(ctx, route, method, path, body, "application/json", output, polling)
}
