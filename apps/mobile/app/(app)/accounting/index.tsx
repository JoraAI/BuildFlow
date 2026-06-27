/**
 * BuildFlow — Accounting Hub (Invoices | Bills | Dashboard)
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  RefreshControl,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Badge, FAB, EmptyState, LoadingSkeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyDashboard, type CompanyDashboard } from '@/services/accounting.queries';
import { useProjects, type ProjectListItem } from '@/services/project.queries';
import { formatINR, formatINRCompact } from '@/utils/format';

type Tab = 'INVOICES' | 'BILLS' | 'DASHBOARD';

const INVOICE_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'primary',
  PAID: 'success',
  OVERDUE: 'danger',
};

const BILL_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  PAID: 'neutral',
  REJECTED: 'danger',
};

export default function AccountingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState<Tab>('INVOICES');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />

      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text">Accounting</Text>
        <Text className="text-sm text-muted">Invoices, bills, GST & TDS</Text>
      </View>

      {/* Segmented control */}
      <View className="flex-row px-4 pb-2 gap-2">
        {([
          { label: 'Invoices', value: 'INVOICES' as Tab },
          { label: 'Bills', value: 'BILLS' as Tab },
          ...(isOwner ? [{ label: 'Dashboard', value: 'DASHBOARD' as Tab }] : []),
        ]).map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setTab(t.value)}
            className={`px-4 py-2 rounded-full border ${
              tab === t.value ? 'bg-primary border-primary' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-xs font-semibold ${tab === t.value ? 'text-white' : 'text-muted'}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'INVOICES' && <InvoicesTab />}
      {tab === 'BILLS' && <BillsTab />}
      {tab === 'DASHBOARD' && <DashboardTab />}

      {(tab === 'INVOICES' || tab === 'BILLS') && (
        <FAB
          label={tab === 'INVOICES' ? 'Invoice' : 'Bill'}
          onPress={() => router.push(`/accounting/${tab === 'INVOICES' ? 'create-invoice' : 'create-bill'}`)}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Invoices Tab — aggregates across all projects
// ---------------------------------------------------------------------------
function InvoicesTab() {
  const router = useRouter();
  const { data: projects, isLoading: loadingProjects } = useProjects();

  if (loadingProjects) {
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

  // Show a picker to choose a project, then that project's invoices.
  return (
    <ScrollView className="px-4 pt-2" contentContainerClassName="pb-24 gap-3">
      <Text className="text-sm font-semibold text-muted mb-1">Select Project</Text>
      {(projects ?? []).map((p: ProjectListItem) => {
        return (
          <Pressable key={p.id} onPress={() => router.push(`/accounting/project/${p.id}`)}>
            <Card>
              <View className="flex-row justify-between items-center">
                <View className="flex-1 mr-2">
                  <Text className="text-base font-semibold text-text" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text className="text-xs text-muted">{p.clientName}</Text>
                </View>
                <Badge color="primary" label="View Invoices" />
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Bills Tab — same project-picker pattern
// ---------------------------------------------------------------------------
function BillsTab() {
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
        description="Create a project first to manage bills."
      />
    );
  }

  return (
    <ScrollView className="px-4 pt-2" contentContainerClassName="pb-24 gap-3">
      <Text className="text-sm font-semibold text-muted mb-1">Select Project</Text>
      {projects.map((p: ProjectListItem) => (
        <Pressable key={p.id} onPress={() => router.push(`/accounting/project/${p.id}?tab=bills`)}>
          <Card>
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-2">
                <Text className="text-base font-semibold text-text" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-xs text-muted">{p.clientName}</Text>
              </View>
              <Badge color="warning" label="View Bills" />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab (OWNER) — company-wide financial overview
// ---------------------------------------------------------------------------
function DashboardTab() {
  const { data, isLoading, isFetching, refetch } = useCompanyDashboard();

  if (isLoading) {
    return (
      <View className="px-4 pt-2 gap-3">
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
      className="px-4 pt-2"
      contentContainerClassName="pb-24 gap-4"
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
    >
      {/* KPI grid */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Total Invoiced" value={formatINRCompact(data.totalInvoiced)} />
        <KpiCard label="Collected" value={formatINRCompact(data.totalCollected)} color="success" />
        <KpiCard label="Outstanding A/R" value={formatINRCompact(data.outstandingReceivable)} color="warning" />
        <KpiCard label="Total Billed" value={formatINRCompact(data.totalBilled)} />
        <KpiCard label="Total Paid" value={formatINRCompact(data.totalPaid)} color="success" />
        <KpiCard label="Outstanding A/P" value={formatINRCompact(data.outstandingPayable)} color="danger" />
      </View>

      {/* Per-project breakdown */}
      <Text className="text-sm font-bold text-text mt-2">Project Summary</Text>
      {data.projectSummaries.length === 0 ? (
        <Text className="text-sm text-muted">No project financials yet.</Text>
      ) : (
        data.projectSummaries.map((p: CompanyDashboard['projectSummaries'][number]) => (
          <Card key={p.id}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-base font-semibold text-text" numberOfLines={1}>
                  {p.name}
                </Text>
                <Badge
                  color={p.status === 'COMPLETED' ? 'success' : p.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}
                  label={p.status.replace('_', ' ')}
                />
              </View>
            </View>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-xs text-muted">Budget</Text>
                <Text className="text-sm font-semibold text-text">{formatINR(p.budget)}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Invoiced</Text>
                <Text className="text-sm font-semibold text-text">{formatINR(p.billed)}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Collected</Text>
                <Text className="text-sm font-semibold text-success">{formatINR(p.collected)}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Variance</Text>
                <Text className={`text-sm font-semibold ${p.variance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatINRCompact(p.variance)}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  color = 'primary',
}: {
  label: string;
  value: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <View className="bg-card border border-border rounded-xl p-3 flex-1 min-w-[45%]">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text className={`text-lg font-bold ${colorMap[color]}`}>{value}</Text>
    </View>
  );
}