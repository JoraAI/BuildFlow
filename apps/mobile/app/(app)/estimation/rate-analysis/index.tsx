/**
 * BuildFlow - Rate Analysis Library screen.
 * Search + filter chips + cards with total rate, component summary, actions.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TextInput, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, FAB, LoadingSkeleton, EmptyState, Button } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { dismissTo, navigateAppBack, DISMISS } from '@/utils/navigation';
import {
  useRateAnalyses,
  useDuplicateRateAnalysis,
  useDeleteRateAnalysis,
  type RateAnalysis,
} from '@/services/estimate.queries';
import { confirmAsync } from '@/utils/confirm';
import { formatINR, formatDate } from '@/utils/format';
import { useAuthStore } from '@/stores/auth.store';

type Filter = 'all' | 'material' | 'labour' | 'equipment';

function dominantType(ra: RateAnalysis): 'material' | 'labour' | 'equipment' {
  const sums = { material: 0, labour: 0, equipment: 0 };
  for (const c of ra.components) {
    const amt = Number(c.amount);
    if (c.type === 'MATERIAL') sums.material += amt;
    else if (c.type === 'LABOUR') sums.labour += amt;
    else if (c.type === 'EQUIPMENT') sums.equipment += amt;
  }
  if (sums.material >= sums.labour && sums.material >= sums.equipment) return 'material';
  if (sums.labour >= sums.equipment) return 'labour';
  return 'equipment';
}

function componentSummary(ra: RateAnalysis) {
  const m = ra.components.filter((c) => c.type === 'MATERIAL').reduce((s, c) => s + Number(c.amount), 0);
  const l = ra.components.filter((c) => c.type === 'LABOUR').reduce((s, c) => s + Number(c.amount), 0);
  const e = ra.components.filter((c) => c.type === 'EQUIPMENT').reduce((s, c) => s + Number(c.amount), 0);
  const x = ra.components.filter((c) => c.type === 'MISC').reduce((s, c) => s + Number(c.amount), 0);
  return { m, l, e, x };
}

export default function RateAnalysisLibraryScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch, isFetching } = useRateAnalyses();
  const duplicate = useDuplicateRateAnalysis();
  const deleteMutation = useDeleteRateAnalysis();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    duplicate.mutate(id, {
      onSettled: () => setDuplicatingId(null),
      onError: () =>
        Alert.alert('Duplicate failed', 'Could not duplicate this rate analysis. Please try again.'),
    });
  };

  const performDelete = (id: string, force: boolean) => {
    setDeletingId(id);
    deleteMutation.mutate(
      { id, force },
      {
        onSettled: () => setDeletingId(null),
        onError: (err: unknown) => {
          // 409 = rate analysis is in use; ask the user to force delete
          const status = (err as { status?: number }).status;
          if (status === 409) {
            Alert.alert(
              'Rate analysis in use',
              'This rate analysis is linked to estimate item(s). Deleting it will unlink them (their rate will not auto-update anymore). Delete anyway?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete anyway', style: 'destructive', onPress: () => performDelete(id, true) },
              ],
            );
          } else {
            Alert.alert('Delete failed', 'Could not delete this rate analysis. Please try again.');
          }
        },
      },
    );
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmAsync(
      'Delete rate analysis',
      `Delete "${name}"? This cannot be undone.`,
    );
    if (ok) performDelete(id, false);
  };

  const canManage = user?.role === 'OWNER' || user?.role === 'PM';

  const analyses = useMemo(() => {
    let rows = data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r: RateAnalysis) => r.name.toLowerCase().includes(q));
    }
    if (filter !== 'all') {
      rows = rows.filter((r: RateAnalysis) => dominantType(r) === filter);
    }
    return rows;
  }, [data, search, filter]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <OfflineBanner />
      <FormScreenHeader
        title="Rate Analysis Library"
        subtitle="Search and manage rate analyses"
        onCancel={() =>
          navigateAppBack(
            from === 'settings' ? DISMISS.settings : from === 'proposals' ? DISMISS.proposals : DISMISS.estimation,
          )
        }
        cancelLabel="Back"
      />
      <View className="p-4 pb-2 gap-3">
        {/* Search */}
        <View className="flex-row items-center bg-card border border-border rounded-lg px-3">
          <Text className="text-text-muted mr-2">🔍</Text>
          <TextInput
            placeholder="Search analyses..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            className="flex-1 py-2.5 text-text"
          />
        </View>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {(['all', 'material', 'labour', 'equipment'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full border ${filter === f ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            >
              <Text className={`text-xs font-semibold capitalize ${filter === f ? 'text-white' : 'text-text-muted'}`}>
                {f === 'all' ? 'All' : `${f}-heavy`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-2 gap-3"
        contentContainerStyle={{ paddingBottom: mobileListBottomPadding(true) }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : analyses.length === 0 ? (
          <EmptyState
            title="No rate analyses"
            description="Create your first rate analysis to reuse across estimates."
            action={canManage ? <Button label="Create Rate Analysis" onPress={() => router.push('/(app)/estimation/rate-analysis/new')} /> : undefined}
          />
        ) : (
          analyses.map((ra: RateAnalysis) => {
            const s = componentSummary(ra);
            return (
              <Card key={ra.id}>
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-semibold text-text">{ra.name}</Text>
                    <Text className="text-xs text-text-muted">per {ra.unit}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-lg font-bold text-primary">{formatINR(ra.totalRate)}</Text>
                    {ra.stale && <Badge label="Stale" color="warning" />}
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-2">
                  <Text className="text-xs text-text-muted">Materials: {formatINR(s.m)}</Text>
                  <Text className="text-xs text-text-muted">Labour: {formatINR(s.l)}</Text>
                  <Text className="text-xs text-text-muted">Equip: {formatINR(s.e)}</Text>
                  <Text className="text-xs text-text-muted">Misc: {formatINR(s.x)}</Text>
                </View>
                <Text className="text-xs text-text-muted mb-2">Updated {formatDate(ra.updatedAt)}</Text>
                <View className="flex-row gap-2">
                  <Button label="View" size="sm" variant="secondary" onPress={() => router.push(`/(app)/estimation/rate-analysis/${ra.id}`)} />
                  {canManage && (
                    <>
                      <Button
                        label="Duplicate"
                        size="sm"
                        variant="ghost"
                        loading={duplicatingId === ra.id}
                        onPress={() => handleDuplicate(ra.id)}
                      />
                      <Button
                        label="Delete"
                        size="sm"
                        variant="ghost"
                        loading={deletingId === ra.id}
                        onPress={() => handleDelete(ra.id, ra.name)}
                      />
                    </>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {canManage && <FAB onPress={() => router.push('/(app)/estimation/rate-analysis/new')} />}
    </SafeAreaView>
  );
}