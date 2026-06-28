import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Card, Badge, ProgressBar, LoadingSkeleton, EmptyState, Button, Input } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { desktopContentBottomPadding, mobileListBottomPadding } from '@/components/layout/fab-layout';
import { dismissTo, DISMISS } from '@/utils/navigation';
import { alertAsync } from '@/utils/confirm';
import { useViewport } from '@/hooks/useViewport';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import {
  useProject,
  useProjectSummary,
} from '@/services/project.queries';
import { useProjectEstimates, type EstimateListRow } from '@/services/estimate.queries';
import { VariationsTab } from '@/components/projects/VariationsTab';
import { ProcurementTab } from '@/components/projects/ProcurementTab';
import { SubcontractsTab } from '@/components/projects/SubcontractsTab';
import { ScheduleTab } from '@/components/projects/ScheduleTab';
import { ProjectReportsTab } from '@/components/projects/ProjectReportsTab';
import { BoqTab } from '@/components/projects/BoqTab';
import { ResourcesTab } from '@/components/projects/ResourcesTab';
import { ProjectMembersSection } from '@/components/projects/ProjectMembersSection';
import { ProjectMaterialRatesSection } from '@/components/projects/ProjectMaterialRatesSection';
import { useCreatePortalAccess } from '@/services/expansion.queries';
import { useAuthStore } from '@/stores/auth.store';
import { formatINR, formatINRCompact, formatDate, daysBetween } from '@/utils/format';

type Tab = 'overview' | 'estimate' | 'schedule' | 'boq' | 'variations' | 'procurement' | 'subcontracts' | 'resources' | 'reports' | 'settings';

const TABS: { label: string; value: Tab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Estimate', value: 'estimate' },
  { label: 'Schedule', value: 'schedule' },
  { label: 'BOQ', value: 'boq' },
  { label: 'Variations', value: 'variations' },
  { label: 'Procurement', value: 'procurement' },
  { label: 'Subcontracts', value: 'subcontracts' },
  { label: 'Resources', value: 'resources' },
  { label: 'Reports', value: 'reports' },
  { label: 'Settings', value: 'settings' },
];

