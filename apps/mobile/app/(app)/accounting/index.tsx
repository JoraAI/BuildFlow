/**
 * BuildFlow - Accounting Hub (Invoices | Bills | Dashboard)
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
import { AccountingExplainer } from '@/components/accounting/AccountingExplainer';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
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
  const [mobileProjectId, setMobileProjectId] = useState<string | null>(null);
  const { data: projects } = useProjects();
  const { data: dashboard } = useCompanyDashboard();

  useEffect(() => {
    if (!mobileProjectId && projects && projects.length > 0) {
      setMobileProjectId(projects[0].id);
    }
  }, [projects, mobileProjectId]);

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
        <ScreenContainer scrollable constrained>
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
          {(tab === 'INVOICES' || tab === 'BILLS') && <AccountingExplainer />}
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
      {(tab === 'INVOICES' || tab === 'BILLS') && (
        <View className="px-4 pt-2">
          <AccountingExplainer />
        </View>
      )}
      {tab === 'INVOICES' && (
        <MobileAccountingPane
          mode="invoices"
          selectedId={mobileProjectId}
          onSelectProject={setMobileProjectId}
        />
      )}
      {tab === 'BILLS' && (
        <MobileAccountingPane
          mode="bills"
          selectedId={mobileProjectId}
          onSelectProject={setMobileProjectId}
        />
      )}
      {tab === 'DASHBOARD' && <DashboardTab />}
      {(tab === 'INVOICES' || tab === 'BILLS') && (
        <FAB
          label={tab === 'INVOICES' ? 'Invoice' : 'Bill'}
          onPress={() => {
            const base =
              tab === 'INVOICES' ? '/accounting/create-invoice' : '/accounting/create-bill';
            router.push(mobileProjectId ? `${base}?projectId=${mobileProjectId}` : base);
          }}
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
              <ProjectInvoicesList key={selectedId} projectId={selectedId} embedded />
            ) : (
              <ProjectBillsList key={selectedId} projectId={selectedId} embedded />
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

function MobileAccountingPane({
  mode,
  selectedId,
  onSelectProject,
}: {
  mode: 'invoices' | 'bills';
  selectedId: string | null;
  onSelectProject: (id: string) => void;
}) {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();

  useEffect(() => {
    if (selectedId && projects && !projects.some((p: ProjectListItem) => p.id === selectedId)) {
      onSelectProject(projects[0]?.id ?? '');
    }
  }, [projects, selectedId, onSelectProject]);

  const selected = projects?.find((p: ProjectListItem) => p.id === selectedId);

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
        description="Create a project first to manage invoices and bills."
      />
    );
  }

  const createPath = selectedId
    ? `/accounting/${mode === 'invoices' ? 'create-invoice' : 'create-bill'}?projectId=${selectedId}`
    : `/accounting/${mode === 'invoices' ? 'create-invoice' : 'create-bill'}`;

  return (
    <View className="flex-1">
      <View className="px-4 pt-2 pb-1">
        <Text className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Project
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-grow-0">
          <View className="flex-row gap-2 pb-1">
            {projects.map((p: ProjectListItem) => (
              <Pressable
                key={p.id}
                onPress={() => onSelectProject(p.id)}
                className={`px-3 py-2 rounded-xl border max-w-[220px] ${
                  selectedId === p.id ? 'bg-primary/10 border-primary' : 'bg-card border-border'
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
          </View>
        </ScrollView>
      </View>

      {selectedId && selected ? (
        <View className="flex-1 px-4">
          <View className="flex-row items-center justify-between py-2 mb-1">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-text" numberOfLines={1}>
                {selected.name}
              </Text>
              <Text className="text-xs text-muted">{selected.clientName}</Text>
            </View>
            <Pressable
              onPress={() => router.push(createPath as never)}
              className="px-3 py-1.5 rounded-lg bg-primary/10 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-primary">
                {mode === 'invoices' ? '+ Invoice' : '+ Bill'}
              </Text>
            </Pressable>
          </View>
          {mode === 'invoices' ? (
            <ProjectInvoicesList key={selectedId} projectId={selectedId} embedded />
          ) : (
            <ProjectBillsList key={selectedId} projectId={selectedId} embedded />
          )}
        </View>
      ) : (
        <EmptyState
          title="Select a project"
          description={`Choose a project above to view ${mode}.`}
        />
      )}
    </View>
  );
}

function DashboardTab() {
  const { isDesktop } = useViewport();
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
      <ResponsiveGrid gap={12} columns={isDesktop ? undefined : 2}>
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
      </ResponsiveGrid>

      <Text className="text-sm font-bold text-text mt-2">Project Summary</Text>
      {data.projectSummaries.length === 0 ? (
        <Text className="text-sm text-muted">No project financials yet.</Text>
      ) : (
        <ResponsiveGrid gap={12}>
          {data.projectSummaries.map((p: CompanyDashboard['projectSummaries'][number]) => (
            <Card key={p.id} className="h-full">
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
        </ResponsiveGrid>
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
    <View className="bg-card border border-border rounded-xl p-4 h-full">
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
