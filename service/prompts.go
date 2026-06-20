package service

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/basketikun/aivro/model"
	"github.com/basketikun/aivro/repository"
)

const publicPromptCacheTTL = 5 * time.Minute

type publicPromptCacheItem struct {
	Value     model.PromptList
	ExpiresAt time.Time
}

var publicPromptCache = struct {
	sync.RWMutex
	items map[string]publicPromptCacheItem
}{items: map[string]publicPromptCacheItem{}}

func ListPrompts(q model.Query) (model.PromptList, error) {
	items, total, err := repository.ListPrompts(q)
	if err != nil {
		return model.PromptList{}, err
	}
	items = applyPromptImageProxy(items, promptImageProxyEnabled())
	tags, err := repository.ListPromptTags(q)
	if err != nil {
		return model.PromptList{}, err
	}
	categories := promptCategoryCodes(ListPromptCategories())
	return model.PromptList{Items: items, Tags: tags, Categories: categories, Total: int(total)}, nil
}

func ListPublicPrompts(q model.Query) (model.PromptList, error) {
	q.Normalize()
	key := publicPromptCacheKey(q)
	now := time.Now()
	publicPromptCache.RLock()
	cached, ok := publicPromptCache.items[key]
	publicPromptCache.RUnlock()
	if ok && now.Before(cached.ExpiresAt) {
		return cached.Value, nil
	}
	result, err := ListPrompts(q)
	if err != nil {
		return model.PromptList{}, err
	}
	publicPromptCache.Lock()
	publicPromptCache.items[key] = publicPromptCacheItem{Value: result, ExpiresAt: now.Add(publicPromptCacheTTL)}
	publicPromptCache.Unlock()
	return result, nil
}

func ClearPublicPromptCache() {
	publicPromptCache.Lock()
	publicPromptCache.items = map[string]publicPromptCacheItem{}
	publicPromptCache.Unlock()
}

func ListPromptCategories() []model.PromptCategory {
	categories, _ := repository.ListPromptCategories()
	return categories
}

func SavePrompt(item model.Prompt) (model.Prompt, error) {
	now := time.Now().Format(time.RFC3339)
	if item.Category == "" {
		item.Category = repository.PromptCategories()[0].Category
	}
	if item.ID == "" {
		item.ID = newID(item.Category)
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	category, ok := repository.PromptCategoryByCode(item.Category)
	if !ok {
		category = repository.PromptCategories()[0]
		item.Category = category.Category
	}
	item.GithubURL = ""
	item.CoverURL = applyGithubRawProxy(item.CoverURL, promptImageProxyEnabled())
	item.Preview = applyGithubRawProxy(item.Preview, promptImageProxyEnabled())
	result, err := repository.SavePrompt(item)
	if err == nil {
		ClearPublicPromptCache()
	}
	return result, err
}

func DeletePrompt(id string) error {
	err := repository.DeletePrompt(id)
	if err == nil {
		ClearPublicPromptCache()
	}
	return err
}

func DeletePrompts(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	err := repository.DeletePrompts(ids)
	if err == nil {
		ClearPublicPromptCache()
	}
	return err
}

func promptCategoryCodes(items []model.PromptCategory) []string {
	codes := []string{}
	for _, item := range items {
		if item.Category != "" {
			codes = append(codes, item.Category)
		}
	}
	return codes
}

func publicPromptCacheKey(q model.Query) string {
	tags := append([]string{}, q.Tags...)
	sort.Strings(tags)
	return fmt.Sprintf("k=%s|c=%s|t=%s|p=%d|s=%d", q.Keyword, q.Category, strings.Join(tags, ","), q.Page, q.PageSize)
}
