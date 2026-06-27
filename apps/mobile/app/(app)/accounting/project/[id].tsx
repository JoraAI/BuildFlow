/**
 * BuildFlow — Project Accounting (Invoices + Bills for one project)
 * Route: /accounting/project/[id]?tab=invoices|bills
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Badge, FAB, EmptyState, LoadingSkeleton, Button } from '@/components/ui';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useAuthStore } from '@/stores/auth.store';
import {
  useInvoices,
  useBills,
  useApproveBill,
  useRejectBill,
  type Invoice,
  type Bill,
} from '@/services/accounting.queries';
import { formatINR, formatINRCompact, formatDate, daysBetween } from '@/utils/format';

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

const BILL_CATEGORY_COLOR: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  MATERIAL: 'primary',
  LABOUR: 'success',
  EQUIPMENT: 'warning',
  SUBCONTRACTOR: 'danger',
  OTHER: 'neutral',
};

export default function ProjectAccountingScreen() {
  const { id: projectId, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<'invoices' | 'bills'>(
    initialTab === 'bills' ? 'bills' : 'invoices',
  );
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <OfflineBanner />

      <View className="flex-row px-4 pt-4 pb-2 gap-2">
        <Pressable onPress={() => router.back()} className="mr-2">
          <Text className="text-primary text-base font-medium">‹ Back</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 pb-2 gap-2">
        <Pressable
          onPress={() => setTab('invoices')}
          className={`px-4 py-2 rounded-full border ${tab === 'invoices' ? 'bg-primary border-primary' : 'bg-card border-border'}`}
        >
          <Text className={`text-xs font-semibold ${tab === 'invoices' ? 'text-white' : 'text-muted'}`}>
            Invoices
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('bills')}
          className={`px-4 py-2 rounded-full border ${tab === 'bills' ? 'bg-primary border-primary' : 'bg-card border-border'}`}
        >
          <Text className={`text-xs font-semibold ${tab === 'bills' ? 'text-white' : 'text-muted'}`}>
            Bills
          </Text>
        </Pressable>
      </View>

      {tab === 'invoices' && <InvoicesList projectId={projectId} />}
      {tab === 'bills' && <BillsList projectId={projectId} />}

      <FAB
        label={tab === 'invoices' ? 'Invoice' : 'Bill'}
        onPress={() =>
          router.push(
            `/accounting/${tab === 'invoices' ? 'create-invoice' : 'create-bill'}?projectId=${projectId}`,
          )
        }
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Invoices List
// ---------------------------------------------------------------------------
function InvoicesList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data: invoices, isLoading, isFetching, refetch } = useInvoices(projectId);
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = (invoices ?? []).filter(
    (inv: Invoice) => filter === 'ALL' || inv.status === filter,
  );

  if (isLoading) {
    return (
      <View className="px-4 pt-2 gap-3">
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className="h-24 rounded-xl" />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName="px-4 pb-24 pt-2"
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListEmptyComponent={
        <EmptyState
          title="No invoices"
          description="Create a GST-compliant invoice for this project."
        />
      }
      ListHeaderComponent={
        <View className="flex-row gap-2 pb-3">
          {['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            >
              <Text className={`text-xs font-medium ${filter === f ? 'text-white' : 'text-muted'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      }
      renderItem={({ item }) => <InvoiceRow item={item} onPress={() => router.push(`/accounting/invoice/${item.id}`)} />}
    />
  );
}

function InvoiceRow({ item, onPress }: { item: Invoice; onPress: () => void }) {
  const overdueDays =
    item.status === 'OVERDUE' || (item.status === 'SENT' && new Date(item.dueDate) < new Date())
      ? Math.abs(daysBetween(new Date(), item.dueDate))
      : 0;

  return (
    <Pressable onPress={onPress}>
      <Card className={item.status === 'OVERDUE' ? 'border-danger' : ''}>
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-mono font-semibold text-text">{item.invoiceNumber}</Text>
            <Text className="text-xs text-muted">{item.clientName}</Text>
          </View>
          <Badge color={INVOICE_STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-xs text-muted">Total</Text>
            <Text className="text-base font-bold text-text">{formatINR(item.total)}</Text>
          </View>
          {item.paidAmount > 0 && (
            <View className="items-end">
              <Text className="text-xs text-muted">Paid</Text>
              <Text className="text-sm font-semibold text-success">{formatINR(item.paidAmount)}</Text>
            </View>
          )}
          {overdueDays > 0 && (
            <View className="items-end">
              <Text className="text-xs text-danger font-semibold">{overdueDays}d overdue</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-muted mt-2">Due {formatDate(item.dueDate)}</Text>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Bills List
// ---------------------------------------------------------------------------
function BillsList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';
  const { data: bills, isLoading, isFetching, refetch } = useBills(projectId);
  const approve = useApproveBill();
  const reject = useRejectBill();
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = (bills ?? []).filter((b: Bill) => filter === 'ALL' || b.status === filter);

  if (isLoading) {
    return (
      <View className="px-4 pt-2 gap-3">
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className="h-24 rounded-xl" />
        ))}
      </View>
    );
  }

  const onApprove = (id: string) => {
    Alert.alert('Approve Bill', 'Mark this bill as approved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: () => approve.mutate(id),
      },
    ]);
  };

  const onReject = (id: string) => {
    Alert.alert('Reject Bill', 'Reject this bill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => reject.mutate(id),
      },
    ]);
  };

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName="px-4 pb-24 pt-2"
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListEmptyComponent={
        <EmptyState title="No bills" description="Add a vendor bill to track project costs." />
      }
      ListHeaderComponent={
        <View className="flex-row gap-2 pb-3">
          {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            >
              <Text className={`text-xs font-medium ${filter === f ? 'text-white' : 'text-muted'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      }
      renderItem={({ item }) => (
        <BillRow
          item={item}
          canApprove={canApprove}
          onApprove={() => onApprove(item.id)}
          onReject={() => onReject(item.id)}
        />
      )}
    />
  );
}

function BillRow({
  item,
  canApprove,
  onApprove,
  onReject,
}: {
  item: Bill;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card className={item.status === 'PENDING' ? 'border-warning' : ''}>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-sm font-mono font-semibold text-text">{item.billNumber}</Text>
          <Text className="text-xs text-muted">{item.vendorName}</Text>
        </View>
        <View className="flex-row gap-1">
          <Badge color={BILL_CATEGORY_COLOR[item.category] ?? 'neutral'} label={item.category} />
          <Badge color={BILL_STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
      </View>
      <View className="flex-row justify-between items-end mb-2">
        <View>
          <Text className="text-xs text-muted">Total</Text>
          <Text className="text-base font-bold text-text">{formatINR(item.total)}</Text>
        </View>
        <Text className="text-xs text-muted">{formatDate(item.billDate)}</Text>
      </View>
      {canApprove && item.status === 'PENDING' && (
        <View className="flex-row gap-2 mt-1">
          <View className="flex-1">
            <Button label="Approve" variant="primary" size="sm" onPress={onApprove} />
          </View>
          <View className="flex-1">
            <Button label="Reject" variant="danger" size="sm" onPress={onReject} />
          </View>
        </View>
      )}
    </Card>
  );
}