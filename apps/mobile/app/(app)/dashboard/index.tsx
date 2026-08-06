/**
 * BuildFlow - Owner Analytics Dashboard.
 *
 * Widgets:
 *   - KPI row (projects, revenue, outstanding, avg progress)
 *   - Project progress race bars
 *   - Budget burn gauges
 *   - Estimation accuracy leaderboard
 *   - Team productivity
 *   - Material price trends
 *
 * Non-OWNER roles see a simpler welcome dashboard.
 */
import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import {
  useAnalyticsDashboard,
  type AnalyticsDashboard,
  type BudgetBurnRow,
  type ProjectProgressRow,
  type TeamProductivityRow,
  type EstimationAccuracyRow,
  type MaterialTrend,
} from '@/services/analytics.queries';
import { Card, LoadingSkeleton, EmptyState, Button } from '@/components/ui';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader, StatChip } from '@/components/layout/PageHeader';
import { MobileScreenHeader } from '@/components/layout/ScreenHeader';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { useViewport } from '@/hooks/useViewport';
import { formatINRCompact, formatINR } from '@/utils/format';
import { RolePlaybookCard } from '@/components/dashboard/RolePlaybookCard';
import { OwnerWelcomeModal } from '@/components/onboarding/OwnerWelcomeModal';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { isDesktop } = useViewport();
  const { data, isLoading, isError, refetch, isFetching } = useAnalyticsDashboard();

  // Non-OWNER: simple welcome screen.
  if (user && user.role !== 'OWNER') {
    const welcome = (
      <>
        <RolePlaybookCard role={user.role} />
        <Card className="mt-2">
          <Text className="text-base font-bold text-text mb-2">Quick actions</Text>
          <View className="gap-2">
            <ActionRow label="View Projects" onPress={() => router.push('/projects')} />
            <ActionRow label="Daily Reports" onPress={() => router.push('/reports')} />
            {user.role === 'ACCOUNTANT' && (
              <ActionRow label="Accounting" onPress={() => router.push('/accounting')} />
            )}
            {(user.role === 'ACCOUNTANT' || user.role === 'PM') && (
              <ActionRow label="Reports Hub" onPress={() => router.push('/reports-hub')} />
            )}
            {user.role === 'PM' && (
              <ActionRow label="Proposals" onPress={() => router.push('/proposals')} />
            )}
          </View>
        </Card>
      </>
    );

    if (isDesktop) {
      return (
        <SafeAreaView className="flex-1 bg-surface" edges={[]}>
          <ScreenContainer scrollable>
            <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Welcome back to BuildFlow." />
            {welcome}
          </ScreenContainer>
        </SafeAreaView>
      );
    }

    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-8 flex-1">
        <MobileScreenHeader
          title={`Hello, ${user.name.split(' ')[0]}`}
          subtitle="Welcome back to BuildFlow."
        />
        {welcome}
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="p-4">
        <LoadingSkeleton className="h-24 w-full" />
        <View className="h-4" />
        <LoadingSkeleton className="h-32 w-full" />
        <View className="h-4" />
        <LoadingSkeleton className="h-40 w-full" />
      </ScrollView>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 bg-surface justify-center">
        <EmptyState
          title="Couldn't load dashboard"
          description="Pull to refresh or try again."
          action={<Button label="Retry" onPress={() => refetch()} />}
        />
      </View>
    );
  }

  const d: AnalyticsDashboard = data;
  const { kpis, projectProgress, teamProductivity, budgetBurn, estimationAccuracy, materialTrends } =
    d;
  const cashFlowForecast = d.cashFlowForecast ?? [];
  const maxBurn = Math.max(100, ...budgetBurn.map((b: BudgetBurnRow) => b.burnPct));
  const maxReports = Math.max(1, ...teamProductivity.map((t: TeamProductivityRow) => t.reportsCount));

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const content = (
    <>
      {isDesktop ? (
        <PageHeader
          title="Owner Dashboard"
          subtitle={dateLabel}
          stats={
            <>
              <StatChip label="Active Projects" value={String(kpis.activeProjects)} />
              <StatChip label="Revenue" value={formatINRCompact(kpis.totalRevenue)} accent="success" />
              <StatChip label="Outstanding" value={formatINRCompact(kpis.totalOutstanding)} accent="warning" />
              <StatChip label="Avg Progress" value={`${kpis.avgProgress}%`} accent="primary" />
            </>
          }
        />
      ) : (
        <>
          <MobileScreenHeader title="Owner Dashboard" subtitle={dateLabel} />
          <ResponsiveGrid gap={8} columns={2}>
            <KpiCard label="Active Projects" value={String(kpis.activeProjects)} sub={`${kpis.totalProjects} total`} color="#1E3A5F" />
            <KpiCard label="Revenue (Paid)" value={formatINRCompact(kpis.totalRevenue)} color="#10B981" />
            <KpiCard label="Outstanding" value={formatINRCompact(kpis.totalOutstanding)} color="#F97316" />
            <KpiCard label="Avg Progress" value={`${kpis.avgProgress}%`} color="#F59E0B" />
          </ResponsiveGrid>
        </>
      )}

      <Card className="mt-4">
        <Text className="text-base font-bold text-text mb-2">Quick actions</Text>
        <View className="gap-2">
          <ActionRow label="Reports Hub" onPress={() => router.push('/reports-hub')} />
          <ActionRow label="Accounting" onPress={() => router.push('/accounting')} />
          <ActionRow label="Proposals" onPress={() => router.push('/proposals')} />
          <ActionRow label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </Card>

      <ResponsiveGrid gap={16} className="mt-4">
        {/* CASH FLOW FORECAST */}
        <Card>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-base font-bold text-text">Cash Flow Forecast (90d)</Text>
            <Pressable
              onPress={() => router.push('/reports-hub')}
              className="flex-row items-center gap-0.5"
            >
              <Text className="text-sm font-semibold text-primary">Reports Hub</Text>
              <Ionicons name="chevron-forward" size={16} color="#1E3A5F" />
            </Pressable>
          </View>
          <View className="mt-3 gap-2">
            {cashFlowForecast.slice(0, 6).map((pt) => (
              <View key={pt.date} className="flex-row justify-between items-center">
                <Text className="text-xs text-muted">{pt.date}</Text>
                <Text className={`text-sm font-semibold ${pt.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  {pt.net >= 0 ? '+' : ''}{formatINRCompact(pt.net)}
                </Text>
              </View>
            ))}
            {cashFlowForecast.length === 0 && (
              <Text className="text-sm text-muted italic text-center py-3">No forecast data yet.</Text>
            )}
          </View>
        </Card>

        {/* PROJECT PROGRESS */}
        <Card>
        <Text className="text-base font-bold text-text">Project Progress</Text>
        <View className="mt-3 gap-2.5">
          {projectProgress.slice(0, 6).map((p: ProjectProgressRow) => (
            <Pressable key={p.id} onPress={() => router.push(`/projects/${p.id}`)}>
              <Text className="text-sm font-semibold text-text" numberOfLines={1}>{p.name}</Text>
              <Bar
                pct={p.progress}
                color={p.progress >= 75 ? '#10B981' : p.progress >= 40 ? '#F59E0B' : '#F97316'}
              />
              <Text className="text-xs text-muted mt-1">{p.progress}% • {formatINRCompact(p.budget)}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

        {/* BUDGET BURN */}
        <Card>
        <Text className="text-base font-bold text-text">Budget Burn</Text>
        <View className="mt-3 gap-2.5">
          {budgetBurn.slice(0, 6).map((b: BudgetBurnRow) => {
            const over = b.burnPct > 90;
            return (
              <View key={b.projectId}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm font-semibold text-text" numberOfLines={1}>{b.projectName}</Text>
                  <Text className={`text-xs ${over ? 'text-danger' : 'text-muted'}`}>{b.burnPct}%</Text>
                </View>
                <Bar
                  pct={Math.min(100, (b.burnPct / maxBurn) * 100)}
                  color={over ? '#EF4444' : b.burnPct > 70 ? '#F97316' : '#10B981'}
                />
                <Text className="text-xs text-muted mt-1">{formatINRCompact(b.spent)} of {formatINRCompact(b.budget)}</Text>
              </View>
            );
          })}
        </View>
      </Card>

        {/* ESTIMATION ACCURACY */}
        <Card>
        <Text className="text-base font-bold text-text">Estimation Accuracy</Text>
        <View className="mt-3 gap-2.5">
          {estimationAccuracy.map((e: EstimationAccuracyRow, idx: number) => (
            <View key={e.projectId} className="flex-row items-center gap-2.5">
              <View className={`w-7 h-7 rounded-full justify-center items-center ${idx === 0 ? 'bg-accent' : 'bg-border'}`}>
                <Text className={`text-xs font-bold ${idx === 0 ? 'text-white' : 'text-muted'}`}>#{idx + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text" numberOfLines={1}>{e.projectName}</Text>
                <Text className="text-xs text-muted">
                  Var {e.variancePct > 0 ? '+' : ''}{e.variancePct}% · {formatINRCompact(e.estimated)} to {formatINRCompact(e.actual)}
                </Text>
              </View>
              <View className={`px-2.5 py-1 rounded-xl ${e.accuracyScore >= 80 ? 'bg-success' : e.accuracyScore >= 60 ? 'bg-accent' : 'bg-danger'}`}>
                <Text className="text-white font-extrabold text-sm">{e.accuracyScore}</Text>
              </View>
            </View>
          ))}
          {estimationAccuracy.length === 0 && (
            <Text className="text-sm text-muted italic text-center py-3">No approved estimates yet.</Text>
          )}
        </View>
      </Card>

        {/* TEAM PRODUCTIVITY */}
        <Card>
        <Text className="text-base font-bold text-text">Team Productivity (30d)</Text>
        <View className="mt-3 gap-2.5">
          {teamProductivity.slice(0, 6).map((t: TeamProductivityRow) => (
            <View key={t.userId}>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-semibold text-text">{t.name}</Text>
                <Text className="text-xs text-muted">{t.reportsCount} reports</Text>
              </View>
              <Bar pct={(t.reportsCount / maxReports) * 100} color="#1E3A5F" />
              <Text className="text-xs text-muted mt-1">{t.role}</Text>
            </View>
          ))}
          {teamProductivity.length === 0 && (
            <Text className="text-sm text-muted italic text-center py-3">No reports in the last 30 days.</Text>
          )}
        </View>
      </Card>

        {/* MATERIAL TRENDS */}
        <Card>
        <Text className="text-base font-bold text-text">Material Price Trends (6mo)</Text>
        <View className="mt-3 gap-3">
          {materialTrends.map((m: MaterialTrend) => {
            const first = m.points[0]?.rate ?? 0;
            const last = m.points[m.points.length - 1]?.rate ?? 0;
            const change = first ? ((last - first) / first) * 100 : 0;
            const up = change > 0;
            return (
              <Pressable key={m.resourceId} onPress={() => router.push('/settings/material-prices')}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm font-semibold text-text" numberOfLines={1}>{m.name}</Text>
                  <Text className={`text-xs ${up ? 'text-danger' : 'text-success'}`}>
                    {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                  </Text>
                </View>
                <Text className="text-xs text-muted mt-1">
                  {formatINR(first)} to {formatINR(last)} / {m.unit}
                </Text>
                <MiniSparkline points={m.points.map((p: { rate: number }) => p.rate)} color={up ? '#EF4444' : '#10B981'} />
              </Pressable>
            );
          })}
          {materialTrends.length === 0 && (
            <Text className="text-sm text-muted italic text-center py-3">No price history recorded yet.</Text>
          )}
        </View>
      </Card>
      </ResponsiveGrid>
    </>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <OwnerWelcomeModal />
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center pb-10"
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-7xl px-8 py-6">{content}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <OwnerWelcomeModal />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="p-4 pb-8"
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        {content}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row justify-between items-center py-3 px-2 rounded-lg active:bg-surface"
    >
      <Text className="text-base font-semibold text-primary">{label}</Text>
      <Text className="text-2xl text-muted">›</Text>
    </Pressable>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <View className="bg-card rounded-xl border border-border p-3 h-full" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <Text className="text-xs text-muted font-semibold uppercase">{label}</Text>
      <Text className="text-xl font-extrabold text-text mt-1">{value}</Text>
      {sub ? <Text className="text-xs text-muted mt-0.5">{sub}</Text> : null}
    </View>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <View className="h-2 bg-border rounded-full mt-1 overflow-hidden">
      <View className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
    </View>
  );
}

function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const h = 24;
  return (
    <View className="flex-row items-end mt-1 gap-0.5" style={{ height: h }}>
      {points.map((p, i) => {
        const bh = ((p - min) / range) * h;
        return <View key={i} className="flex-1 rounded-sm" style={{ height: Math.max(2, bh), backgroundColor: color, opacity: 0.6 }} />;
      })}
    </View>
  );
}