import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppContext } from '../types';
import { fail, ok } from '../utils/response';
import { encryptSecret, maskSecret } from '../services/crypto';
import { newId, now } from '../utils/ids';

export const adminRoutes = new Hono<AppContext>();

adminRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return fail(c, 'ADMIN_REQUIRED', '需要管理员权限。', 403);
  await next();
});

adminRoutes.get('/settings', async (c) => {
  const settings = await c.env.DB.prepare('SELECT key, value, value_type, group_name, description, is_public, updated_at FROM app_settings ORDER BY group_name, key').all();
  const secrets = await c.env.DB.prepare('SELECT key, masked_value, algorithm, updated_at FROM secret_settings ORDER BY key').all();
  return ok(c, { settings: settings.results ?? [], secrets: secrets.results ?? [] });
});

adminRoutes.put('/settings/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json().catch(() => null) as null | { value?: string; valueType?: string; groupName?: string; description?: string; isPublic?: boolean };
  if (!body || body.value === undefined) return fail(c, 'BAD_REQUEST', 'value 不能为空。');

  const priorityKeys = ['QUEUE_PRIORITY_LINUXDO', 'QUEUE_PRIORITY_GOOGLE', 'QUEUE_PRIORITY_GUEST'];
  if (priorityKeys.includes(key)) {
    const n = Number.parseInt(body.value, 10);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      return fail(c, 'INVALID_PRIORITY', '优先级必须是 0-99 的整数。', 400);
    }
  }

  const user = c.get('user')!;
  const old = await c.env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>();
  await c.env.DB.prepare(`
    INSERT INTO app_settings(key, value, value_type, group_name, description, is_public, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      value_type = excluded.value_type,
      group_name = excluded.group_name,
      description = excluded.description,
      is_public = excluded.is_public,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(
    key,
    body.value,
    body.valueType ?? 'string',
    body.groupName ?? 'general',
    body.description ?? null,
    body.isPublic ? 1 : 0,
    user.id,
    now()
  ).run();

  await audit(c, 'setting.update', 'app_setting', key, old?.value ?? null, body.value);
  await reloadQueueConfig(c);
  return ok(c, { key, value: body.value });
});

adminRoutes.put('/secrets/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json().catch(() => null) as null | { value?: string };
  if (!body?.value) return fail(c, 'BAD_REQUEST', 'secret value 不能为空。');
  if (!c.env.APP_CONFIG_ENCRYPTION_KEY) return fail(c, 'MISSING_ENCRYPTION_KEY', 'APP_CONFIG_ENCRYPTION_KEY 未配置。', 500);

  const user = c.get('user')!;
  const encrypted = await encryptSecret(body.value, c.env.APP_CONFIG_ENCRYPTION_KEY);
  const masked = maskSecret(body.value);
  const old = await c.env.DB.prepare('SELECT masked_value FROM secret_settings WHERE key = ?').bind(key).first<{ masked_value: string }>();

  await c.env.DB.prepare(`
    INSERT INTO secret_settings(key, encrypted_value, iv, algorithm, masked_value, updated_by, updated_at)
    VALUES (?, ?, ?, 'AES-GCM', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      encrypted_value = excluded.encrypted_value,
      iv = excluded.iv,
      masked_value = excluded.masked_value,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(key, encrypted.encryptedValue, encrypted.iv, masked, user.id, now()).run();

  await audit(c, 'secret.update', 'secret_setting', key, old?.masked_value ?? null, masked);
  return ok(c, { key, maskedValue: masked });
});

adminRoutes.get('/jobs', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const status = c.req.query('status');
  const where = status ? 'WHERE j.status = ?' : '';
  const stmt = c.env.DB.prepare(`
    SELECT j.id, j.user_id, j.anonymous_device_id, j.provider, j.status, j.priority, j.rank, j.model, j.size, j.quality,
           j.prompt, j.result_r2_key, j.error_code, j.error_message,
           j.created_at, j.queued_at, j.started_at, j.finished_at, j.cancelled_at,
           u.email AS user_email, u.name AS user_name
    FROM jobs j
    LEFT JOIN users u ON u.id = j.user_id
    ${where}
    ORDER BY j.created_at DESC LIMIT ?
  `);
  const bound = status ? stmt.bind(status, limit) : stmt.bind(limit);
  const jobs = await bound.all();
  return ok(c, { jobs: jobs.results ?? [] });
});

