/**
 * React Query provider with offline-first defaults.
 *
 * Native network status detection is wired up via the app store in Phase 3
 * (Expo NetInfo). For Phase 1 we rely on React Query's built-in online
 * detection (navigator.onLine on web, assumed online on native).
 */
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { initOfflineSync } from '@/services/offline-sync.service';
import { queryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      return initOfflineSync();
    } catch {
      return undefined;
    }
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
