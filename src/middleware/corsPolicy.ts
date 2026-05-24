import type { Context, MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from '../types';
import { getSetting } from '../services/config';

interface AllowedOriginsCache {
  values: Set<string>;
  expiresAt: number;
}

let originsCache: AllowedOriginsCache | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function loadAllowedOrigins(env: AppContext['Bindings']): Promise<Set<string>> {
  const now = Date.now();
  if (originsCache && now < originsCache.expiresAt) return originsCache.values;

  const raw = await getSetting(env, 'SECURITY_ALLOWED_ORIGINS', '');
  const values = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
  originsCache = { values, expiresAt: now + CACHE_TTL_MS };
  return values;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * CORS middleware that allows:
 * - Same-origin requests (request URL origin matches the Origin header)
 * - Origins explicitly listed in SECURITY_ALLOWED_ORIGINS (comma-separated, cached 3 min)
 *
 * credentials: true is set, so the response always echoes a single concrete Origin
 * (never '*'), which is the only legal combination for cookie-bearing requests.
 */
export function corsPolicy(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const allowed = await loadAllowedOrigins(c.env);
    const selfOrigin = safeOrigin(c.req.url);

    return cors({
      origin: (origin) => {
        if (!origin) return null;
        if (selfOrigin && origin === selfOrigin) return origin;
        if (allowed.has(origin)) return origin;
        return null;
      },
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })(c as Context<AppContext>, next);
  };
}
