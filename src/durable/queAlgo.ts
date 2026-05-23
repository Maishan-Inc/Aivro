import type { QueueConfig, QueueJob } from '../types';

export function calculateInsertIndex(
  waiting: QueueJob[],
  job: QueueJob,
  config: QueueConfig
): number {
  const isPriorityUser = job.priority > 0;
  if (!isPriorityUser || waiting.length <= config.priorityTriggerLength) {
    return waiting.length;
  }

  const minIndex = Math.max(0, config.priorityInsertStart - 1, config.protectedRank);
  let index = minIndex;

  while (index < waiting.length) {
    const current = waiting[index];
    if (current.priority < job.priority) return index;
    if (current.priority === job.priority && current.createdAt > job.createdAt) return index;
    index++;
  }

  return waiting.length;
}

export interface DelayedEvent {
  jobId: string;
  userId?: string;
  oldRank: number;
  newRank: number;
}

export function computeDelayedEvents(
  waiting: QueueJob[],
  beforeRanks: Map<string, number>
): DelayedEvent[] {
  const events: DelayedEvent[] = [];
  for (let i = 0; i < waiting.length; i++) {
    const job = waiting[i];
    const newRank = i + 1;
    const oldRank = beforeRanks.get(job.id);
    if (oldRank !== undefined && newRank > oldRank) {
      events.push({ jobId: job.id, userId: job.userId, oldRank, newRank });
    }
  }
  return events;
}

export function findActiveJob(
  waiting: QueueJob[],
  running: Record<string, QueueJob>,
  job: QueueJob
): QueueJob | undefined {
  return (
    waiting.find((item) => sameOwner(item, job)) ||
    Object.values(running).find((item) => sameOwner(item, job))
  );
}

function sameOwner(a: QueueJob, b: QueueJob): boolean {
  if (a.userId && b.userId) return a.userId === b.userId;
  if (a.anonymousDeviceId && b.anonymousDeviceId) return a.anonymousDeviceId === b.anonymousDeviceId;
  return false;
}
