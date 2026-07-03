package service

import "testing"

func TestNormalizeScopedModelsKeepsExplicitEmptyScope(t *testing.T) {
	got := normalizeScopedModels([]string{}, []string{"gpt-5.5", "gpt-image-2"}, []string{"gpt-image-2"})
	if len(got) != 0 {
		t.Fatalf("normalizeScopedModels() = %v, want empty scope", got)
	}
}

func TestNormalizeScopedModelsDerivesLegacyNilScope(t *testing.T) {
	got := normalizeScopedModels(nil, []string{"gpt-5.5", "gpt-image-2"}, []string{"gpt-image-2"})
	if len(got) != 1 || got[0] != "gpt-image-2" {
		t.Fatalf("normalizeScopedModels() = %v, want capability scope", got)
	}
}
