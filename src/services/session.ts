import type { Context, Next } from 'hono';
import type { AppContext, AppUser } from '../types';
import { getCookie } from 'hono/cookie';
import { sha256Hex, now } from '../utils/ids';
import { isBanned } from './bans';

export async function loadUser(c: Context<AppContext>, next: Next) {
  const sid = getCookie(c, 'efi_session');
  if (!sid) return next();

  const tokenHash = await sha256Hex(sid);
  const row = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.priority, u.role, oa.provider
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL
    LIMIT 1
  `).bind(tokenHash, now()).first<{
    id: string;
    email?: string;
    name?: string;
    avatar_url?: string;
    priority: number;
    role: 'user' | 'admin';
    provider?: 'google' | 'linuxdo';
  }>();

  if (row) {
    const banCheck = await isBanned(c.env, {
      userId: row.id,
      email: row.email,
      ip: c.req.header('CF-Connecting-IP') ?? undefined
    });
    if (!banCheck.banned) {
      const user: AppUser = {
        id: row.id,
        email: row.email,
        name: row.name,
        avatarUrl: row.avatar_url,
        provider: row.provider ?? 'guest',
        priority: row.priority,
        role: row.role
      };
      c.set('user', user);
    }
  }

  await next();
}

export function requireUser(c: Context<AppContext>): AppUser | undefined {
  return c.get('user');
}

export function isAdminEmail(envValue: string | undefined, email: string | undefined): boolean {
  if (!envValue || !email) return false;
  return envValue.split(',').map((v) => v.trim().toLowerCase()).includes(email.toLowerCase());
}
