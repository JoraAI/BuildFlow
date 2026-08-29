/**
 * BuildFlow - Universal Offline Engine Floating Status Pill (Module 2).
 *
 * Micro-interactions:
 *  - Offline: Amber pill at top with icon `⚡ Offline (N changes saved locally)`
 *  - Syncing: Soft blue animated pulse `🔄 Syncing changes... (X/N)`
 *  - Completed: Green checkmark `✓ All data synced` (fades out after 3.5s)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/stores/app.store';
import { offlineQueueStore } from '@/stores/offline-queue.store';
import {
  subscribeSyncProgress,
  replayOfflineQueue,
  type SyncProgress,
} from '@/services/offline-sync.service';

export function OfflineSyncBanner() {
  const networkStatus = useAppStore((s) => s.networkStatus);
  const [pendingCount, setPendingCount] = useState(0);
  const [progress, setProgress] = useState<SyncProgress>({
    isSyncing: false,
    total: 0,
    current: 0,
    lastSyncedAt: null,
    justCompleted: false,
  });

  useEffect(() => {
    const checkPending = async () => {
      const ops = await offlineQueueStore.getPending();
      setPendingCount(ops.length);
    };

    void checkPending();
    const interval = setInterval(checkPending, 3000);
    const unsub = subscribeSyncProgress((p) => {
      setProgress(p);
      void checkPending();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const isOffline = networkStatus === 'offline';
  const isSyncing = progress.isSyncing;
  const justCompleted = progress.justCompleted;

  if (!isOffline && !isSyncing && !justCompleted && pendingCount === 0) {
    return null;
  }

  // 1. Just completed sync
  if (justCompleted) {
    return (
      <View className="bg-emerald-600 px-4 py-2 flex-row items-center justify-center gap-2 shadow-sm">
        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
        <Text className="text-white text-xs font-semibold">
          All changes synced with server
        </Text>
      </View>
    );
  }

  // 2. Currently syncing
  if (isSyncing) {
    return (
      <View className="bg-sky-600 px-4 py-2 flex-row items-center justify-center gap-2 shadow-sm">
        <Ionicons name="sync" size={16} color="#FFFFFF" />
        <Text className="text-white text-xs font-semibold">
          Syncing changes... ({progress.current}/{progress.total || pendingCount})
        </Text>
      </View>
    );
  }

  // 3. Offline / Pending changes
  return (
    <View className="bg-amber-600 px-4 py-2 flex-row items-center justify-between shadow-sm">
      <View className="flex-row items-center gap-2 flex-1 mr-2">
        <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
        <Text className="text-white text-xs font-semibold flex-1" numberOfLines={1}>
          {isOffline ? "You're offline" : 'Unsynced changes'} · {pendingCount > 0 ? `${pendingCount} saved locally` : 'Viewing cached data'}
        </Text>
      </View>
      {!isOffline && pendingCount > 0 ? (
        <Pressable
          onPress={() => void replayOfflineQueue()}
          className="bg-white/20 px-2.5 py-1 rounded-md active:opacity-80"
        >
          <Text className="text-white text-[11px] font-bold">Sync Now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
