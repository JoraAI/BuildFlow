/**
 * BuildFlow - Offline mutation queue persisted in AsyncStorage.
 *
 * FIX (Phase 5 §8.1): Extended from daily-report-only to support all field
 * operations: punch items, RFIs, attendance check-in/out, material usage.
 * Each op carries an idempotencyKey so the backend can dedupe replays.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateDailyReportInput } from '@buildflow/shared';

const STORAGE_KEY = 'bf_offline_queue_v2';

export type OfflineOperationType =
  | 'CREATE_DAILY_REPORT'
  | 'CREATE_PUNCH_ITEM'
  | 'UPDATE_PUNCH_ITEM'
  | 'CREATE_RFI'
  | 'ANSWER_RFI'
  | 'CREATE_ATTENDANCE'
  | 'UPDATE_ATTENDANCE'
  | 'CREATE_PETTY_CASH';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  projectId: string;
  idempotencyKey: string;
  payload: CreateDailyReportInput | Record<string, unknown>;
  createdAt: string;
}

async function readQueue(): Promise<OfflineOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(ops: OfflineOperation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

export const offlineQueueStore = {
  async getPending(): Promise<OfflineOperation[]> {
    return readQueue();
  },

  async enqueue(op: OfflineOperation): Promise<void> {
    const queue = await readQueue();
    queue.push(op);
    await writeQueue(queue);
  },

  async remove(id: string): Promise<void> {
    const queue = await readQueue();
    await writeQueue(queue.filter((o) => o.id !== id));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  async count(): Promise<number> {
    const queue = await readQueue();
    return queue.length;
  },
};
