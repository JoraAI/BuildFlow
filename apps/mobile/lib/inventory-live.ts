/**
 * Live refresh for inventory owner screens.
 *
 * Buyer-app orders and warehouse movements happen outside this session, so
 * React Query's 5-minute staleTime leaves Home/Stock/Notifications stale until
 * a hard refresh. These helpers poll cheaply and refetch on focus.
 */
import type { QueryClient } from '@tanstack/react-query';

export const INVENTORY_NOTIF_POLL_MS = 8_000;
export const INVENTORY_STOCK_POLL_MS = 10_000;

const LIVE_QUERY_DEFAULTS = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
};

export function inventoryLiveQueryOptions(pollMs: number) {
  return {
    ...LIVE_QUERY_DEFAULTS,
    refetchInterval: pollMs,
  };
}

export function invalidateInventoryLive(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['notifications'] });
  void qc.invalidateQueries({ queryKey: ['procurement', 'stock'] });
  void qc.invalidateQueries({ queryKey: ['stock'] });
  void qc.invalidateQueries({ queryKey: ['inventory', 'analytics'] });
  void qc.invalidateQueries({ queryKey: ['inventory', 'stock'] });
  void qc.invalidateQueries({ queryKey: ['transactions'] });
  void qc.invalidateQueries({ queryKey: ['resources'] });
}
