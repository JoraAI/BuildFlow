/**
 * BuildFlow - Proposals hub (replaces Estimation tab).
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, FAB, EmptyState, Badge, LoadingSkeleton } from '@/components/ui';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useViewport } from '@/hooks/useViewport';
import { useRateAnalyses } from '@/services/estimate.queries';
import { useProposals, type ProposalListItem } from '@/services/proposal.queries';
import { useAuthStore } from '@/stores/auth.store';
import { PROPOSAL_STATUS_META } from '@buildflow/shared';
import { formatINR, formatDate } from '@/utils/format';

type Filter = 'ALL' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SENT' | 'WON' | 'LOST';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Won', value: 'WON' },
  { label: 'Lost', value: 'LOST' },
];

export default function ProposalsHubScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isDesktop } = useViewport();
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data: raData, refetch: refetchRa, isFetching: raFetching } = useRateAnalyses();
  const { data: proposals, refetch, isFetching, isLoading } = useProposals();

  const analyses = raData ?? [];
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';

  const filtered = (proposals ?? []).filter((p: ProposalListItem) =>
    filter === 'ALL' ? true : p.status === filter,
  );

  const openCount = (proposals ?? []).filter((p: ProposalListItem) =>
    ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT'].includes(p.status),
  ).length;

  function handleRefresh() {
    refetch();
    refetchRa();
  }

  const newProposalAction = canManage ? (
    <Button
      label="New Proposal"
      size="sm"
      onPress={() => router.push('/(app)/proposals/create')}
      icon={<Ionicons name="add" size={18} color="#fff" />}
    />
  ) : null;

  const shortcuts = (
    <ResponsiveGrid gap={16} columns={isDesktop ? 2 : 1}>
      <Card onPress={() => router.push('/(app)/estimation/rate-analysis?from=proposals')}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-text">Rate Analysis Library</Text>
            <Text className="text-sm text-text-muted mt-0.5">{analyses.length} analyses in library</Text>
          </View>
          <Text className="text-primary text-2xl">›</Text>
        </View>
      </Card>
      <Card onPress={() => router.push('/(app)/settings/material-prices')}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-base font-semibold text-text">Material Price Tracker</Text>
            <Text className="text-sm text-text-muted mt-0.5">Track market rates over time</Text>
          </View>
          <Text className="text-primary text-2xl">›</Text>
        </View>
      </Card>
    </ResponsiveGrid>
  );

  const filterChips = (
    <View className="flex-row gap-2 flex-wrap mb-3">
      {FILTERS.map((f) => (
        <Pressable
          key={f.value}
          onPress={() => setFilter(f.value)}
          className={`px-3 py-1.5 rounded-lg border ${
            filter === f.value ? 'bg-primary border-primary' : 'bg-card border-border'
          }`}
        >
          <Text
            className={`text-xs font-medium ${filter === f.value ? 'text-white' : 'text-muted'}`}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const proposalsList = isLoading ? (
    <View className="gap-2">
      {[1, 2, 3].map((i) => (
        <LoadingSkeleton key={i} className="h-24 rounded-xl" />
      ))}
    </View>
  ) : filtered.length === 0 ? (
    <EmptyState
      title="No proposals yet"
      description="Create a proposal to quote clients before starting a full project."
      action={
        canManage ? (
          <Button label="New Proposal" onPress={() => router.push('/(app)/proposals/create')} />
        ) : undefined
      }
    />
  ) : (
    <ResponsiveGrid>
      {filtered.map((p: ProposalListItem) => {
        const latest = p.temporaryProject?.estimates?.[0];
        const statusMeta = PROPOSAL_STATUS_META[p.status as keyof typeof PROPOSAL_STATUS_META];
        return (
          <Card key={p.id} onPress={() => router.push(`/(app)/proposals/${p.id}`)} className="h-full">
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1 pr-2">
                <Text className="text-base font-semibold text-text">{p.title}</Text>
                <Text className="text-sm text-text-muted">{p.clientName}</Text>
              </View>
              <Badge color="primary" label={statusMeta?.label ?? p.status} />
            </View>
            <View className="flex-row justify-between items-center pt-2 mt-1 border-t border-border">
              <Text className="text-xs text-text-muted">
                {p.validUntil ? `Valid until ${formatDate(p.validUntil)}` : formatDate(p.updatedAt)}
              </Text>
              {latest ? (
                <Text className="text-sm font-bold text-primary">
                  {formatINR(Number(latest.grandTotal))}
                </Text>
              ) : (
                <Text className="text-xs text-text-muted">No estimate</Text>
              )}
            </View>
          </Card>
        );
      })}
    </ResponsiveGrid>
  );

  const content = (
    <View className={`gap-4 ${isDesktop ? '' : 'p-4'}`}>
      {!isDesktop && (
        <MobileScreenHeader
          title="Proposals"
          subtitle={`${openCount} open · Rate library & material pricing`}
        />
      )}
      {shortcuts}
      <View>
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">
          Proposals
        </Text>
        {filterChips}
        {proposalsList}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <OfflineBanner />
      {isDesktop ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center pb-10"
          refreshControl={
            <RefreshControl refreshing={isFetching || raFetching} onRefresh={handleRefresh} />
          }
        >
          <View className="w-full max-w-7xl px-8 py-6">
            <PageHeader
              title="Proposals"
              subtitle={`${openCount} open · Rate library & material pricing`}
              actions={newProposalAction}
            />
            {content}
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={isFetching || raFetching} onRefresh={handleRefresh} />
            }
            contentContainerStyle={{ paddingBottom: mobileListBottomPadding(canManage) }}
          >
            {content}
          </ScrollView>
          {canManage && (
            <FAB label="New Proposal" onPress={() => router.push('/(app)/proposals/create')} />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