export default function ProjectDetailScreen() {
  const { id: idParam, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const tabFromUrl = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState<Tab>('overview');
  const { data: project, isLoading, refetch, isFetching } = useProject(id);
  const summaryQ = useProjectSummary(id);

  // Reset tab when project changes; honour ?tab= for deep links (e.g. after BOQ conversion).
  useEffect(() => {
    const valid = tabFromUrl && TABS.some((t) => t.value === tabFromUrl);
    setTab(valid ? (tabFromUrl as Tab) : 'overview');
  }, [id, tabFromUrl]);

  if (isLoading) {
    const body = (
      <View className="p-4 gap-4">
        <LoadingSkeleton className="h-20 rounded-xl" />
        <LoadingSkeleton className="h-10 rounded-full" />
        <LoadingSkeleton className="h-64 rounded-xl" />
      </View>
    );
    if (isDesktop) {
      return (
        <View className="flex-1 min-h-0 bg-surface px-8 pt-6 max-w-6xl w-full self-center">
          <PageHeader title="Project" subtitle="Loading…" />
          {body}
        </View>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <FormScreenHeader title="Project" onCancel={() => dismissTo(DISMISS.projects)} />
        {body}
      </SafeAreaView>
    );
  }

  if (!project) {
    if (isDesktop) {
      return (
        <View className="flex-1 min-h-0 bg-surface px-8 pt-6 max-w-6xl w-full self-center">
          <PageHeader title="Project not found" subtitle="This project may have been deleted." />
          <EmptyState title="Project not found" description="This project may have been deleted." />
        </View>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <FormScreenHeader title="Project not found" onCancel={() => dismissTo(DISMISS.projects)} />
        <EmptyState title="Project not found" description="This project may have been deleted." />
      </SafeAreaView>
    );
  }

  const statusBadge = (
    <Badge
      color={project.status === 'COMPLETED' ? 'success' : project.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}
      label={project.status.replace('_', ' ')}
    />
  );

  const tabBar = (
    <View className="bg-surface border-b border-border">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 py-2 gap-2">
        {TABS.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setTab(t.value)}
            className={`px-4 py-2 rounded-full ${
              tab === t.value ? 'bg-primary' : 'bg-card border border-border'
            }`}
          >
            <Text className={`text-sm font-semibold ${tab === t.value ? 'text-white' : 'text-muted'}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const tabContent = (
    <View className={isDesktop ? 'px-8 py-4 max-w-6xl w-full self-center' : 'p-4 pb-32'}>
      {tab === 'overview' && (
        <OverviewTab projectId={id} summary={summaryQ.data} summaryLoading={summaryQ.isLoading} project={project} />
      )}
      {tab === 'estimate' && <EstimateTab projectId={id} />}
      {tab === 'schedule' && <ScheduleTab projectId={id} />}
      {tab === 'boq' && <BoqTab projectId={id} />}
      {tab === 'variations' && <VariationsTab projectId={id} />}
      {tab === 'procurement' && <ProcurementTab projectId={id} />}
      {tab === 'subcontracts' && <SubcontractsTab projectId={id} />}
      {tab === 'resources' && <ResourcesTab projectId={id} />}
      {tab === 'reports' && <ProjectReportsTab projectId={id} />}
      {tab === 'settings' && <SettingsTab projectId={id} />}
    </View>
  );

  if (isDesktop) {
    return (
      <View className="flex-1 min-h-0 bg-surface">
        <Stack.Screen options={{ title: project.name }} />
        <ScrollView
          className="flex-1 min-h-0"
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: desktopContentBottomPadding() }}
          showsVerticalScrollIndicator
        >
          <View className="px-8 pt-6 pb-2 max-w-6xl w-full self-center">
            <PageHeader
              title={project.name}
              subtitle={`${project.code} · ${project.clientName}`}
              actions={
                <View className="flex-row gap-1">
                  <Badge color="primary" label={project.type} />
                  {statusBadge}
                </View>
              }
            />
            <Card>
              {project.locationAddress ? (
                <Text className="text-sm text-muted" numberOfLines={2}>
                  📍 {project.locationAddress}
                </Text>
              ) : (
                <Text className="text-sm text-muted">No site address on file</Text>
              )}
            </Card>
          </View>
          {tabBar}
          {tabContent}
        </ScrollView>
      </View>
    );
  }

    return (
      <SafeAreaView className="flex-1 bg-surface min-h-0" edges={[]}>
      <Stack.Screen options={{ title: project.name }} />
      <FormScreenHeader
        title={project.name}
        subtitle={project.code}
        onCancel={() => dismissTo(DISMISS.projects)}
        cancelLabel="Back"
      />
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: mobileListBottomPadding() }}
      >
        <View className="px-4 pt-2 pb-2">
          <Card>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1" />
              <View className="flex-row gap-1">
                <Badge color="primary" label={project.type} />
                {statusBadge}
              </View>
            </View>
            <Text className="text-sm text-muted">{project.clientName}</Text>
            {project.locationAddress ? (
              <Text className="text-xs text-muted mt-1" numberOfLines={1}>
                📍 {project.locationAddress}
              </Text>
            ) : null}
          </Card>
        </View>
        {tabBar}
        {tabContent}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Tab                                                        */
/* ------------------------------------------------------------------ */

function OverviewTab({
  projectId,
  summary,
  summaryLoading,
  project,
}: {
  projectId: string;
  summary?: import('@/services/project.queries').ProjectSummary;
  summaryLoading: boolean;
  project: import('@/services/project.queries').ProjectDetail;
}) {
  const budget = parseFloat(project.budget ?? '0');

  return (
    <View className="gap-4">
      {/* KPI Row */}
      <ResponsiveGrid gap={12} columns={2}>
        <KpiCard
          label="Budget"
          value={formatINRCompact(budget)}
          sub={summary ? `${summary.budgetUtilizationPct.toFixed(0)}% used` : '-'}
        />
        <KpiCard
          label="Progress"
          value={summary ? `${summary.actualProgressPct.toFixed(0)}%` : '-'}
          sub={summary ? `Planned ${summary.plannedProgressPct.toFixed(0)}%` : '-'}
        />
        <KpiCard
          label="Days Left"
          value={project.endDate ? `${Math.max(0, daysBetween(new Date(), project.endDate))}d` : '-'}
          sub={project.endDate ? formatDate(project.endDate) : 'No end date'}
        />
        <KpiCard
          label="Overdue"
          value={summary ? `${summary.tasksOverdueCount}` : '-'}
          sub="tasks"
          color={summary && summary.tasksOverdueCount > 0 ? '#EF4444' : undefined}
        />
      </ResponsiveGrid>

      {/* Schedule Variance */}
      {summary && (
        <Card>
          <Text className="text-sm font-bold text-text mb-2">Schedule Health</Text>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-muted">Variance</Text>
            <Text
              className={`text-sm font-semibold ${
                summary.scheduleVarianceDays > 0 ? 'text-danger' : 'text-success'
              }`}
            >
              {summary.scheduleVarianceDays === 0
                ? 'On schedule'
                : summary.scheduleVarianceDays > 0
                ? `${summary.scheduleVarianceDays} days behind`
                : `${Math.abs(summary.scheduleVarianceDays)} days ahead`}
            </Text>
          </View>
          <ProgressBar
            value={summary.actualProgressPct}
            color={summary.scheduleVarianceDays > 0 ? '#EF4444' : '#10B981'}
          />
        </Card>
      )}

      {/* Estimate vs Actual */}
      {summary && summary.approvedEstimateTotal > 0 && (
        <Card>
          <Text className="text-sm font-bold text-text mb-3">Estimate vs Actual</Text>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">Approved Estimate</Text>
            <Text className="text-sm font-semibold text-text">{formatINR(summary.approvedEstimateTotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm text-muted">Actual Spend</Text>
            <Text className="text-sm font-semibold text-text">
              {formatINR(summary.approvedEstimateTotal + summary.estimateVsActualVariance)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center pt-2 border-t border-border">
            <Text className="text-sm font-bold">Variance</Text>
            <Text
              className={`text-sm font-bold ${
                summary.estimateVsActualVariance > 0 ? 'text-danger' : 'text-success'
              }`}
            >
              {summary.estimateVsActualVariance > 0 ? '+' : ''}
              {formatINR(Math.abs(summary.estimateVsActualVariance))} (
              {summary.approvedEstimateTotal > 0
                ? ((summary.estimateVsActualVariance / summary.approvedEstimateTotal) * 100).toFixed(1)
                : '0'}
              %)
            </Text>
          </View>
        </Card>
      )}

      {summaryLoading && <LoadingSkeleton className="h-32 rounded-xl" />}

      {/* Project Details */}
      <Card>
        <Text className="text-sm font-bold text-text mb-2">Details</Text>
        <DetailRow label="Start Date" value={project.startDate ? formatDate(project.startDate) : '-'} />
        <DetailRow label="End Date" value={project.endDate ? formatDate(project.endDate) : '-'} />
        <DetailRow label="Client" value={project.clientName} />
        {project.clientContact ? <DetailRow label="Contact" value={project.clientContact} /> : null}
      </Card>
    </View>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View className="bg-card rounded-xl border border-border p-3 h-full">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text className="text-lg font-bold" style={{ color: color ?? '#0F172A' }}>
        {value}
      </Text>
      {sub ? <Text className="text-xs text-muted">{sub}</Text> : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-text">{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Estimate Tab                                                        */
/* ------------------------------------------------------------------ */

const ESTIMATE_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'neutral',
};

function EstimateTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useProjectEstimates(projectId);
  const estimates = data ?? [];

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load estimates"
        description="There was a problem fetching estimates for this project."
        action={<Button label="Retry" onPress={() => refetch()} />}
      />
    );
  }

  if (estimates.length === 0) {
    return (
      <EmptyState
        title="No estimates yet"
        description="Create your first cost estimate for this project."
        action={
          <Button label="New Estimate" onPress={() => router.push(`/(app)/estimation/create?projectId=${projectId}`)} />
        }
      />
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">{estimates.length} Versions</Text>
        <Button
          label="New Estimate"
          size="sm"
          onPress={() => router.push(`/(app)/estimation/create?projectId=${projectId}`)}
        />
      </View>

      {estimates.length >= 2 && (
        <Button
          label="Compare Versions"
          variant="secondary"
          size="sm"
          onPress={() => router.push(`/(app)/estimation/compare?projectId=${projectId}`)}
        />
      )}

      {estimates.map((e: EstimateListRow) => (
        <Card
          key={e.id}
          onPress={() => router.push(`/(app)/estimation/${e.id}`)}
          className={e.status === 'APPROVED' ? 'border-2 border-accent' : undefined}
        >
          <View className="flex-row justify-between items-start mb-1">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-semibold text-text">v{e.version}.0 - {e.name}</Text>
              <Text className="text-xs text-text-muted">{formatDate(e.createdAt)}</Text>
            </View>
            <Badge color={(ESTIMATE_STATUS_COLOR[e.status] ?? 'neutral') as 'neutral'} label={e.status} />
          </View>
          <View className="flex-row justify-between items-center pt-2 mt-1 border-t border-border">
            <Text className="text-xs text-text-muted">Grand Total</Text>
            <Text className="text-base font-bold text-primary">{formatINR(Number(e.grandTotal))}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Settings Tab (members + portal)                                     */
/* ------------------------------------------------------------------ */

function SettingsTab({ projectId }: { projectId: string }) {
  const user = useAuthStore((s) => s.user);
  const canPortal = user?.role === 'OWNER' || user?.role === 'PM';
  const createPortal = useCreatePortalAccess(projectId);
  const [portalLabel, setPortalLabel] = useState('Client portal');

  const onGeneratePortal = () => {
    createPortal.mutate(
      {
        label: portalLabel.trim() || 'Client portal',
        scopes: ['VIEW_PROGRESS', 'VIEW_INVOICES'],
        expiresInDays: 30,
      },
      {
        onSuccess: async (result) => {
          const url = `${Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://app.buildflow.in'}/portal/${result.token}`;
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            await alertAsync('Portal link created', 'Link copied to clipboard.');
          } else {
            await Share.share({ message: `Project portal: ${url}`, url });
          }
        },
        onError: async (e: Error) => {
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  return (
    <View className="gap-4">
      <ProjectMembersSection projectId={projectId} />
      <ProjectMaterialRatesSection projectId={projectId} />
      {canPortal && (
        <Card>
          <Text className="text-sm font-bold text-text mb-2">Client Portal</Text>
          <Text className="text-xs text-muted mb-3">
            Generate a shareable link for clients to view progress and invoices.
          </Text>
          <Input
            label="Link label"
            value={portalLabel}
            onChangeText={setPortalLabel}
            placeholder="Client portal"
          />
          <Button
            label={createPortal.isPending ? 'Generating...' : 'Generate portal link'}
            onPress={onGeneratePortal}
            loading={createPortal.isPending}
            fullWidth
          />
        </Card>
      )}
    </View>
  );
}