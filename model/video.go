package model

const (
	VideoAdapterKling = "gptge-kling"
	VideoAdapterJimeng = "gptge-jimeng"
	VideoAdapterBailian = "gptge-bailian"
	VideoAdapterVidu = "gptge-vidu"
	VideoAdapterSeedance = "gptge-seedance"
	VideoAdapterArkSeedance = "ark-seedance"
	VideoAdapterHailuo = "gptge-hailuo"
	VideoAdapterFalVeo = "fal-veo"
	VideoAdapterFalGrok = "fal-grok"
	VideoAdapterFalWan = "fal-wan"
	VideoAdapterFalKling = "fal-kling"
)

func IsVideoAdapter(adapter string) bool {
	switch adapter {
	case VideoAdapterKling, VideoAdapterJimeng, VideoAdapterBailian, VideoAdapterVidu, VideoAdapterSeedance, VideoAdapterArkSeedance, VideoAdapterHailuo, VideoAdapterFalVeo, VideoAdapterFalGrok, VideoAdapterFalWan, VideoAdapterFalKling:
		return true
	}
	return false
}
