const githubRawPrefix = "https://raw.githubusercontent.com/";
const githubRawProxyPrefix = "https://gh-proxy.com/";
const evoLinkOldImagePrefix = "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/images/";
const evoLinkImagePrefix = "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/";

export function promptImageUrl(value: string | undefined) {
    const raw = (value || "").trim();
    if (!raw) return "/logo.svg";
    const normalized = raw.replace(`${githubRawProxyPrefix}${githubRawPrefix}`, githubRawPrefix).replace(evoLinkOldImagePrefix, evoLinkImagePrefix);
    return normalized.startsWith(githubRawPrefix) ? `${githubRawProxyPrefix}${normalized}` : normalized;
}
