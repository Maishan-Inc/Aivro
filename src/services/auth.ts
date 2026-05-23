import type { Env, Provider } from '../types';
import { newId, sha256Hex, now } from '../utils/ids';
import { providerPriority } from './oauth';
import { isAdminEmail } from './session';

const STATE_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const STATE_COOKIE_NAME = 'efi_oauth_state';
const SESSION_COOKIE_NAME = 'efi_session';

function bytesToBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const raw = atob(b64);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

async function hmacVerify(secret: string, payload: string, signatureB64Url: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signatureB64Url),
    new TextEncoder().encode(payload)
  );
}

function requireSessionSecret(env: Env): string {
  const secret = env.APP_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('APP_SESSION_SECRET is missing or too short');
  }
  return secret;
}

export interface OAuthStatePayload {
  provider: 'google' | 'linuxdo';
  nonce: string;
  expiresAt: number;
}

export async function signOAuthState(env: Env, provider: 'google' | 'linuxdo'): Promise<{
  state: string;
  cookie: string;
}> {
  const secret = requireSessionSecret(env);
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const expiresAt = now() + STATE_TTL_SECONDS;
  const payload = `${provider}.${nonce}.${expiresAt}`;
  const signature = await hmacSign(secret, payload);
  const cookieValue = `${payload}.${signature}`;

  const cookie = [
    `${STATE_COOKIE_NAME}=${cookieValue}`,
    'Path=/',
    `Max-Age=${STATE_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');

  return { state: nonce, cookie };
}

export async function verifyOAuthState(
  env: Env,
  provider: 'google' | 'linuxdo',
  cookieValue: string | undefined,
  stateFromQuery: string | undefined
): Promise<boolean> {
  if (!cookieValue || !stateFromQuery) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 4) return false;
  const [p, nonce, expiresAtRaw, signature] = parts;
  if (p !== provider) return false;
  if (nonce !== stateFromQuery) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now()) return false;

  const payload = `${p}.${nonce}.${expiresAtRaw}`;
  const secret = requireSessionSecret(env);
  return hmacVerify(secret, payload, signature);
}

export function clearOAuthStateCookie(): string {
  return `${STATE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(env: Env, userId: string): Promise<{ token: string; cookie: string; expiresAt: number }> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64Url(tokenBytes);
  const tokenHash = await sha256Hex(token);
  const expiresAt = now() + SESSION_TTL_SECONDS;

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(newId('sess'), userId, tokenHash, expiresAt, now()).run();

  const cookie = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');

  return { token, cookie, expiresAt };
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(`
    UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL
  `).bind(now(), tokenHash).run();
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export interface OAuthUserProfile {
  providerUserId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  raw: Record<string, unknown>;
}

export async function upsertUserFromOAuth(
  env: Env,
  provider: Extract<Provider, 'google' | 'linuxdo'>,
  profile: OAuthUserProfile
): Promise<{ userId: string }> {
  const ts = now();
  const isAdmin = isAdminEmail(env.ADMIN_BOOTSTRAP_EMAILS, profile.email);
  const role: 'admin' | 'user' = isAdmin ? 'admin' : 'user';
  const priority = isAdmin ? providerPriority('admin') : providerPriority(provider);
  const profileJson = JSON.stringify(profile.raw ?? {});

  const existing = await env.DB.prepare(`
    SELECT id, user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ? LIMIT 1
  `).bind(provider, profile.providerUserId).first<{ id: string; user_id: string }>();

  if (existing) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE users
        SET email = COALESCE(?, email),
            name = COALESCE(?, name),
            avatar_url = COALESCE(?, avatar_url),
            role = ?,
            priority = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        profile.email ?? null,
        profile.name ?? null,
        profile.avatarUrl ?? null,
        role,
        priority,
        ts,
        existing.user_id
      ),
      env.DB.prepare(`
        UPDATE oauth_accounts
        SET email = ?, profile_json = ?, updated_at = ?
        WHERE id = ?
      `).bind(profile.email ?? null, profileJson, ts, existing.id)
    ]);
    return { userId: existing.user_id };
  }

  const userId = newId('usr');
  const oauthId = newId('oa');
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (id, email, name, avatar_url, priority, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      userId,
      profile.email ?? null,
      profile.name ?? null,
      profile.avatarUrl ?? null,
      priority,
      role,
      ts,
      ts
    ),
    env.DB.prepare(`
      INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, profile_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(oauthId, userId, provider, profile.providerUserId, profile.email ?? null, profileJson, ts, ts)
  ]);

  return { userId };
}

export const OAUTH_STATE_COOKIE_NAME = STATE_COOKIE_NAME;
export const SESSION_COOKIE = SESSION_COOKIE_NAME;
