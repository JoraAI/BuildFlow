/**
 * Public client portal - no authentication required.
 * Route: /portal/:token
 */
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Card, Badge, EmptyState, ProgressBar } from '@/components/ui';
import { usePortalData, type PortalData } from '@/services/expansion.queries';
import { formatINR, formatDate } from '@/utils/format';

export default function PortalScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? '';
  const { data, isLoading, isError, error } = usePortalData(token);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
        <Text className="text-muted mt-3">Loading project portal…</Text>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <Stack.Screen options={{ title: 'Portal' }} />
        <EmptyState
          title="Invalid link"
          description={error instanceof Error ? error.message : 'This portal link is invalid or has expired.'}
        />
      </SafeAreaView>
    );
  }

  const { project, progress, invoices } = data;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Stack.Screen options={{ title: project.name }} />
      <ScrollView contentContainerClassName="p-4 gap-4 pb-8">
        <Card>
          <Text className="text-xl font-bold text-text">{project.name}</Text>
          <Text className="text-sm text-muted font-mono">{project.code}</Text>
          <View className="flex-row gap-2 mt-2">
            <Badge color="primary" label={project.status.replace('_', ' ')} />
          </View>
          <Text className="text-sm text-muted mt-2">Client: {project.clientName}</Text>
          <Text className="text-xs text-muted mt-1">
            Link expires {formatDate(data.expiresAt)}
          </Text>
        </Card>

        {progress && (
          <Card>
            <Text className="text-base font-bold text-text mb-3">Progress</Text>
            {progress.tasks.slice(0, 8).map((task: NonNullable<PortalData['progress']>['tasks'][number]) => (
              <View key={task.id} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-text flex-1 mr-2" numberOfLines={1}>
                    {task.name}
                  </Text>
                  <Text className="text-xs text-muted">{task.progressPct}%</Text>
                </View>
                <ProgressBar value={task.progressPct} />
              </View>
            ))}
            {progress.recentReports.length > 0 && (
              <>
                <Text className="text-sm font-bold text-text mt-2 mb-2">Recent site reports</Text>
                {progress.recentReports.map((r: NonNullable<PortalData['progress']>['recentReports'][number]) => (
                  <View key={r.id} className="py-2 border-t border-border">
                    <Text className="text-xs text-muted">{formatDate(r.reportDate)}</Text>
                    <Text className="text-sm text-text" numberOfLines={2}>
                      {r.workDone ?? 'No details'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        )}

        {invoices && invoices.length > 0 && (
          <Card>
            <Text className="text-base font-bold text-text mb-3">Invoices</Text>
            {invoices.map((inv: NonNullable<PortalData['invoices']>[number]) => (
              <View key={inv.id} className="flex-row justify-between items-center py-2 border-b border-border/50">
                <View>
                  <Text className="text-sm font-semibold text-text">{inv.invoiceNumber}</Text>
                  <Text className="text-xs text-muted">{formatDate(inv.invoiceDate)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold text-text">{formatINR(parseFloat(String(inv.total)))}</Text>
                  <Badge
                    color={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning'}
                    label={inv.status}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
