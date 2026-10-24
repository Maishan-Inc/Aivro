package service

import (
	"strings"

	"github.com/basketikun/aivro/model"
)

// vendorProfile 内置厂商目录，用于模型计费表自动识别厂商名称和品牌图标。
type vendorProfile struct {
	Name   string
	Icon   string
	Tokens []string
}

// modelVendorCatalog 顺序即匹配优先级，更具体的厂商关键词放在前面。
var modelVendorCatalog = []vendorProfile{
	{Name: "OpenAI", Icon: "openai.svg", Tokens: []string{"gpt", "dall-e", "dalle", "sora", "openai", "whisper"}},
	{Name: "Anthropic", Icon: "claude.svg", Tokens: []string{"claude", "anthropic", "sonnet", "opus", "haiku"}},
	{Name: "Google", Icon: "gemini.svg", Tokens: []string{"gemini", "imagen", "veo", "palm", "google"}},
	{Name: "Google", Icon: "nanobanana.svg", Tokens: []string{"nano-banana", "nanobanana"}},
	{Name: "xAI", Icon: "grok.svg", Tokens: []string{"grok", "xai"}},
	{Name: "DeepSeek", Icon: "deepseek.svg", Tokens: []string{"deepseek"}},
	{Name: "智谱 AI", Icon: "glm.svg", Tokens: []string{"glm", "cogview", "cogvideo", "chatglm", "zhipu"}},
	{Name: "字节跳动", Icon: "bytedance.svg", Tokens: []string{"seedance", "seedream", "doubao", "bytedance", "jimeng", "即梦"}},
	{Name: "快手", Icon: "kling.svg", Tokens: []string{"kling", "kuaishou", "可灵"}},
	{Name: "腾讯", Icon: "hunyuan.svg", Tokens: []string{"hunyuan", "混元"}},
	{Name: "Black Forest Labs", Icon: "flux.svg", Tokens: []string{"flux"}},
	{Name: "Meta", Icon: "meta.svg", Tokens: []string{"llama", "meta", "muse", "sam-3d", "sam3d"}},
	{Name: "Microsoft", Icon: "microsoft.svg", Tokens: []string{"mai-image", "trellis", "microsoft", "phi-"}},
	{Name: "腾讯 ARC", Icon: "tencent.svg", Tokens: []string{"instantmesh", "arc"}},
	{Name: "Meshy", Icon: "meshy.svg", Tokens: []string{"meshy"}},
	{Name: "404-GEN", Icon: "404gen.svg", Tokens: []string{"404_gen", "404-gen", "404gen"}},
	{Name: "Reve", Icon: "reve.svg", Tokens: []string{"reve"}},
	{Name: "UniLat3D", Icon: "unilat3d.png", Tokens: []string{"unilat"}},
	{Name: "造好物", Icon: "zaohao.jpeg", Tokens: []string{"zaohao", "造好物"}},
	{Name: "Midjourney", Icon: "", Tokens: []string{"midjourney", "mj-"}},
	{Name: "Stability AI", Icon: "", Tokens: []string{"stable-diffusion", "sdxl", "stability"}},
	{Name: "阿里云", Icon: "", Tokens: []string{"qwen", "wanx", "tongyi", "通义"}},
	{Name: "MiniMax", Icon: "", Tokens: []string{"minimax", "hailuo", "海螺"}},
	{Name: "Runway", Icon: "", Tokens: []string{"runway", "gen-3", "gen-4"}},
	{Name: "Luma", Icon: "", Tokens: []string{"luma", "dream-machine", "ray-2"}},
	{Name: "Pika", Icon: "", Tokens: []string{"pika"}},
	{Name: "Ideogram", Icon: "", Tokens: []string{"ideogram"}},
	{Name: "Recraft", Icon: "", Tokens: []string{"recraft"}},
	{Name: "CSM", Icon: "", Tokens: []string{"picgen3d", "csm"}},
}

// guessModelVendor 按模型名关键词识别厂商名称和图标，识别不到时返回空值由调用方保留原配置。
func guessModelVendor(modelName string) (string, string) {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if name == "" {
		return "", ""
	}
	for _, profile := range modelVendorCatalog {
		for _, token := range profile.Tokens {
			if strings.Contains(name, token) {
				return profile.Name, profile.Icon
			}
		}
	}
	return "", ""
}

// normalizeModelCostPricing 补齐套餐专属价、API 价和厂商信息。
func normalizeModelCostPricing(item model.ModelCost) model.ModelCost {
	plans := make(map[string]int, len(model.PlanPricingCodes))
	for _, code := range model.PlanPricingCodes {
		if value, ok := item.PlanCredits[code]; ok && value > 0 {
			plans[code] = value
		}
	}
	item.PlanCredits = plans

	if vendor, icon := guessModelVendor(item.Model); vendor != "" {
		item.Vendor = vendor
		if strings.TrimSpace(item.Icon) == "" && icon != "" {
			item.Icon = "/icons/" + icon
		}
	}
	item.Vendor = strings.TrimSpace(item.Vendor)
	item.Icon = strings.TrimSpace(item.Icon)
	// 图标统一存成可直接访问的路径，内置目录只登记文件名。
	if item.Icon != "" && !strings.HasPrefix(item.Icon, "/") && !strings.HasPrefix(item.Icon, "http") {
		item.Icon = "/icons/" + item.Icon
	}

	if item.APICredits < 0 {
		item.APICredits = 0
	}
	if item.ApiMultiplier <= 0 {
		item.ApiMultiplier = model.DefaultAPIMultiplier
	}
	if item.APIBilling != model.BillingTypeToken && item.APIBilling != model.BillingTypeFixed {
		item.APIBilling = item.BillingType
	}
	return item
}
