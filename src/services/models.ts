import type { Env } from '../types';
import { encryptSecret, decryptSecret, maskSecret } from './crypto';
import { newId, now } from '../utils/ids';

export interface ModelRow {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  api_key_encrypted: string;
  api_key_iv: string;
  api_key_masked: string;
  supported_sizes: string;
  supported_qualities: string;
  default_size: string;
  default_quality: string;
  is_default: number;
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface ModelPublic {
  id: string;
  name: string;
  displayName: string;
  supportedSizes: string[];
  supportedQualities: string[];
  defaultSize: string;
  defaultQuality: string;
  isDefault: boolean;
}

export interface CreateModelInput {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  supportedSizes?: string;
  supportedQualities?: string;
  defaultSize?: string;
  defaultQuality?: string;
  isDefault?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpdateModelInput {
  name?: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  supportedSizes?: string;
  supportedQualities?: string;
  defaultSize?: string;
  defaultQuality?: string;
  isDefault?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}

export async function listAllModels(env: Env): Promise<ModelRow[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM models ORDER BY sort_order ASC, created_at ASC'
  ).all<ModelRow>();
  return result.results ?? [];
}

export async function listEnabledModels(env: Env): Promise<ModelPublic[]> {
  const result = await env.DB.prepare(
    'SELECT id, name, display_name, supported_sizes, supported_qualities, default_size, default_quality, is_default FROM models WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC'
  ).all<ModelRow>();
  return (result.results ?? []).map(toPublic);
}

export async function getModelById(env: Env, id: string): Promise<ModelRow | null> {
  return env.DB.prepare('SELECT * FROM models WHERE id = ?').bind(id).first<ModelRow>();
}

export async function getDefaultModel(env: Env): Promise<ModelRow | null> {
  return env.DB.prepare('SELECT * FROM models WHERE is_default = 1 AND enabled = 1 LIMIT 1').first<ModelRow>();
}

export async function getFirstEnabledModel(env: Env): Promise<ModelRow | null> {
  return env.DB.prepare('SELECT * FROM models WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1').first<ModelRow>();
}

export async function decryptModelApiKey(env: Env, model: ModelRow): Promise<string> {
  if (!env.APP_CONFIG_ENCRYPTION_KEY) {
    throw new Error('APP_CONFIG_ENCRYPTION_KEY is required to decrypt model API key');
  }
  return decryptSecret(model.api_key_encrypted, model.api_key_iv, env.APP_CONFIG_ENCRYPTION_KEY);
}

export async function createModel(env: Env, input: CreateModelInput): Promise<ModelRow> {
  if (!env.APP_CONFIG_ENCRYPTION_KEY) {
    throw new Error('APP_CONFIG_ENCRYPTION_KEY is required to encrypt model API key');
  }
  const id = newId('mdl');
  const ts = now();
  const encrypted = await encryptSecret(input.apiKey, env.APP_CONFIG_ENCRYPTION_KEY);
  const masked = maskSecret(input.apiKey);

  if (input.isDefault) {
    await env.DB.prepare('UPDATE models SET is_default = 0 WHERE is_default = 1').run();
  }

  await env.DB.prepare(`
    INSERT INTO models (id, name, display_name, base_url, api_key_encrypted, api_key_iv, api_key_masked,
      supported_sizes, supported_qualities, default_size, default_quality,
      is_default, enabled, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.name,
    input.displayName,
    input.baseUrl,
    encrypted.encryptedValue,
    encrypted.iv,
    masked,
    input.supportedSizes ?? '1024x1024,1024x1536,1536x1024',
    input.supportedQualities ?? 'auto,high,medium',
    input.defaultSize ?? '1024x1024',
    input.defaultQuality ?? 'auto',
    input.isDefault ? 1 : 0,
    input.enabled !== false ? 1 : 0,
    input.sortOrder ?? 0,
    ts,
    ts
  ).run();

  return (await getModelById(env, id))!;
}

export async function updateModel(env: Env, id: string, input: UpdateModelInput): Promise<ModelRow | null> {
  const existing = await getModelById(env, id);
  if (!existing) return null;

  const ts = now();
  let apiKeyEncrypted = existing.api_key_encrypted;
  let apiKeyIv = existing.api_key_iv;
  let apiKeyMasked = existing.api_key_masked;

  if (input.apiKey) {
    if (!env.APP_CONFIG_ENCRYPTION_KEY) {
      throw new Error('APP_CONFIG_ENCRYPTION_KEY is required to encrypt model API key');
    }
    const encrypted = await encryptSecret(input.apiKey, env.APP_CONFIG_ENCRYPTION_KEY);
    apiKeyEncrypted = encrypted.encryptedValue;
    apiKeyIv = encrypted.iv;
    apiKeyMasked = maskSecret(input.apiKey);
  }

  if (input.isDefault) {
    await env.DB.prepare('UPDATE models SET is_default = 0 WHERE is_default = 1').run();
  }

  await env.DB.prepare(`
    UPDATE models SET
      name = ?, display_name = ?, base_url = ?,
      api_key_encrypted = ?, api_key_iv = ?, api_key_masked = ?,
      supported_sizes = ?, supported_qualities = ?,
      default_size = ?, default_quality = ?,
      is_default = ?, enabled = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    input.name ?? existing.name,
    input.displayName ?? existing.display_name,
    input.baseUrl ?? existing.base_url,
    apiKeyEncrypted,
    apiKeyIv,
    apiKeyMasked,
    input.supportedSizes ?? existing.supported_sizes,
    input.supportedQualities ?? existing.supported_qualities,
    input.defaultSize ?? existing.default_size,
    input.defaultQuality ?? existing.default_quality,
    input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : existing.is_default,
    input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled,
    input.sortOrder ?? existing.sort_order,
    ts,
    id
  ).run();

  return getModelById(env, id);
}

export async function deleteModel(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare('DELETE FROM models WHERE id = ?').bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

function toPublic(row: ModelRow): ModelPublic {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    supportedSizes: row.supported_sizes.split(',').map((s) => s.trim()).filter(Boolean),
    supportedQualities: row.supported_qualities.split(',').map((s) => s.trim()).filter(Boolean),
    defaultSize: row.default_size,
    defaultQuality: row.default_quality,
    isDefault: row.is_default === 1,
  };
}
