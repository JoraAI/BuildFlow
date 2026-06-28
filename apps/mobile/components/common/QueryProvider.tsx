/**
 * React Query provider with offline-first defaults.
 *
 * Native network status detection is wired up via the app store in Phase 3
 * (Expo NetInfo). For Phase 1 we rely on React Query's built-in online
 * detection (navigator.onLine on web, assumed online on native).
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initOfflineSync } from '@/services/offline-sync.service';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = React.useRef<QueryClient | null>(null);
  if (!queryClient.current) {
    queryClient.current = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 2,
          staleTime: 5 * 60 * 1000, // 5 min default
          gcTime: 30 * 60 * 1000, // 30 min garbage collection
          networkMode: 'offlineFirst',
        },
        mutations: {
          retry: 0,
          networkMode: 'offlineFirst',
        },
      },
    });
  }

  React.useEffect(() => {
    try {
      return initOfflineSync();
    } catch {
      return undefined;
    }
  }, []);

  return <QueryClientProvider client={queryClient.current}>{children}</QueryClientProvider>;
}
