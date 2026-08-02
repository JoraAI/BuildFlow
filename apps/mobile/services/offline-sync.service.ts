/**
 * BuildFlow - Replay offline-queued mutations when connectivity returns.
 *
 * FIX (Phase 5 §8.1): Extended from daily-report-only to support all field
 * operations. Each op is replayed via its corresponding API endpoint with
 * the Idempotency-Key header for server-side dedup.
 */
import { apiFetch } from '@/lib/api-client';
import { offlineQueueStore, type OfflineOperation } from '@/stores/offline-queue.store';
import { useAppStore } from '@/stores/app.store';

let syncing = false;
let unsubscribe: (() => void) | null = null;

/** Map each operation type to its replay path + method. */
function getReplayConfig(op: OfflineOperation): { method: string; path: string } | null {
  switch (op.type) {
    case 'CREATE_DAILY_REPORT':
      return { method: 'POST', path: `/projects/${op.projectId}/reports` };
    case 'CREATE_PUNCH_ITEM':
      return { method: 'POST', path: '/punch-list' };
    case 'UPDATE_PUNCH_ITEM':
      return { method: 'PUT', path: `/punch-list/${(op.payload as { id?: string }).id ?? ''}` };
    case 'CREATE_RFI':
      return { method: 'POST', path: '/rfis' };
    case 'ANSWER_RFI':
      return { method: 'POST', path: `/rfis/${(op.payload as { id?: string }).id ?? ''}/answer` };
    case 'CREATE_ATTENDANCE':
      return { method: 'POST', path: `/projects/${op.projectId}/checkin` };
    case 'UPDATE_ATTENDANCE':
      return { method: 'POST', path: `/projects/${op.projectId}/checkout` };
    default:
      return null;
  }
}

export async function replayOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const ops = await offlineQueueStore.getPending();
    for (const op of ops) {
      try {
        const config = getReplayConfig(op);
        if (!config) {
          await offlineQueueStore.remove(op.id);
          continue;
        }
        const { payload, ...body } = op.payload as Record<string, unknown>;
        await apiFetch(config.path, {
          method: config.method as 'POST' | 'PUT',
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': op.idempotencyKey },
        });
        await offlineQueueStore.remove(op.id);
        synced += 1;
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
