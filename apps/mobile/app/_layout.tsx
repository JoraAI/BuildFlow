/**
 * Root layout - hydrates auth from SecureStore, sets up providers,
 * and routes between (auth) and (app) based on authentication state.
 */
import '../global.css';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '@/components/common/QueryProvider';
import { ToastHost } from '@/components/ui';
import { useAppViewportLock } from '@/hooks/useAppViewportLock';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';

// FIX (MOB-H7): Wire up NetInfo so the offline pipeline (OfflineBanner,
// proactive offline branch in useCreateReport, initOfflineSync replay)
// actually works. Without this, setNetworkStatus is never called.
let netInfoUnsub: (() => void) | null = null;

async function initNetInfo() {
  if (Platform.OS === 'web') {
    const handleOnline = () => useAppStore.getState().setNetworkStatus('online');
    const handleOffline = () => useAppStore.getState().setNetworkStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    useAppStore.getState().setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    netInfoUnsub = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  } else {
    // Native: dynamically require NetInfo (Metro resolves it at runtime).
    // We use a type-safe wrapper to avoid tsc needing the package installed.
    type NetInfoCallback = (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void;
    type NetInfoModule = { addEventListener: (cb: NetInfoCallback) => () => void };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo: NetInfoModule = require('@react-native-community/netinfo');
      const unsub = NetInfo.addEventListener((state) => {
        useAppStore.getState().setNetworkStatus(
          state.isConnected && state.isInternetReachable !== false ? 'online' : 'offline',
        );
      });
      netInfoUnsub = unsub;
    } catch {
      useAppStore.getState().setNetworkStatus('online');
    }
  }
}

export default function RootLayout() {
  const { isLoading, hydrate } = useAuthStore();
  useAppViewportLock();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    void initNetInfo();
    return () => { if (netInfoUnsub) { netInfoUnsub(); netInfoUnsub = null; } };
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <View className="flex-1" style={{ height: '100%', overflow: 'hidden' }}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="inventory" />
            <Stack.Screen name="platform" />
            <Stack.Screen name="portal" options={{ headerShown: false }} />
          </Stack>
          <ToastHost />
        </View>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
