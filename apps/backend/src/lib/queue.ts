/**
 * BuildFlow — Bull queue setup (Redis-backed) for async jobs:
 *   - PDF / Excel generation
 *   - Email / WhatsApp / SMS notifications
 *   - Rate-analysis recompute
 *
 * Queues are lazily created and safe to import in tests (no connection until a job is added).
 */
import Queue from 'bull';
import { env } from '../config/env';
import { logger } from '../config/logger';

const globalForQueues = globalThis as unknown as {
  __bfQueues?: Map<string, Queue.Queue>;
};

function queues(): Map<string, Queue.Queue> {
  if (globalForQueues.__bfQueues) return globalForQueues.__bfQueues;
  const map = new Map<string, Queue.Queue>();
  for (const name of ['pdf', 'excel', 'notification', 'recompute']) {
    const q = new Queue(name, env.REDIS_URL, {
      prefix: 'buildflow:queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
    q.on('error', (err) => logger.error(`Queue [${name}] error`, { error: err.message }));
    map.set(name, q);
  }
  if (process.env.NODE_ENV !== 'production') {
    globalForQueues.__bfQueues = map;
  }
  return map;
}

export function getQueue(name: 'pdf' | 'excel' | 'notification' | 'recompute'): Queue.Queue {
  return queues().get(name)!;
}

export async function closeQueues(): Promise<void> {
  if (!globalForQueues.__bfQueues) return;
  await Promise.allSettled([...globalForQueues.__bfQueues.values()].map((q) => q.close()));
  globalForQueues.__bfQueues = undefined;
}