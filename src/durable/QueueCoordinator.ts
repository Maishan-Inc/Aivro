import type { Env, QueueConfig, QueueJob } from '../types';
import { generateImage } from '../services/openai';
import { saveGeneratedImage } from '../services/r2';
import { getQueueConfig, getSetting, getSecret } from '../services/config';
import { getModelById, getDefaultModel, getFirstEnabledModel, decryptModelApiKey } from '../services/models';
import { newId, now } from '../utils/ids';
import { calculateInsertIndex, computeDelayedEvents, findActiveJob } from './queAlgo';

type QueueState = {
  waiting: QueueJob[];
  running: Record<string, QueueJob>;
  paused: boolean;
  config?: QueueConfig;
};

export class QueueCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private queue: QueueState = { waiting: [], running: {}, paused: false };
  private hydrated = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    await this.hydrate();
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/submit') {
      const job = await request.json() as QueueJob;
      return this.json(await this.submit(job));
    }

    if (request.method === 'GET' && url.pathname.startsWith('/status/')) {
      const jobId = url.pathname.split('/').pop() ?? '';
      return this.json(this.getStatus(jobId));
    }

    if (request.method === 'POST' && url.pathname.startsWith('/cancel/')) {
      const jobId = url.pathname.split('/').pop() ?? '';
      return this.json(await this.cancel(jobId));
    }

    if (request.method === 'POST' && url.pathname === '/pause') {
      this.queue.paused = true;
      await this.persist();
      return this.json({ paused: true });
    }

    if (request.method === 'POST' && url.pathname === '/resume') {
      this.queue.paused = false;
      await this.persist();
      this.dispatch().catch((error) => console.error('dispatch failed', error));
      return this.json({ paused: false });
    }

    if (request.method === 'POST' && url.pathname === '/reload-config') {
      this.queue.config = await getQueueConfig(this.env);
      await this.persist();
      return this.json({ config: this.queue.config });
    }

    if (request.method === 'GET' && url.pathname === '/overview') {
      return this.json({
        waiting: this.queue.waiting.length,
        running: Object.keys(this.queue.running).length,
        paused: this.queue.paused,
        top: this.queue.waiting.slice(0, 20).map((job, index) => ({ id: job.id, rank: index + 1, provider: job.provider, priority: job.priority }))
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private async hydrate() {
    if (this.hydrated) return;
    const saved = await this.state.storage.get<QueueState>('queue');
    if (saved) this.queue = saved;
    if (!this.queue.config) this.queue.config = await getQueueConfig(this.env);
    this.hydrated = true;
  }

  private async persist() {
    await this.state.storage.put('queue', this.queue);
  }

  private async submit(job: QueueJob) {
    const active = findActiveJob(this.queue.waiting, this.queue.running, job);

    if (active) {
      return { accepted: false, reason: 'ACTIVE_JOB_EXISTS', jobId: active.id, status: this.getStatus(active.id) };
    }

    const beforeRanks = new Map(this.queue.waiting.map((item, index) => [item.id, index + 1]));
    const config = this.queue.config ?? defaultQueueConfig();
    const insertAt = calculateInsertIndex(this.queue.waiting, job, config);
    this.queue.waiting.splice(insertAt, 0, job);
    await this.rewriteRanksAndDelayedEvents(beforeRanks);
    await this.persist();

    this.dispatch().catch((error) => console.error('dispatch failed', error));
    return { accepted: true, jobId: job.id, rank: insertAt + 1 };
  }

  private async rewriteRanksAndDelayedEvents(beforeRanks: Map<string, number>) {
    const events = computeDelayedEvents(this.queue.waiting, beforeRanks);
    const timestamp = now();
    for (let index = 0; index < this.queue.waiting.length; index++) {
      const job = this.queue.waiting[index];
      const newRank = index + 1;
      await this.env.DB.prepare('UPDATE jobs SET rank = ? WHERE id = ?').bind(newRank, job.id).run();
    }
    for (const ev of events) {
      await this.env.DB.prepare(`
        INSERT INTO queue_events(id, job_id, user_id, event_type, old_rank, new_rank, message, created_at)
        VALUES (?, ?, ?, 'delayed', ?, ?, ?, ?)
      `).bind(
        newId('evt'),
        ev.jobId,
        ev.userId ?? null,
        ev.oldRank,
        ev.newRank,
        `你的请求已被延期。当前有更高优先级用户进入队列，你的新排名是 #${ev.newRank}。`,
        timestamp
      ).run();
    }
  }

  private getStatus(jobId: string) {
    const waitingIndex = this.queue.waiting.findIndex((job) => job.id === jobId);
    if (waitingIndex >= 0) {
      return { status: 'queued', rank: waitingIndex + 1, ahead: waitingIndex };
    }
    if (this.queue.running[jobId]) {
      return { status: 'running', rank: 0, ahead: 0 };
    }
    return { status: 'not_in_memory' };
  }

  private async cancel(jobId: string) {
    const index = this.queue.waiting.findIndex((job) => job.id === jobId);
    if (index === -1) return { cancelled: false, reason: 'NOT_WAITING' };
    this.queue.waiting.splice(index, 1);
    await this.env.DB.prepare(`UPDATE jobs SET status = 'cancelled', cancelled_at = ? WHERE id = ?`).bind(now(), jobId).run();
    await this.rewriteRanksAndDelayedEvents(new Map());
    await this.persist();
    return { cancelled: true };
  }

  private async dispatch() {
    await this.hydrate();
    if (this.queue.paused) return;

    const config = this.queue.config ?? defaultQueueConfig();
    while (Object.keys(this.queue.running).length < config.concurrency && this.queue.waiting.length > 0) {
      const job = this.queue.waiting.shift()!;
      this.queue.running[job.id] = job;
      await this.env.DB.prepare(`UPDATE jobs SET status = 'running', rank = NULL, started_at = ? WHERE id = ?`).bind(now(), job.id).run();
      await this.persist();
      this.runJob(job).catch((error) => console.error('runJob failed', job.id, error));
    }

    await this.rewriteRanksAndDelayedEvents(new Map());
    await this.persist();
  }

  private async runJob(job: QueueJob) {
    try {
      // Resolve model config: look up by name stored in job, fallback to default/env
      let baseUrl: string;
      let apiKey: string;
      let modelName = job.model;

      const modelRow = await this.env.DB.prepare(
        'SELECT * FROM models WHERE name = ? AND enabled = 1 LIMIT 1'
      ).bind(job.model).first() as { base_url: string; api_key_encrypted: string; api_key_iv: string; api_key_masked: string; name: string; id: string } | null;

      if (modelRow) {
        baseUrl = modelRow.base_url;
        apiKey = await decryptModelApiKey(this.env, modelRow as unknown as Parameters<typeof decryptModelApiKey>[1]);
      } else {
        const fallback = await getDefaultModel(this.env) ?? await getFirstEnabledModel(this.env);
        if (fallback) {
          baseUrl = fallback.base_url;
          apiKey = await decryptModelApiKey(this.env, fallback);
          modelName = fallback.name;
        } else {
          baseUrl = await getSetting(this.env, 'OPENAI_BASE_URL', this.env.OPENAI_BASE_URL ?? '');
          apiKey = await getSecret(this.env, 'OPENAI_API_KEY');
          if (!baseUrl || !apiKey) throw new Error('No model configured and no env fallback available');
        }
      }

      const image = await generateImage({ baseUrl, apiKey, modelName }, {
        prompt: job.prompt,
        size: job.size,
        quality: job.quality
      });

      let r2Key: string | undefined;
      if (image.b64Json) r2Key = await saveGeneratedImage(this.env, job.id, image.b64Json);

      await this.env.DB.prepare(`
        UPDATE jobs SET status = 'completed', result_r2_key = ?, finished_at = ?, metadata_json = ? WHERE id = ?
      `).bind(r2Key ?? image.url ?? null, now(), JSON.stringify({ revisedPrompt: image.revisedPrompt }), job.id).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.env.DB.prepare(`
        UPDATE jobs SET status = 'failed', error_code = 'IMAGE_GENERATION_FAILED', error_message = ?, finished_at = ? WHERE id = ?
      `).bind(message.slice(0, 1000), now(), job.id).run();
    } finally {
      delete this.queue.running[job.id];
      await this.persist();
      await this.dispatch();
    }
  }

  private json(data: unknown, status = 200) {
    return Response.json(data, { status });
  }
}

function defaultQueueConfig(): QueueConfig {
  return { concurrency: 2, priorityTriggerLength: 100, protectedRank: 50, priorityInsertStart: 51 };
}
