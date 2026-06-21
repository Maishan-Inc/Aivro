package service

import "testing"

func TestAbsoluteImageKeepsGithubRawBranchForParentRelativeImage(t *testing.T) {
	got := absoluteImage(gptImage2RawBase, "../../images/poster_case377/output.jpg")
	want := gptImage2RawBase + "/images/poster_case377/output.jpg"
	if got != want {
		t.Fatalf("absoluteImage() = %q, want %q", got, want)
	}
}

func TestApplyGithubRawProxyNormalizesStoredBrokenGptImage2URL(t *testing.T) {
	broken := "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/images/poster_case377/output.jpg"
	want := gptImage2RawBase + "/images/poster_case377/output.jpg"
	if got := applyGithubRawProxy(broken, false); got != want {
		t.Fatalf("applyGithubRawProxy() = %q, want %q", got, want)
	}
}
