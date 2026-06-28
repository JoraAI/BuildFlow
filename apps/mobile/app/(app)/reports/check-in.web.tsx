/**
 * BuildFlow - Site Check-in (Web fallback).
 *
 * GPS check-in with maps is a native-mobile-only feature (requires
 * expo-location + react-native-maps native modules). On the web build,
 * we render a graceful fallback instead of crashing during SSR.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';

export default function SiteCheckInScreenWeb() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader
        title="Site Check-in"
        cancelLabel="Back"
        onCancel={() => dismissTo(DISMISS.reports)}
      />

      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          title="Mobile-only feature"
          description="Site check-in with GPS geo-fencing requires the BuildFlow mobile app (Expo) on Android or iOS. It is not available in the web version."
        />
      </View>
    </SafeAreaView>
  );
}