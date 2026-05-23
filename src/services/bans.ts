import type { Env } from '../types';
import { now } from '../utils/ids';

export interface BanCheckInput {
  userId?: string;
  email?: string;
  ip?: string;
  deviceId?: string;
}

export interface BanCheckResult {
  banned: boolean;
  reason?: string;
  type?: string;
}

export async function isBanned(env: Env, input: BanCheckInput): Promise<BanCheckResult> {
  const conditions: string[] = [];
  const bindings: string[] = [];

  if (input.userId) {
    conditions.push("(ban_type = 'user_id' AND ban_value = ?)");
    bindings.push(input.userId);
  }
  if (input.email) {
    conditions.push("(ban_type = 'email' AND ban_value = ?)");
    bindings.push(input.email);
  }
  if (input.ip) {
    conditions.push("(ban_type = 'ip' AND ban_value = ?)");
    bindings.push(input.ip);
  }
  if (input.deviceId) {
    conditions.push("(ban_type = 'device_id' AND ban_value = ?)");
    bindings.push(input.deviceId);
  }

  if (conditions.length === 0) return { banned: false };

  const currentTime = now();
  const sql = `
    SELECT ban_type, reason FROM bans
    WHERE (${conditions.join(' OR ')})
      AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 1
  `;
  bindings.push(String(currentTime));

  const stmt = env.DB.prepare(sql);
  const row = await stmt.bind(...bindings).first<{ ban_type: string; reason: string | null }>();

  if (!row) return { banned: false };
  return { banned: true, reason: row.reason ?? undefined, type: row.ban_type };
}
