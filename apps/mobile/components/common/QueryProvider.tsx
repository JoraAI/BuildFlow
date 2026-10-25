/**
 * React Query provider with offline-first defaults.
 *
 * Native network status detection is wired up via the app store in Phase 3
 * (Expo NetInfo). For Phase 1 we rely on React Query's built-in online
 * detection (navigator.onLine on web, assumed online on native).
 */
import React from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { initOfflineSync } from '@/services/offline-sync.service';
import { queryClient } from '@/lib/query-client';

function bindQueryFocus() {
  if (Platform.OS === 'web') return undefined;
  const sub = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const unbindFocus = bindQueryFocus();
    let unbindSync: undefined | (() => void);
    try {
      unbindSync = initOfflineSync();
    } catch {
      unbindSync = undefined;
    }
    return () => {
      unbindFocus?.();
      unbindSync?.();
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
