/**
 * BuildFlow — Estimation Hub screen.
 * Card 1: Rate Analysis Library shortcut.
 * Card 2: Recent estimates across all projects.
 */
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, FAB, EmptyState } from '@/components/ui';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useRateAnalyses } from '@/services/estimate.queries';
import { useAuthStore } from '@/stores/auth.store';

export default function EstimationHubScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: raData, refetch, isFetching } = useRateAnalyses();

  const analyses = raData?.data ?? [];
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: mobileListBottomPadding(true) }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        <MobileScreenHeader
          title="Cost Estimation"
          subtitle="Rate analysis library, estimates & material pricing"
        />

        {/* Card 1: Rate Analysis Library */}
        <Card onPress={() => router.push('/(app)/estimation/rate-analysis')}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-semibold text-text">Rate Analysis Library</Text>
              <Text className="text-sm text-text-muted mt-0.5">{analyses.length} analyses in library</Text>
            </View>
            <Text className="text-primary text-2xl">›</Text>
          </View>
        </Card>

        {/* Card 2: Recent Estimates */}
        <View>
          <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Recent Estimates</Text>
          <EmptyState
            title="Estimates live inside projects"
            description="Open a project and use the Estimate tab to create and manage estimates."
            action={<Button label="Go to Projects" onPress={() => router.push('/(app)/projects')} />}
          />
        </View>

        {/* Quick links */}
        <View>
          <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Quick Links</Text>
          <Card onPress={() => router.push('/(app)/estimation/material-tracker')}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-semibold text-text">Material Price Tracker</Text>
                <Text className="text-sm text-text-muted mt-0.5">Track market rates over time</Text>
              </View>
              <Text className="text-primary text-2xl">›</Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {canManage && <FAB label="New Estimate" onPress={() => router.push('/(app)/projects')} />}
    </SafeAreaView>
  );
}