adminRoutes.get('/jobs/:id', async (c) => {
  const id = c.req.param('id');
  const job = await c.env.DB.prepare(`
    SELECT j.*, u.email AS user_email, u.name AS user_name, u.avatar_url AS user_avatar
    FROM jobs j LEFT JOIN users u ON u.id = j.user_id
    WHERE j.id = ?
  `).bind(id).first();
  if (!job) return fail(c, 'NOT_FOUND', '任务不存在。', 404);

  const events = await c.env.DB.prepare(`
    SELECT id, event_type, old_rank, new_rank, message, created_at
    FROM queue_events WHERE job_id = ? ORDER BY created_at ASC
  `).bind(id).all();
  return ok(c, { job, events: events.results ?? [] });
});

adminRoutes.post('/jobs/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const job = await c.env.DB.prepare('SELECT id, status FROM jobs WHERE id = ?').bind(id).first<{ id: string; status: string }>();
  if (!job) return fail(c, 'NOT_FOUND', '任务不存在。', 404);
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return fail(c, 'JOB_NOT_ACTIVE', `任务已是终态：${job.status}`, 400);
  }

  const stub = queueStub(c);
  const doRes = await stub.fetch(`https://queue.local/cancel/${id}`, { method: 'POST' }).then((r) => r.json()).catch(() => null);
  await c.env.DB.prepare(`
    UPDATE jobs SET status = 'cancelled', cancelled_at = ?
    WHERE id = ? AND status NOT IN ('completed', 'failed', 'cancelled')
  `).bind(now(), id).run();
  await c.env.DB.prepare(`
    INSERT INTO queue_events(id, job_id, user_id, event_type, message, created_at)
    SELECT ?, id, user_id, 'cancelled', ?, ? FROM jobs WHERE id = ?
  `).bind(newId('evt'), '管理员强制取消任务。', now(), id).run();

  await audit(c, 'job.cancel', 'job', id, job.status, 'cancelled');
  return ok(c, { id, cancelled: true, queue: doRes });
});

adminRoutes.post('/queue/pause', async (c) => {
  const stub = queueStub(c);
  const data = await stub.fetch('https://queue.local/pause', { method: 'POST' }).then((r) => r.json());
  await audit(c, 'queue.pause', 'queue', 'global', null, 'paused');
  return ok(c, data);
});

adminRoutes.post('/queue/resume', async (c) => {
  const stub = queueStub(c);
  const data = await stub.fetch('https://queue.local/resume', { method: 'POST' }).then((r) => r.json());
  await audit(c, 'queue.resume', 'queue', 'global', null, 'running');
  return ok(c, data);
});

adminRoutes.get('/queue/events', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const events = await c.env.DB.prepare(`
    SELECT e.id, e.job_id, e.user_id, e.event_type, e.old_rank, e.new_rank, e.message, e.created_at,
           u.email AS user_email, u.name AS user_name
    FROM queue_events e
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC LIMIT ?
  `).bind(limit).all();
  return ok(c, { events: events.results ?? [] });
});

adminRoutes.get('/users', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const q = c.req.query('q');
  const stmt = q
    ? c.env.DB.prepare(`
        SELECT u.id, u.email, u.name, u.avatar_url, u.priority, u.role, u.status, u.created_at, u.updated_at,
               GROUP_CONCAT(oa.provider) AS providers
        FROM users u LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
        WHERE u.email LIKE ? OR u.name LIKE ? OR u.id = ?
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ?
      `).bind(`%${q}%`, `%${q}%`, q, limit)
    : c.env.DB.prepare(`
        SELECT u.id, u.email, u.name, u.avatar_url, u.priority, u.role, u.status, u.created_at, u.updated_at,
               GROUP_CONCAT(oa.provider) AS providers
        FROM users u LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT ?
      `).bind(limit);
  const users = await stmt.all();
  return ok(c, { users: users.results ?? [] });
});

