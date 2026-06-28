/**
 * Shared invoice & bill list components — mobile cards + desktop table rows.
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
import { useRouter } from 'expo-router';
import { Card, Badge, EmptyState, LoadingSkeleton, Button } from '@/components/ui';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import {
  useInvoices,
  useBills,
  useApproveBill,
  useRejectBill,
  type Invoice,
  type Bill,
} from '@/services/accounting.queries';
import { formatINR, formatDate, daysBetween } from '@/utils/format';

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

const INVOICE_FILTERS = ['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const;
const BILL_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const;

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { isDesktop } = useViewport();
  return (
    <View className={`flex-row gap-2 flex-wrap ${isDesktop ? 'px-4 pt-3 pb-2' : 'pb-3'}`}>
      {options.map((f) => (
        <Pressable
          key={f}
          onPress={() => onChange(f)}
          className={`px-3 py-1.5 rounded-lg border ${value === f ? 'bg-primary border-primary' : 'bg-card border-border'}`}
        >
          <Text className={`text-xs font-medium ${value === f ? 'text-white' : 'text-muted'}`}>
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProjectInvoicesList({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { data: invoices, isLoading, isFetching, refetch } = useInvoices(projectId);
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = (invoices ?? []).filter(
    (inv: Invoice) => filter === 'ALL' || inv.status === filter,
  );

  if (isLoading) {
    return (
      <View className={`gap-3 ${embedded ? 'p-4' : 'px-4 pt-2'}`}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className={`rounded-xl ${isDesktop ? 'h-12' : 'h-24'}`} />
        ))}
      </View>
    );
  }

  const listPadding = embedded || isDesktop ? undefined : { paddingBottom: mobileListBottomPadding(true) };

  return (
    <FlatList
      className={embedded ? 'flex-1' : undefined}
      data={filtered}
      keyExtractor={(item) => item.id}
      scrollEnabled={!embedded ? !isDesktop : true}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName={embedded ? 'pb-4' : isDesktop ? undefined : 'px-4 pt-2'}
      contentContainerStyle={listPadding}
      ItemSeparatorComponent={() =>
        isDesktop ? <View className="h-px bg-border mx-4" /> : <View className="h-3" />
      }
      ListEmptyComponent={
        <View className={embedded || isDesktop ? 'p-8' : undefined}>
          <EmptyState
            title="No invoices"
            description="Create a GST-compliant invoice for this project."
          />
        </View>
      }
      ListHeaderComponent={
        <>
          <FilterPills options={INVOICE_FILTERS} value={filter} onChange={setFilter} />
          {isDesktop && filtered.length > 0 && (
            <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
              <Text className="flex-[1.2] text-xs font-semibold text-muted uppercase">Invoice #</Text>
              <Text className="flex-[1.4] text-xs font-semibold text-muted uppercase">Client</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase">Status</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase text-right">Total</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase text-right">Due</Text>
            </View>
          )}
        </>
      }
      renderItem={({ item }) => (
        <InvoiceRow
          item={item}
          onPress={() => router.push(`/accounting/invoice/${item.id}`)}
        />
      )}
    />
  );
}

export function ProjectBillsList({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'OWNER' || user?.role === 'PM';
  const { isDesktop } = useViewport();
  const { data: bills, isLoading, isFetching, refetch } = useBills(projectId);
  const approve = useApproveBill();
  const reject = useRejectBill();
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = (bills ?? []).filter((b: Bill) => filter === 'ALL' || b.status === filter);

  if (isLoading) {
    return (
      <View className={`gap-3 ${embedded ? 'p-4' : 'px-4 pt-2'}`}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className={`rounded-xl ${isDesktop ? 'h-12' : 'h-24'}`} />
        ))}
      </View>
    );
  }

  const onApprove = (id: string) => {
    Alert.alert('Approve Bill', 'Mark this bill as approved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approve.mutate(id) },
    ]);
  };

  const onReject = (id: string) => {
    Alert.alert('Reject Bill', 'Reject this bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => reject.mutate(id) },
    ]);
  };

  const listPadding = embedded || isDesktop ? undefined : { paddingBottom: mobileListBottomPadding(true) };

  return (
    <FlatList
      className={embedded ? 'flex-1' : undefined}
      data={filtered}
      keyExtractor={(item) => item.id}
      scrollEnabled={!embedded ? !isDesktop : true}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName={embedded ? 'pb-4' : isDesktop ? undefined : 'px-4 pt-2'}
      contentContainerStyle={listPadding}
      ItemSeparatorComponent={() =>
        isDesktop ? <View className="h-px bg-border mx-4" /> : <View className="h-3" />
      }
      ListEmptyComponent={
        <View className={embedded || isDesktop ? 'p-8' : undefined}>
          <EmptyState title="No bills" description="Add a vendor bill to track project costs." />
        </View>
      }
      ListHeaderComponent={
        <>
          <FilterPills options={BILL_FILTERS} value={filter} onChange={setFilter} />
          {isDesktop && filtered.length > 0 && (
            <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
              <Text className="flex-[1.2] text-xs font-semibold text-muted uppercase">Bill #</Text>
              <Text className="flex-[1.4] text-xs font-semibold text-muted uppercase">Vendor</Text>
              <Text className="flex-[0.8] text-xs font-semibold text-muted uppercase">Category</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase">Status</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase text-right">Total</Text>
              {canApprove && <View className="w-36" />}
            </View>
          )}
        </>
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

function InvoiceRow({ item, onPress }: { item: Invoice; onPress: () => void }) {
  const { isDesktop } = useViewport();
  const overdueDays =
    item.status === 'OVERDUE' || (item.status === 'SENT' && new Date(item.dueDate) < new Date())
      ? Math.abs(daysBetween(new Date(), item.dueDate))
      : 0;

  if (isDesktop) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 bg-card active:bg-surface"
      >
        <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.invoiceNumber}</Text>
        <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>
          {item.clientName}
        </Text>
        <View className="flex-1">
          <Badge color={INVOICE_STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        <Text className="flex-1 text-sm font-semibold text-text text-right">{formatINR(item.total)}</Text>
        <View className="flex-1 items-end">
          <Text className="text-xs text-muted">{formatDate(item.dueDate)}</Text>
          {overdueDays > 0 && (
            <Text className="text-xs text-danger font-semibold">{overdueDays}d overdue</Text>
          )}
        </View>
      </Pressable>
    );
  }

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
  const { isDesktop } = useViewport();

  if (isDesktop) {
    return (
      <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/50">
        <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.billNumber}</Text>
        <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>
          {item.vendorName}
        </Text>
        <View className="flex-[0.8]">
          <Badge color={BILL_CATEGORY_COLOR[item.category] ?? 'neutral'} label={item.category} />
        </View>
        <View className="flex-1">
          <Badge color={BILL_STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        <Text className="flex-1 text-sm font-semibold text-text text-right">{formatINR(item.total)}</Text>
        {canApprove && item.status === 'PENDING' ? (
          <View className="w-36 flex-row gap-1 justify-end">
            <Button label="Approve" variant="primary" size="sm" onPress={onApprove} />
            <Button label="Reject" variant="danger" size="sm" onPress={onReject} />
          </View>
        ) : (
          <View className="w-36" />
        )}
      </View>
    );
  }

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
