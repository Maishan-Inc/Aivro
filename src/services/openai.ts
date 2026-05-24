export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

interface GenerateImageInput {
  prompt: string;
  size: string;
  quality: string;
}

interface GeneratedImage {
  b64Json?: string;
  url?: string;
  revisedPrompt?: string;
}

export async function generateImage(config: ModelConfig, input: GenerateImageInput): Promise<GeneratedImage> {
  if (!config.apiKey) throw new Error('Model API key is not configured');
  if (!config.baseUrl) throw new Error('Model base URL is not configured');

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.modelName,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image API failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const json = await response.json() as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
  const first = json.data?.[0];
  if (!first) throw new Error('Image API returned no image');
  return { b64Json: first.b64_json, url: first.url, revisedPrompt: first.revised_prompt };
}
