/**
 * Root layout — hydrates auth from SecureStore, sets up providers,
 * and routes between (auth) and (app) based on authentication state.
 */
import '../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { QueryProvider } from '@/components/common/QueryProvider';
import { ToastHost } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

export default function RootLayout() {
  const { isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <QueryProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(public)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="platform" />
          <Stack.Screen name="portal" options={{ headerShown: false }} />
        </Stack>
        <ToastHost />
      </View>
    </QueryProvider>
  );
}
