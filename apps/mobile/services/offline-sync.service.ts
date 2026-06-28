/**
 * BuildFlow — Replay offline-queued mutations when connectivity returns.
 */
import { apiFetch } from '@/lib/api-client';
import { offlineQueueStore } from '@/stores/offline-queue.store';
import { useAppStore } from '@/stores/app.store';
import type { ReportListItem } from '@/services/report.queries';

let syncing = false;
let unsubscribe: (() => void) | null = null;

export async function replayOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const ops = await offlineQueueStore.getPending();
    for (const op of ops) {
      try {
        if (op.type === 'CREATE_DAILY_REPORT') {
          await apiFetch<ReportListItem>(`/projects/${op.projectId}/reports`, {
            method: 'POST',
            body: JSON.stringify(op.payload),
            headers: { 'Idempotency-Key': op.idempotencyKey },
          });
          await offlineQueueStore.remove(op.id);
          synced += 1;
        }
      } catch {
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

/** Subscribe to network status and replay queue when back online. */
export function initOfflineSync(): () => void {
  if (unsubscribe) return unsubscribe;

  let prev = useAppStore.getState().networkStatus;

  unsubscribe = useAppStore.subscribe((state) => {
    const next = state.networkStatus;
    if (prev === 'offline' && next === 'online') {
      void replayOfflineQueue();
    }
    prev = next;
  });

  if (useAppStore.getState().networkStatus === 'online') {
    void replayOfflineQueue();
  }

  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
