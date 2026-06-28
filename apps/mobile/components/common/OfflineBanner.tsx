/**
 * OfflineBanner - amber bar shown when network status is 'offline'.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useAppStore } from '@/stores/app.store';

export function OfflineBanner() {
  const networkStatus = useAppStore((s) => s.networkStatus);
  if (networkStatus !== 'offline') return null;
  return (
    <View className="bg-accent px-4 py-2">
      <Text className="text-white text-center text-sm font-semibold">
        You're offline - viewing cached data. Changes will sync when connected.
      </Text>
    </View>
  );
}