adminRoutes.put('/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null) as null | { role?: 'user' | 'admin'; priority?: number; status?: 'active' | 'suspended' };
  if (!body) return fail(c, 'BAD_REQUEST', '请求体无效。');

  const target = await c.env.DB.prepare('SELECT id, role, priority, status FROM users WHERE id = ?').bind(id).first<{ id: string; role: string; priority: number; status: string }>();
  if (!target) return fail(c, 'NOT_FOUND', '用户不存在。', 404);

  const role = body.role ?? target.role;
  const priority = typeof body.priority === 'number' ? body.priority : target.priority;
  const status = body.status ?? target.status;
  if (role !== 'user' && role !== 'admin') return fail(c, 'BAD_ROLE', 'role 取值错误。');
  if (status !== 'active' && status !== 'suspended') return fail(c, 'BAD_STATUS', 'status 取值错误。');
  if (priority < 0 || priority > 1000) return fail(c, 'BAD_PRIORITY', 'priority 必须在 0-1000。');

  await c.env.DB.prepare('UPDATE users SET role = ?, priority = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(role, priority, status, now(), id).run();

  if (status === 'suspended') {
    await c.env.DB.prepare(`
      UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL
    `).bind(now(), id).run();
  }

  await audit(c, 'user.update', 'user', id,
    `role=${target.role};priority=${target.priority};status=${target.status}`,
    `role=${role};priority=${priority};status=${status}`);
  return ok(c, { id, role, priority, status });
});

adminRoutes.get('/bans', async (c) => {
  const bans = await c.env.DB.prepare(`
    SELECT id, ban_type, ban_value, reason, created_by, expires_at, created_at
    FROM bans ORDER BY created_at DESC LIMIT 200
  `).all();
  return ok(c, { bans: bans.results ?? [] });
});

adminRoutes.post('/bans', async (c) => {
  const body = await c.req.json().catch(() => null) as null | { banType?: string; banValue?: string; reason?: string; expiresAt?: number };
  if (!body?.banType || !body?.banValue) return fail(c, 'BAD_REQUEST', 'banType 和 banValue 必填。');
  const allowedTypes = ['user_id', 'email', 'ip', 'device_id'];
  if (!allowedTypes.includes(body.banType)) return fail(c, 'BAD_BAN_TYPE', `banType 必须是 ${allowedTypes.join('/')}。`);

  const user = c.get('user')!;
  const id = newId('ban');
  await c.env.DB.prepare(`
    INSERT INTO bans(id, ban_type, ban_value, reason, created_by, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ban_type, ban_value) DO UPDATE SET
      reason = excluded.reason,
      created_by = excluded.created_by,
      expires_at = excluded.expires_at
  `).bind(id, body.banType, body.banValue, body.reason ?? null, user.id, body.expiresAt ?? null, now()).run();

  await audit(c, 'ban.create', 'ban', `${body.banType}:${body.banValue}`, null, body.reason ?? 'banned');
  return ok(c, { id, banType: body.banType, banValue: body.banValue });
});

adminRoutes.delete('/bans/:id', async (c) => {
  const id = c.req.param('id');
  const ban = await c.env.DB.prepare('SELECT ban_type, ban_value FROM bans WHERE id = ?').bind(id).first<{ ban_type: string; ban_value: string }>();
  if (!ban) return fail(c, 'NOT_FOUND', '封禁记录不存在。', 404);
  await c.env.DB.prepare('DELETE FROM bans WHERE id = ?').bind(id).run();
  await audit(c, 'ban.remove', 'ban', `${ban.ban_type}:${ban.ban_value}`, 'banned', null);
  return ok(c, { id, removed: true });
});

adminRoutes.get('/audit-logs', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const logs = await c.env.DB.prepare(`
    SELECT a.id, a.actor_user_id, a.action, a.resource_type, a.resource_id,
           a.old_value_masked, a.new_value_masked, a.ip, a.created_at,
           u.email AS actor_email, u.name AS actor_name
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.created_at DESC LIMIT ?
  `).bind(limit).all();
  return ok(c, { logs: logs.results ?? [] });
});

async function audit(c: Context<AppContext>, action: string, resourceType: string, resourceId: string, oldValue: string | null, newValue: string | null) {
  const user = c.get('user');
  await c.env.DB.prepare(`
    INSERT INTO audit_logs(id, actor_user_id, action, resource_type, resource_id, old_value_masked, new_value_masked, ip, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    newId('aud'),
    user?.id ?? null,
    action,
    resourceType,
    resourceId,
    oldValue,
    newValue,
    c.req.header('CF-Connecting-IP') ?? null,
    c.req.header('User-Agent') ?? null,
    now()
  ).run();
}

function queueStub(c: Context<AppContext>) {
  const id = c.env.QUEUE_COORDINATOR.idFromName('global-image-queue');
  return c.env.QUEUE_COORDINATOR.get(id);
}

async function reloadQueueConfig(c: Context<AppContext>) {
  const stub = queueStub(c);
  await stub.fetch('https://queue.local/reload-config', { method: 'POST' });
}
