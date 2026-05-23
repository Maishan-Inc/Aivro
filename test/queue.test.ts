import { describe, expect, it } from 'vitest';
import { calculateInsertIndex, computeDelayedEvents, findActiveJob } from '../src/durable/queAlgo';
import type { QueueConfig, QueueJob } from '../src/types';

const DEFAULT_CONFIG: QueueConfig = {
  concurrency: 2,
  priorityTriggerLength: 100,
  protectedRank: 50,
  priorityInsertStart: 51,
};

function makeJob(overrides: Partial<QueueJob> & { id: string }): QueueJob {
  return {
    userId: undefined,
    anonymousDeviceId: undefined,
    provider: 'guest',
    priority: 0,
    prompt: 'test',
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'auto',
    createdAt: 1000,
    ...overrides,
  };
}

function fillQueue(count: number, priority = 0, startId = 1): QueueJob[] {
  return Array.from({ length: count }, (_, i) =>
    makeJob({ id: `job-${startId + i}`, priority, createdAt: 1000 + i })
  );
}

// PLACEHOLDER_TESTS

describe('calculateInsertIndex', () => {
  it('rule 1: empty queue inserts at index 0 (rank=1)', () => {
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo' });
    const index = calculateInsertIndex([], job, DEFAULT_CONFIG);
    expect(index).toBe(0);
  });

  it('rule 2: queue < priorityTriggerLength, priority user appends to end', () => {
    const waiting = fillQueue(50);
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo' });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(50);
  });

  it('rule 3: queue >= 100, linuxdo inserts from rank 51 before first lower-priority user', () => {
    const waiting = [
      ...fillQueue(50, 20, 1),
      ...fillQueue(60, 0, 51),
    ];
    expect(waiting.length).toBe(110);
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 2000 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(50);
    expect(index + 1).toBe(51);
  });

  it('rule 3: protected top 50 are never displaced', () => {
    const waiting = [
      ...fillQueue(50, 0, 1),
      ...fillQueue(60, 0, 51),
    ];
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 2000 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBeGreaterThanOrEqual(50);
  });

  it('rule 4: rank 51 is same/higher priority → scan further back', () => {
    const waiting = [
      ...fillQueue(50, 0, 1),
      ...fillQueue(10, 20, 51),
      ...fillQueue(50, 0, 61),
    ];
    expect(waiting.length).toBe(110);
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 9999 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(60);
  });

  it('rule 4: rank 51+ all same priority, earlier createdAt wins position', () => {
    const waiting = [
      ...fillQueue(50, 0, 1),
      ...fillQueue(60, 20, 51),
    ];
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 500 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(50);
  });

  it('rule 4: all positions occupied by higher priority → append to end', () => {
    const waiting = [
      ...fillQueue(50, 0, 1),
      ...fillQueue(60, 30, 51),
    ];
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 2000 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(110);
  });

  it('guest (priority=0) always appends regardless of queue length', () => {
    const waiting = fillQueue(150, 0);
    const job = makeJob({ id: 'new', priority: 0, provider: 'guest' });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(150);
  });
});

describe('computeDelayedEvents', () => {
  it('rule 5: displaced users produce delayed events with correct ranks', () => {
    const waiting = [
      makeJob({ id: 'a', createdAt: 1 }),
      makeJob({ id: 'inserted', createdAt: 5 }),
      makeJob({ id: 'b', createdAt: 2 }),
      makeJob({ id: 'c', createdAt: 3 }),
    ];
    const beforeRanks = new Map<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const events = computeDelayedEvents(waiting, beforeRanks);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ jobId: 'b', userId: undefined, oldRank: 2, newRank: 3 });
    expect(events[1]).toEqual({ jobId: 'c', userId: undefined, oldRank: 3, newRank: 4 });
  });

  it('rule 5: no events when no displacement occurs', () => {
    const waiting = [
      makeJob({ id: 'a', createdAt: 1 }),
      makeJob({ id: 'b', createdAt: 2 }),
    ];
    const beforeRanks = new Map<string, number>([['a', 1], ['b', 2]]);
    const events = computeDelayedEvents(waiting, beforeRanks);
    expect(events).toHaveLength(0);
  });
});

describe('running jobs and cancel', () => {
  it('rule 0/6: running jobs are not in waiting, do not affect rank calculation', () => {
    const waiting = fillQueue(110, 0);
    const running: Record<string, QueueJob> = {
      'run-1': makeJob({ id: 'run-1', priority: 20, provider: 'linuxdo' }),
    };
    const job = makeJob({ id: 'new', priority: 20, provider: 'linuxdo', createdAt: 2000 });
    const index = calculateInsertIndex(waiting, job, DEFAULT_CONFIG);
    expect(index).toBe(50);
    expect(running['run-1']).toBeDefined();
  });

  it('rule 7: cancel a queued job shifts subsequent ranks forward by 1', () => {
    const waiting = [
      makeJob({ id: 'a', createdAt: 1 }),
      makeJob({ id: 'b', createdAt: 2 }),
      makeJob({ id: 'c', createdAt: 3 }),
      makeJob({ id: 'd', createdAt: 4 }),
    ];
    const beforeRanks = new Map(waiting.map((j, i) => [j.id, i + 1]));
    waiting.splice(1, 1);
    const events = computeDelayedEvents(waiting, beforeRanks);
    expect(events).toHaveLength(0);
    expect(waiting.map((j) => j.id)).toEqual(['a', 'c', 'd']);
  });
});

describe('findActiveJob (rule 7: same user single active)', () => {
  it('rule 7: detects duplicate userId in waiting', () => {
    const waiting = [makeJob({ id: 'existing', userId: 'u1', createdAt: 1 })];
    const running: Record<string, QueueJob> = {};
    const newJob = makeJob({ id: 'dup', userId: 'u1', createdAt: 2 });
    expect(findActiveJob(waiting, running, newJob)).toBeDefined();
  });

  it('rule 7: detects duplicate userId in running', () => {
    const waiting: QueueJob[] = [];
    const running: Record<string, QueueJob> = {
      existing: makeJob({ id: 'existing', userId: 'u1', createdAt: 1 }),
    };
    const newJob = makeJob({ id: 'dup', userId: 'u1', createdAt: 2 });
    expect(findActiveJob(waiting, running, newJob)).toBeDefined();
  });

  it('rule 7: different users are not blocked', () => {
    const waiting = [makeJob({ id: 'existing', userId: 'u1', createdAt: 1 })];
    const running: Record<string, QueueJob> = {};
    const newJob = makeJob({ id: 'new', userId: 'u2', createdAt: 2 });
    expect(findActiveJob(waiting, running, newJob)).toBeUndefined();
  });

  it('rule 7: same anonymousDeviceId is also blocked', () => {
    const waiting = [makeJob({ id: 'existing', anonymousDeviceId: 'dev-1', createdAt: 1 })];
    const running: Record<string, QueueJob> = {};
    const newJob = makeJob({ id: 'dup', anonymousDeviceId: 'dev-1', createdAt: 2 });
    expect(findActiveJob(waiting, running, newJob)).toBeDefined();
  });
});
