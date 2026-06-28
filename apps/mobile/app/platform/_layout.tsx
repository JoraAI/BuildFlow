/**
 * Platform admin console layout (separate from tenant app).
 */
import React, { useEffect } from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { QueryProvider } from '@/components/common/QueryProvider';
import { usePlatformStore } from '@/stores/platform.store';

export default function PlatformLayout() {
  const { isAuthenticated, isLoading, hydrate } = usePlatformStore();
  const segments = useSegments();
  const onLogin = segments[segments.length - 1] === 'login';

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#1E3A5F" />
      </View>
    );
  }

  if (!isAuthenticated && !onLogin) {
    return <Redirect href="/platform/login" />;
  }

  if (isAuthenticated && onLogin) {
    return <Redirect href="/platform" />;
  }

  return (
    <QueryProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="companies/index" />
        <Stack.Screen name="companies/[id]" />
        <Stack.Screen name="tickets/index" />
      </Stack>
    </QueryProvider>
  );
}
