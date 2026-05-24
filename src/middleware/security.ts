import type { Context, Next } from 'hono';
import type { AppContext } from '../types';
import { getSetting } from './../services/config';

interface CspCache {
  reportOnly: boolean;
  adsenseEnabled: boolean;
  expiresAt: number;
}

let cspCache: CspCache | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function loadCspFlags(env: AppContext['Bindings']): Promise<{ reportOnly: boolean; adsenseEnabled: boolean }> {
  const now = Date.now();
  if (cspCache && now < cspCache.expiresAt) {
    return { reportOnly: cspCache.reportOnly, adsenseEnabled: cspCache.adsenseEnabled };
  }
  const [reportOnlyRaw, adsRaw] = await Promise.all([
    getSetting(env, 'SECURITY_CSP_REPORT_ONLY', 'false'),
    getSetting(env, 'ADSENSE_ENABLED', env.ADSENSE_ENABLED ?? 'false'),
  ]);
  const next: CspCache = {
    reportOnly: reportOnlyRaw.toLowerCase() === 'true',
    adsenseEnabled: adsRaw.toLowerCase() === 'true',
    expiresAt: now + CACHE_TTL_MS,
  };
  cspCache = next;
  return { reportOnly: next.reportOnly, adsenseEnabled: next.adsenseEnabled };
}

function buildScriptSrc(adsenseEnabled: boolean): string {
  const sources = ["'self'", 'https://challenges.cloudflare.com', 'https://js.hcaptcha.com'];
  if (adsenseEnabled) sources.push('https://pagead2.googlesyndication.com');
  return `script-src ${sources.join(' ')}`;
}

function buildFrameSrc(adsenseEnabled: boolean): string {
  const sources = ['https://challenges.cloudflare.com', 'https://*.hcaptcha.com'];
  if (adsenseEnabled) sources.push('https://googleads.g.doubleclick.net');
  return `frame-src ${sources.join(' ')}`;
}

function buildConnectSrc(adsenseEnabled: boolean): string {
  const sources = ["'self'", 'https://challenges.cloudflare.com', 'https://*.hcaptcha.com'];
  if (adsenseEnabled) sources.push('https://pagead2.googlesyndication.com');
  return `connect-src ${sources.join(' ')}`;
}

function buildCsp(adsenseEnabled: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    "img-src 'self' data: https://*.r2.cloudflarestorage.com https://lh3.googleusercontent.com https://*.linux.do",
    buildScriptSrc(adsenseEnabled),
    buildFrameSrc(adsenseEnabled),
    buildConnectSrc(adsenseEnabled),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join('; ');
}

export async function securityHeaders(c: Context<AppContext>, next: Next) {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  try {
    const { reportOnly, adsenseEnabled } = await loadCspFlags(c.env);
    const csp = buildCsp(adsenseEnabled);
    const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    c.header(headerName, csp);
  } catch (err) {
    // CSP must not block responses on config read failure; emit a safe default.
    console.error('[security] CSP build failed', err);
    c.header('Content-Security-Policy', buildCsp(false));
  }
}
