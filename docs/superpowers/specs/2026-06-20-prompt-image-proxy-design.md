# Prompt Image Proxy Design

## Scope

- Keep built-in remote sources limited to real image prompt repositories.
- Do not add `itgoyo/awesome-gpt-image2`, because it is a GitHub repository navigation list rather than an image prompt gallery.
- Add a prompt-management switch for China mainland GitHub raw image acceleration.

## Design

- Store the switch under private prompt sync settings as `githubRawProxyEnabled`.
- Expose the switch on `/admin/prompts`, near the prompt management controls.
- When enabled, GitHub raw image URLs are returned as `https://gh-proxy.com/https://raw.githubusercontent.com/...` only for the `zh-CN` public prompt request.
- Other locales, admin pages, and stored prompt records stay on the original GitHub raw URL.
- Apply the conversion only to prompt image fields: `coverUrl` and markdown image URLs in `preview`.

## Notes

- The URL conversion is idempotent, so repeated syncs do not duplicate the proxy prefix.
- Existing prompt records are displayed according to the current switch and locale without requiring a one-time migration.
- Remote sync persists original raw URLs.
