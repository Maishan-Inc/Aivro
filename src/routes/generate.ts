import { Hono } from 'hono';
import type { AppContext, QueueJob } from '../types';
import { fail, ok } from '../utils/response';
import { newId, now, sha256Hex } from '../utils/ids';
import { getSetting, toBool, toInt } from '../services/config';
import { providerPriority } from '../services/oauth';
import { checkAndIncrementLimit } from '../services/rateLimit';
import { verifyCaptcha } from '../services/captcha';
import { isBanned } from '../services/bans';

export const generateRoutes = new Hono<AppContext>();

generateRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    prompt?: string;
    size?: string;
    quality?: string;
    captchaToken?: string;
    anonymousDeviceId?: string;
  };

  const prompt = body?.prompt?.trim();
  if (!prompt || prompt.length < 3) return fail(c, 'BAD_PROMPT', 'Prompt 不能为空，且至少 3 个字符。');
  if (prompt.length > 4000) return fail(c, 'PROMPT_TOO_LONG', 'Prompt 不能超过 4000 个字符。');

  const user = c.get('user');
  const allowGuest = toBool(await getSetting(c.env, 'QUEUE_ALLOW_GUEST', c.env.QUEUE_ALLOW_GUEST ?? 'false'));
  if (!user && !allowGuest) return fail(c, 'LOGIN_REQUIRED', '请先使用 Google 或 Linux.DO 登录后再生成图片。', 401);

  const captchaResult = await verifyCaptcha(c.env, body?.captchaToken, c.req.header('CF-Connecting-IP'));
  if (!captchaResult.ok) return fail(c, 'CAPTCHA_FAILED', '人机验证失败，请重试。', 403);

  const banCheck = await isBanned(c.env, {
    userId: user?.id,
    email: user?.email,
    ip: c.req.header('CF-Connecting-IP') ?? undefined,
    deviceId: body?.anonymousDeviceId
  });
  if (banCheck.banned) return fail(c, 'BANED', '账号或设备已被封禁。', 403);

  const windowSeconds = toInt(await getSetting(c.env, 'QUEUE_GROUP_WINDOW_SECONDS', c.env.QUEUE_GROUP_WINDOW_SECONDS ?? '60'), 60);
  const maxRequests = toInt(await getSetting(c.env, 'QUEUE_GROUP_MAX_REQUESTS', c.env.QUEUE_GROUP_MAX_REQUESTS ?? '1'), 1);
  const limitKey = user?.id ?? body?.anonymousDeviceId ?? c.req.header('CF-Connecting-IP') ?? 'unknown';
  const limit = await checkAndIncrementLimit(c.env, 'generate', limitKey, windowSeconds, maxRequests);
  if (!limit.allowed) return fail(c, 'RATE_LIMITED', `请求过于频繁，请在 ${limit.resetAt} 后再试。`, 429);

  const active = user ? await c.env.DB.prepare(`
    SELECT id, status FROM jobs WHERE user_id = ? AND status IN ('queued', 'running') LIMIT 1
  `).bind(user.id).first<{ id: string; status: string }>() : null;

  if (active) return fail(c, 'ACTIVE_JOB_EXISTS', `你已经有一个任务正在 ${active.status}。`, 409);

  const model = await getSetting(c.env, 'OPENAI_IMAGE_MODEL', c.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2');
  const size = body?.size ?? await getSetting(c.env, 'OPENAI_IMAGE_SIZE', c.env.OPENAI_IMAGE_SIZE ?? '1024x1024');
  const quality = body?.quality ?? await getSetting(c.env, 'OPENAI_IMAGE_QUALITY', c.env.OPENAI_IMAGE_QUALITY ?? 'auto');
  const provider = user?.provider ?? 'guest';
  const priority = user?.priority ?? providerPriority(provider);
  const jobId = newId('job');
  const createdAt = now();
  const promptHash = await sha256Hex(prompt.toLowerCase());

  await c.env.DB.prepare(`
    INSERT INTO jobs(id, user_id, anonymous_device_id, provider, prompt, normalized_prompt_hash, status, priority, size, quality, model, created_at, queued_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
  `).bind(
    jobId,
    user?.id ?? null,
    body?.anonymousDeviceId ?? null,
    provider,
    prompt,
    promptHash,
    priority,
    size,
    quality,
    model,
    createdAt,
    createdAt
  ).run();

  const job: QueueJob = {
    id: jobId,
    userId: user?.id,
    anonymousDeviceId: body?.anonymousDeviceId,
    provider,
    priority,
    prompt,
    model,
    size,
    quality,
    createdAt
  };

  const id = c.env.QUEUE_COORDINATOR.idFromName('global-image-queue');
  const stub = c.env.QUEUE_COORDINATOR.get(id);
  const res = await stub.fetch('https://queue.local/submit', { method: 'POST', body: JSON.stringify(job) });
  const data = await res.json();

  return ok(c, data, 202);
});
