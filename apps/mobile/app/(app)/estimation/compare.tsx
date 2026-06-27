/**
 * BuildFlow — Estimate Comparison screen.
 * Side-by-side comparison of two estimate versions.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useProjectEstimates, useCompareEstimates, type EstimateListItem, type EstimateComparison } from '@/services/estimate.queries';
import { formatINR } from '@/utils/format';

export default function CompareEstimatesScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data: listData, isLoading: listLoading } = useProjectEstimates(projectId);
  const estimates = listData?.data ?? [];

  const [idA, setIdA] = useState<string>('');
  const [idB, setIdB] = useState<string>('');

  // Default to first two estimates
  React.useEffect(() => {
    if (!idA && !idB && estimates.length >= 2) {
      setIdA(estimates[0].id);
      setIdB(estimates[1].id);
    }
  }, [estimates, idA, idB]);

  const { data: cmp, isLoading } = useCompareEstimates(idA, idB);
  const canCompare = !!idA && !!idB && idA !== idB;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Text className="text-primary text-lg">‹ Back</Text>
        </Pressable>
        <Text className="text-lg font-bold text-text flex-1">Compare Estimates</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-4">
        {/* Version pickers */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-xs text-text-muted mb-1">Version A</Text>
            <View className="border border-border rounded-lg bg-card">
              {estimates.map((e: EstimateListItem) => (
                <Pressable
                  key={e.id}
                  onPress={() => setIdA(e.id)}
                  className={`px-3 py-2 border-b border-border/50 ${idA === e.id ? 'bg-primary/10' : ''}`}
                >
                  <Text className={`text-sm ${idA === e.id ? 'font-bold text-primary' : 'text-text'}`}>
                    v{e.version}.0 — {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-text-muted mb-1">Version B</Text>
            <View className="border border-border rounded-lg bg-card">
              {estimates.map((e: EstimateListItem) => (
                <Pressable
                  key={e.id}
                  onPress={() => setIdB(e.id)}
                  className={`px-3 py-2 border-b border-border/50 ${idB === e.id ? 'bg-primary/10' : ''}`}
                >
                  <Text className={`text-sm ${idB === e.id ? 'font-bold text-primary' : 'text-text'}`}>
                    v{e.version}.0 — {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {!canCompare ? (
          <Text className="text-sm text-text-muted text-center py-4">Select two different versions to compare.</Text>
        ) : isLoading ? (
          <LoadingSkeleton className="h-48 rounded-xl" />
        ) : cmp ? (
          <>
            {/* Section-by-section diff */}
            <Card>
              <Text className="text-sm font-bold text-text mb-3">Section Comparison</Text>
              <View className="flex-row pb-2 border-b border-border mb-1">
                <Text className="flex-1 text-xs font-semibold text-text-muted">Section</Text>
                <Text className="w-24 text-right text-xs font-semibold text-text-muted">A</Text>
                <Text className="w-24 text-right text-xs font-semibold text-text-muted">B</Text>
                <Text className="w-24 text-right text-xs font-semibold text-text-muted">Diff</Text>
              </View>
              {cmp.sectionDiff.map((d: EstimateComparison['sectionDiff'][number], i: number) => (
                <View key={i} className="flex-row py-1.5 border-b border-border/50">
                  <Text className="flex-1 text-sm text-text" numberOfLines={1}>{d.name}</Text>
                  <Text className="w-24 text-right text-xs text-text">{formatINR(d.amountA)}</Text>
                  <Text className="w-24 text-right text-xs text-text">{formatINR(d.amountB)}</Text>
                  <Text
                    className={`w-24 text-right text-xs font-semibold ${
                      d.diff > 0 ? 'text-danger' : d.diff < 0 ? 'text-success' : 'text-text-muted'
                    }`}
                  >
                    {d.diff > 0 ? '+' : ''}
                    {formatINR(Math.abs(d.diff))}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Grand total diff */}
            <Card className={cmp.grandTotalDiff > 0 ? 'border-l-4 border-danger' : 'border-l-4 border-success'}>
              <Text className="text-sm font-bold text-text mb-2">Grand Total Comparison</Text>
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-text-muted">Version A ({cmp.estimateA.name})</Text>
                <Text className="text-sm font-semibold text-text">{formatINR(cmp.estimateA.grandTotal)}</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-text-muted">Version B ({cmp.estimateB.name})</Text>
                <Text className="text-sm font-semibold text-text">{formatINR(cmp.estimateB.grandTotal)}</Text>
              </View>
              <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
                <Text className="text-base font-bold text-text">Difference</Text>
                <Text
                  className={`text-base font-bold ${
                    cmp.grandTotalDiff > 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {cmp.grandTotalDiff > 0 ? '+' : ''}
                  {formatINR(Math.abs(cmp.grandTotalDiff))} ({Math.abs(cmp.grandTotalPctChange).toFixed(1)}%)
                </Text>
              </View>
              <Text className="text-xs text-text-muted mt-2 text-center">
                Version B is {cmp.grandTotalDiff > 0 ? 'higher' : 'lower'} than Version A by{' '}
                {formatINR(Math.abs(cmp.grandTotalDiff))} ({Math.abs(cmp.grandTotalPctChange).toFixed(1)}%).
              </Text>
            </Card>
          </>
        ) : (
          <EmptyState title="No comparison data" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}