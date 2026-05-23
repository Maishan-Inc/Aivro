import type { Env } from '../types';
import { getSecret, getSetting, toBool } from './config';

export type CaptchaProvider = 'none' | 'turnstile' | 'hcaptcha';

export interface CaptchaResult {
  ok: boolean;
  provider: CaptchaProvider;
  errorCodes?: string[];
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify';

export async function getCaptchaProvider(env: Env): Promise<CaptchaProvider> {
  const enabled = toBool(await getSetting(env, 'CAPTCHA_ENABLED', 'false'));
  if (!enabled) return 'none';
  const value = (await getSetting(env, 'CAPTCHA_PROVIDER', 'turnstile')).toLowerCase();
  if (value === 'turnstile' || value === 'hcaptcha') return value;
  return 'none';
}

export async function getCaptchaSiteKey(env: Env): Promise<string> {
  return getSetting(env, 'CAPTCHA_SITE_KEY', '');
}

export async function verifyCaptcha(env: Env, token: string | undefined, ip?: string): Promise<CaptchaResult> {
  const provider = await getCaptchaProvider(env);
  if (provider === 'none') return { ok: true, provider };
  if (!token) return { ok: false, provider, errorCodes: ['missing-input-response'] };

  if (provider === 'turnstile') {
    const secret = await getSecret(env, 'TURNSTILE_SECRET_KEY');
    if (!secret) return { ok: false, provider, errorCodes: ['missing-secret'] };
    return verifyAt(TURNSTILE_VERIFY_URL, provider, secret, token, ip);
  }

  const secret = await getSecret(env, 'HCAPTCHA_SECRET_KEY');
  if (!secret) return { ok: false, provider, errorCodes: ['missing-secret'] };
  return verifyAt(HCAPTCHA_VERIFY_URL, provider, secret, token, ip);
}

async function verifyAt(url: string, provider: CaptchaProvider, secret: string, token: string, ip?: string): Promise<CaptchaResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!res.ok) {
      return { ok: false, provider, errorCodes: [`http-${res.status}`] };
    }
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    return {
      ok: Boolean(json.success),
      provider,
      errorCodes: json['error-codes']
    };
  } catch (err) {
    console.error(`[captcha] ${provider} verify failed`, err);
    return { ok: false, provider, errorCodes: ['network-error'] };
  }
}
