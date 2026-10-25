/**
 * Keep ice-cream / inventory owner chrome fresh without a hard refresh.
 * Polls the unread bell; when a new notification arrives (e.g. B2B order),
 * immediately refetch stock, sales, and dashboard. Also refetches on app/tab focus.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useUnreadCount } from '@/services/chat.queries';
import { invalidateInventoryLive } from '@/lib/inventory-live';

export function useInventoryLiveSync() {
  const qc = useQueryClient();
  const unreadQ = useUnreadCount();
  const prevUnread = useRef<number | null>(null);

  useEffect(() => {
    const next = Number(unreadQ.data ?? 0);
    if (prevUnread.current !== null && next > prevUnread.current) {
      invalidateInventoryLive(qc);
    }
    prevUnread.current = next;
  }, [unreadQ.data, qc]);

  useEffect(() => {
    const onForeground = () => {
      invalidateInventoryLive(qc);
    };
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') onForeground();
    });
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVis = () => {
        if (document.visibilityState === 'visible') onForeground();
      };
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onForeground);
      return () => {
        sub.remove();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', onForeground);
      };
    }
    return () => sub.remove();
  }, [qc]);

  return unreadQ;
}
