/**
 * BuildFlow — Site Check-in (Web fallback).
 *
 * GPS check-in with maps is a native-mobile-only feature (requires
 * expo-location + react-native-maps native modules). On the web build,
 * we render a graceful fallback instead of crashing during SSR.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { EmptyState } from '@/components/ui';

export default function SiteCheckInScreenWeb() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-3 flex-row items-center border-b border-border">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-muted">← Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-base font-bold text-text">Site Check-in</Text>
        <View style={{ width: 40 }} />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          title="Mobile-only feature"
          description="Site check-in with GPS geo-fencing requires the BuildFlow mobile app (Expo) on Android or iOS. It is not available in the web version."
        />
      </View>
    </SafeAreaView>
  );
}