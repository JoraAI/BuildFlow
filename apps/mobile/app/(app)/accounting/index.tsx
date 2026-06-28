/**
 * BuildFlow — Accounting Hub (Invoices | Bills | Dashboard)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  RefreshControl,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, FAB, EmptyState, LoadingSkeleton, Button } from '@/components/ui';
import { MobileScreenHeader, FilterChip, FilterChipRow } from '@/components/layout/ScreenHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PageHeader, StatChip } from '@/components/layout/PageHeader';
import { ProjectInvoicesList, ProjectBillsList } from '@/components/accounting/InvoiceBillLists';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyDashboard, type CompanyDashboard } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { formatINR, formatINRCompact } from '@/utils/format';

type Tab = 'INVOICES' | 'BILLS' | 'DASHBOARD';

export default function AccountingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isDesktop } = useViewport();
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState<Tab>('INVOICES');
  const { data: projects } = useProjects();
  const { data: dashboard } = useCompanyDashboard();

  const tabs = [
    { label: 'Invoices', value: 'INVOICES' as Tab },
    { label: 'Bills', value: 'BILLS' as Tab },
    ...(isOwner ? [{ label: 'Dashboard', value: 'DASHBOARD' as Tab }] : []),
  ];

  const createAction =
    tab === 'INVOICES' || tab === 'BILLS' ? (
      <Button
        label={tab === 'INVOICES' ? 'New Invoice' : 'New Bill'}
        size="sm"
        onPress={() =>
          router.push(`/accounting/${tab === 'INVOICES' ? 'create-invoice' : 'create-bill'}`)
        }
        icon={<Ionicons name="add" size={18} color="#fff" />}
      />
    ) : null;

  const tabChips = (
    <FilterChipRow>
      {tabs.map((t) => (
        <FilterChip
          key={t.value}
          label={t.label}
          active={tab === t.value}
          onPress={() => setTab(t.value)}
        />
      ))}
    </FilterChipRow>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={[]}>
        <OfflineBanner />
        <ScreenContainer scrollable={tab === 'DASHBOARD'} constrained>
          <PageHeader
            title="Accounting"
            subtitle="Invoices, bills, GST & TDS"
            actions={createAction}
            stats={
              tab === 'DASHBOARD' && dashboard ? (
                <>
                  <StatChip label="Invoiced" value={formatINRCompact(dashboard.totalInvoiced)} />
                  <StatChip label="Collected" value={formatINRCompact(dashboard.totalCollected)} accent="success" />
                  <StatChip
                    label="Outstanding A/R"
                    value={formatINRCompact(dashboard.outstandingReceivable)}
                    accent="warning"
                  />
                  <StatChip
                    label="Outstanding A/P"
                    value={formatINRCompact(dashboard.outstandingPayable)}
                    accent="danger"
                  />
                </>
              ) : tab !== 'DASHBOARD' ? (
                <StatChip label="Projects" value={String(projects?.length ?? 0)} />
              ) : undefined
            }
          />
          {tabChips}
          {tab === 'INVOICES' && <DesktopSplitPane mode="invoices" projects={projects ?? []} />}
          {tab === 'BILLS' && <DesktopSplitPane mode="bills" projects={projects ?? []} />}
          {tab === 'DASHBOARD' && <DashboardTab />}
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />
      <MobileScreenHeader title="Accounting" subtitle="Invoices, bills, GST & TDS" />
      {tabChips}
      {tab === 'INVOICES' && <MobileProjectsTab mode="invoices" />}
      {tab === 'BILLS' && <MobileProjectsTab mode="bills" />}
      {tab === 'DASHBOARD' && <DashboardTab />}
      {(tab === 'INVOICES' || tab === 'BILLS') && (
        <FAB
          label={tab === 'INVOICES' ? 'Invoice' : 'Bill'}
          onPress={() =>
            router.push(`/accounting/${tab === 'INVOICES' ? 'create-invoice' : 'create-bill'}`)
          }
        />
      )}
    </SafeAreaView>
  );
}

function DesktopSplitPane({
  mode,
  projects,
}: {
  mode: 'invoices' | 'bills';
  projects: ProjectListItem[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && projects.length > 0) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const selected = projects.find((p) => p.id === selectedId);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects"
        description="Create a project first to manage invoices and bills."
      />
    );
  }

  return (
    <View className="flex-row min-h-[520px] border border-border rounded-2xl overflow-hidden bg-card">
      <View className="w-72 border-r border-border bg-surface shrink-0">
        <Text className="px-4 pt-4 pb-2 text-xs font-semibold text-muted uppercase tracking-wide">
          Projects
        </Text>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {projects.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelectedId(p.id)}
              className={`px-4 py-3 border-b border-border/60 active:opacity-80 ${
                selectedId === p.id ? 'bg-primary/8 border-l-4 border-l-primary' : ''
              }`}
            >
              <Text
                className={`text-sm font-semibold ${selectedId === p.id ? 'text-primary' : 'text-text'}`}
                numberOfLines={1}
              >
                {p.name}
              </Text>
              <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                {p.clientName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View className="flex-1 min-w-0 bg-card">
        {selectedId && selected ? (
          <>
            <View className="px-4 py-3 border-b border-border flex-row items-center justify-between bg-surface">
              <View className="flex-1 min-w-0 mr-4">
                <Text className="text-base font-bold text-text" numberOfLines={1}>
                  {selected.name}
                </Text>
                <Text className="text-sm text-muted">{selected.clientName}</Text>
              </View>
              <Badge
                color={mode === 'invoices' ? 'primary' : 'warning'}
                label={mode === 'invoices' ? 'Invoices' : 'Bills'}
              />
            </View>
            {mode === 'invoices' ? (
              <ProjectInvoicesList projectId={selectedId} embedded />
            ) : (
              <ProjectBillsList projectId={selectedId} embedded />
            )}
          </>
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <EmptyState
              title="Select a project"
              description={`Choose a project from the list to view ${mode}.`}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function MobileProjectsTab({ mode }: { mode: 'invoices' | 'bills' }) {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();

  if (isLoading) {
    return (
      <View className="px-4 pt-2 gap-3">
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className="h-20 rounded-xl" />
        ))}
      </View>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        title="No projects"
        description="Create a project first to manage invoices."
      />
    );
  }

  return (
    <ScrollView
      className="px-4 pt-2"
      contentContainerClassName="gap-3"
      contentContainerStyle={{ paddingBottom: mobileListBottomPadding(true) }}
    >
      <Text className="text-sm font-semibold text-muted mb-1">Select Project</Text>
      {projects.map((p: ProjectListItem) => (
        <Pressable
          key={p.id}
          onPress={() =>
            router.push(
              mode === 'invoices'
                ? `/accounting/project/${p.id}`
                : `/accounting/project/${p.id}?tab=bills`,
            )
          }
        >
          <Card>
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-2">
                <Text className="text-base font-semibold text-text" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-xs text-muted">{p.clientName}</Text>
              </View>
              <Badge
                color={mode === 'invoices' ? 'primary' : 'warning'}
                label={mode === 'invoices' ? 'View Invoices' : 'View Bills'}
              />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function DashboardTab() {
  const { isDesktop, isWideDesktop } = useViewport();
  const { data, isLoading, isFetching, refetch } = useCompanyDashboard();

  if (isLoading) {
    return (
      <View className={`gap-3 ${isDesktop ? '' : 'px-4 pt-2'}`}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className="h-28 rounded-xl" />
        ))}
      </View>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No financial data"
        description="Financial data will appear here once you start invoicing."
      />
    );
  }

  return (
    <ScrollView
      className={isDesktop ? undefined : 'px-4 pt-2'}
      contentContainerClassName="gap-4"
      contentContainerStyle={isDesktop ? undefined : { paddingBottom: mobileListBottomPadding() }}
      scrollEnabled={!isDesktop}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
    >
      <View className={`flex-row flex-wrap gap-3 ${isDesktop ? '' : ''}`}>
        <KpiCard label="Total Invoiced" value={formatINRCompact(data.totalInvoiced)} desktop={isDesktop} />
        <KpiCard label="Collected" value={formatINRCompact(data.totalCollected)} color="success" desktop={isDesktop} />
        <KpiCard
          label="Outstanding A/R"
          value={formatINRCompact(data.outstandingReceivable)}
          color="warning"
          desktop={isDesktop}
        />
        <KpiCard label="Total Billed" value={formatINRCompact(data.totalBilled)} desktop={isDesktop} />
        <KpiCard label="Total Paid" value={formatINRCompact(data.totalPaid)} color="success" desktop={isDesktop} />
        <KpiCard
          label="Outstanding A/P"
          value={formatINRCompact(data.outstandingPayable)}
          color="danger"
          desktop={isDesktop}
        />
      </View>

      <Text className="text-sm font-bold text-text mt-2">Project Summary</Text>
      {data.projectSummaries.length === 0 ? (
        <Text className="text-sm text-muted">No project financials yet.</Text>
      ) : (
        <View className={`gap-3 ${isWideDesktop ? 'flex-row flex-wrap' : isDesktop ? 'flex-row flex-wrap' : ''}`}>
          {data.projectSummaries.map((p: CompanyDashboard['projectSummaries'][number]) => (
            <Card key={p.id} className={isDesktop ? 'flex-1 min-w-[320px]' : undefined}>
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2">
                  <Text className="text-base font-semibold text-text" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Badge
                    color={
                      p.status === 'COMPLETED'
                        ? 'success'
                        : p.status === 'IN_PROGRESS'
                          ? 'warning'
                          : 'neutral'
                    }
                    label={p.status.replace('_', ' ')}
                  />
                </View>
              </View>
              <View className={`${isDesktop ? 'flex-row justify-between gap-4' : 'flex-row justify-between'}`}>
                <Metric label="Budget" value={formatINR(p.budget)} />
                <Metric label="Invoiced" value={formatINR(p.billed)} />
                <Metric label="Collected" value={formatINR(p.collected)} success />
                <Metric
                  label="Variance"
                  value={formatINRCompact(p.variance)}
                  danger={p.variance < 0}
                  success={p.variance >= 0}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  color = 'primary',
  desktop = false,
}: {
  label: string;
  value: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  desktop?: boolean;
}) {
  const colorMap = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <View
      className={`bg-card border border-border rounded-xl p-4 ${
        desktop ? 'flex-1 min-w-[180px]' : 'flex-1 min-w-[45%]'
      }`}
    >
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text className={`text-xl font-bold ${colorMap[color]}`}>{value}</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  success,
  danger,
}: {
  label: string;
  value: string;
  success?: boolean;
  danger?: boolean;
}) {
  return (
    <View>
      <Text className="text-xs text-muted">{label}</Text>
      <Text
        className={`text-sm font-semibold ${
          danger ? 'text-danger' : success ? 'text-success' : 'text-text'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
