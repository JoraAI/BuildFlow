/**
 * Shared invoice & bill list components - mobile cards + desktop table rows.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, EmptyState, LoadingSkeleton, Button, BusyOverlay, useBusy } from '@/components/ui';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';
import { usePermission } from '@/hooks/usePermission';
import {
  useInvoices,
  useBills,
  useApproveBill,
  useRejectBill,
  useSendInvoice,
  type Invoice,
  type Bill,
} from '@/services/accounting.queries';
import { formatINR, formatDate, daysBetween } from '@/utils/format';
import { confirmAsync, alertAsync } from '@/utils/confirm';
import { billDetailHref, invoiceDetailHref, DISMISS } from '@/utils/navigation';

const INVOICE_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'primary',
  PAID: 'success',
  OVERDUE: 'danger',
};

const BILL_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
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
const BILL_FILTERS = ['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const;

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
    <View className={`flex-row gap-2 flex-wrap ${isDesktop ? 'px-4 pt-3 pb-2' : 'px-1 pb-3'}`}>
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
  returnTo,
  buildDetailHref = invoiceDetailHref,
  status: controlledStatus,
  onStatusChange,
  query = '',
  focusId = null,
  stickyFilters = false,
}: {
  projectId: string;
  embedded?: boolean;
  /** Where back should land when opening invoice detail from this list. */
  returnTo?: string;
  /** Override detail URL builder (inventory shell uses /inventory/invoices/:id). */
  buildDetailHref?: (invoiceId: string, returnTo?: string) => string;
  /** Controlled status filter (inventory shell). When set with onStatusChange, skips projectId reset. */
  status?: string;
  onStatusChange?: (next: string) => void;
  /** Free-text search over invoice # / client. */
  query?: string;
  focusId?: string | null;
  /** When true, filter pills are not rendered inside the list (parent owns sticky bar). */
  stickyFilters?: boolean;
}) {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const canSend = usePermission('invoice.create');
  const { busy, run } = useBusy();
  const { data: invoices, isLoading, isFetching, refetch } = useInvoices(projectId);
  const sendInvoice = useSendInvoice();
  const [internalFilter, setInternalFilter] = useState<string>('ALL');
  const controlled = controlledStatus != null && onStatusChange != null;
  const filter = controlled ? controlledStatus : internalFilter;
  const setFilter = controlled ? onStatusChange! : setInternalFilter;

  useEffect(() => {
    if (controlled) return;
    setInternalFilter('ALL');
  }, [projectId, controlled]);

  const detailReturnTo =
    returnTo ?? (embedded ? `/accounting/project/${projectId}?tab=invoices` : DISMISS.accounting);

  const q = query.trim().toLowerCase();
  const filtered = (invoices ?? []).filter((inv: Invoice) => {
    if (filter !== 'ALL' && inv.status !== filter) return false;
    if (!q) return true;
    return [inv.invoiceNumber, inv.clientName, inv.clientPhone]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  if (isLoading) {
    return (
      <View className={`gap-3 ${embedded ? 'p-4' : 'px-4 pt-2'}`}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className={`rounded-xl ${isDesktop ? 'h-12' : 'h-24'}`} />
        ))}
      </View>
    );
  }

  const onSend = async (id: string) => {
    const ok = await confirmAsync(
      'Confirm draft invoice',
      'Mark this draft sales invoice as Sent?',
    );
    if (!ok) return;
    try {
      await run(async () => {
        await sendInvoice.mutateAsync(id);
      });
    } catch (e) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not send');
    }
  };

  const listPadding =
    embedded && !isDesktop
      ? { paddingBottom: mobileListBottomPadding(true) }
      : embedded || isDesktop
        ? undefined
        : { paddingBottom: mobileListBottomPadding(true) };

  return (
    <View className={embedded ? 'flex-1 min-h-0' : undefined}>
      <BusyOverlay visible={busy} title="Updating invoice…" />
    <FlatList
      className={embedded ? 'flex-1 min-h-0' : undefined}
      data={filtered}
      keyExtractor={(item) => item.id}
      scrollEnabled={!embedded ? !isDesktop : true}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName={embedded ? 'pb-4' : isDesktop ? undefined : 'px-4 pt-2'}
      contentContainerStyle={listPadding}
      ItemSeparatorComponent={() =>
        isDesktop ? <View className="h-px bg-border mx-4" /> : <View className="h-4" />
      }
      ListEmptyComponent={
        <View className={embedded || isDesktop ? 'p-8' : undefined}>
          <EmptyState
            title="No invoices"
            description={
              q || filter !== 'ALL'
                ? 'No invoices match the current search or filter.'
                : 'Create a GST-compliant invoice for this project, or issue stock to auto-create a draft.'
            }
          />
        </View>
      }
      ListHeaderComponent={
        <>
          {!stickyFilters ? (
            <FilterPills options={INVOICE_FILTERS} value={filter} onChange={setFilter} />
          ) : null}
          {isDesktop && filtered.length > 0 && (
            <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
              <Text className="flex-[1.2] text-xs font-semibold text-muted uppercase">Invoice #</Text>
              <Text className="flex-[1.4] text-xs font-semibold text-muted uppercase">Client</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase">Status</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase text-right">Total</Text>
              <Text className="flex-1 text-xs font-semibold text-muted uppercase text-right">Due</Text>
              {canSend && <View className="w-28" />}
            </View>
          )}
        </>
      }
      renderItem={({ item }) => (
        <View className={focusId === item.id ? 'border border-primary bg-primary/5 rounded-xl' : undefined}>
          <InvoiceRow
            item={item}
            canSend={canSend}
            onPress={() => router.push(buildDetailHref(item.id, detailReturnTo) as never)}
            onSend={() => onSend(item.id)}
          />
        </View>
      )}
    />
    </View>
  );
}

export function ProjectBillsList({
  projectId,
  embedded = false,
  returnTo,
  buildDetailHref = billDetailHref,
  status: controlledStatus,
  onStatusChange,
  query = '',
  focusId = null,
  stickyFilters = false,
}: {
  projectId: string;
  embedded?: boolean;
  returnTo?: string;
  /** Override detail URL builder (inventory shell uses /inventory/bills/:id). */
  buildDetailHref?: (billId: string, returnTo?: string) => string;
  status?: string;
  onStatusChange?: (next: string) => void;
  query?: string;
  focusId?: string | null;
  stickyFilters?: boolean;
}) {
  const router = useRouter();
  // R10-B2: Replace role check with granular permission.
  const canApprove = usePermission('bill.approve');
  const { isDesktop } = useViewport();
  const { busy, run } = useBusy();
  const { data: bills, isLoading, isFetching, refetch } = useBills(projectId);
  const approve = useApproveBill();
  const reject = useRejectBill();
  const [internalFilter, setInternalFilter] = useState<string>('ALL');
  const controlled = controlledStatus != null && onStatusChange != null;
  const filter = controlled ? controlledStatus : internalFilter;
  const setFilter = controlled ? onStatusChange! : setInternalFilter;

  useEffect(() => {
    if (controlled) return;
    setInternalFilter('ALL');
  }, [projectId, controlled]);

  const detailReturnTo =
    returnTo ?? (embedded ? `/accounting/project/${projectId}?tab=bills` : DISMISS.accounting);

  const q = query.trim().toLowerCase();
  const filtered = (bills ?? []).filter((b: Bill) => {
    if (filter !== 'ALL' && b.status !== filter) return false;
    if (!q) return true;
    return [b.billNumber, b.vendorName, b.category]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  if (isLoading) {
    return (
      <View className={`gap-3 ${embedded ? 'p-4' : 'px-4 pt-2'}`}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} className={`rounded-xl ${isDesktop ? 'h-12' : 'h-24'}`} />
        ))}
      </View>
    );
  }

  const onApprove = async (id: string, status: string) => {
    const ok = await confirmAsync(
      status === 'DRAFT' ? 'Confirm draft bill' : 'Approve Bill',
      status === 'DRAFT'
        ? 'Confirm this auto-created draft and mark it approved?'
        : 'Mark this bill as approved?',
    );
    if (!ok) return;
    try {
      await run(async () => {
        await approve.mutateAsync(id);
      });
    } catch (e) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not approve');
    }
  };

  const onReject = async (id: string) => {
    const ok = await confirmAsync('Reject Bill', 'Reject this bill?');
    if (!ok) return;
    try {
      await run(async () => {
        await reject.mutateAsync(id);
      });
    } catch (e) {
      await alertAsync('Error', e instanceof Error ? e.message : 'Could not reject');
    }
  };

  const listPadding =
    embedded && !isDesktop
      ? { paddingBottom: mobileListBottomPadding(true) }
      : embedded || isDesktop
        ? undefined
        : { paddingBottom: mobileListBottomPadding(true) };

  return (
    <View className={embedded ? 'flex-1 min-h-0' : undefined}>
      <BusyOverlay visible={busy} title="Updating bill…" />
    <FlatList
      className={embedded ? 'flex-1 min-h-0' : undefined}
      data={filtered}
      keyExtractor={(item) => item.id}
      scrollEnabled={!embedded ? !isDesktop : true}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      contentContainerClassName={embedded ? 'pb-4' : isDesktop ? undefined : 'px-4 pt-2'}
      contentContainerStyle={listPadding}
      ItemSeparatorComponent={() =>
        isDesktop ? <View className="h-px bg-border mx-4" /> : <View className="h-4" />
      }
      ListEmptyComponent={
        <View className={embedded || isDesktop ? 'p-8' : undefined}>
          <EmptyState
            title="No bills"
            description={
              q || filter !== 'ALL'
                ? 'No bills match the current search or filter.'
                : 'Add a vendor bill to track project costs.'
            }
          />
        </View>
      }
      ListHeaderComponent={
        <>
          {!stickyFilters ? (
            <FilterPills options={BILL_FILTERS} value={filter} onChange={setFilter} />
          ) : null}
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
        <View className={focusId === item.id ? 'border border-primary bg-primary/5 rounded-xl' : undefined}>
          <BillRow
            item={item}
            canApprove={canApprove}
            onPress={() => router.push(buildDetailHref(item.id, detailReturnTo) as never)}
            onApprove={() => onApprove(item.id, item.status)}
            onReject={() => onReject(item.id)}
          />
        </View>
      )}
    />
    </View>
  );
}

function InvoiceRow({
  item,
  onPress,
  canSend,
  onSend,
}: {
  item: Invoice;
  onPress: () => void;
  canSend?: boolean;
  onSend?: () => void;
}) {
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
        {canSend && item.status === 'DRAFT' ? (
          <View className="w-28 items-end">
            <Button label="Confirm" size="sm" variant="primary" onPress={onSend} />
          </View>
        ) : canSend ? (
          <View className="w-28" />
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Card
        className={
          item.status === 'OVERDUE'
            ? 'border-danger'
            : item.status === 'DRAFT'
              ? 'border-warning'
              : ''
        }
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-mono font-semibold text-text">{item.invoiceNumber}</Text>
            <Text className="text-xs text-muted">{item.clientName}</Text>
            {(item.clientPhone || item.clientAddress) ? (
              <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>
                {[item.clientPhone, item.clientAddress].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Badge color={INVOICE_STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        <View className="pt-2 mt-1 border-t border-border/60">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs text-muted">Total</Text>
            <Text className="text-sm font-bold text-text">{formatINR(item.total)}</Text>
          </View>
          {item.paidAmount > 0 && (
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-muted">Paid</Text>
              <Text className="text-xs font-semibold text-success">{formatINR(item.paidAmount)}</Text>
            </View>
          )}
          {item.total - item.paidAmount > 0.01 && (
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-muted">Balance</Text>
              <Text className="text-xs font-semibold text-primary">
                {formatINR(item.total - item.paidAmount)}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs text-muted">Due {formatDate(item.dueDate)}</Text>
          {overdueDays > 0 && (
            <Text className="text-xs text-danger font-semibold">{overdueDays}d overdue</Text>
          )}
        </View>
        {canSend && item.status === 'DRAFT' && onSend ? (
          <View className="mt-3">
            <Button label="Confirm (Send)" variant="primary" size="sm" onPress={onSend} fullWidth />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function BillRow({
  item,
  canApprove,
  onPress,
  onApprove,
  onReject,
}: {
  item: Bill;
  canApprove: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { isDesktop } = useViewport();

  if (isDesktop) {
    return (
      <Pressable onPress={onPress} className="flex-row items-center px-4 py-3 bg-card border-b border-border/50">
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
        <View className="flex-1 items-end">
          <Text className="text-sm font-semibold text-text">{formatINR(item.total)}</Text>
          {item.paidAmount > 0 && (
            <Text className="text-xs text-success">Paid {formatINR(item.paidAmount)}</Text>
          )}
        </View>
        {canApprove && (item.status === 'PENDING' || item.status === 'DRAFT') ? (
          <View className="w-36 flex-row gap-1 justify-end">
            <Button
              label={item.status === 'DRAFT' ? 'Confirm' : 'Approve'}
              variant="primary"
              size="sm"
              onPress={onApprove}
            />
            <Button label="Reject" variant="danger" size="sm" onPress={onReject} />
          </View>
        ) : (
          <View className="w-36" />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Card className={item.status === 'PENDING' || item.status === 'DRAFT' ? 'border-warning' : ''}>
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
        <View className="pt-2 mt-1 border-t border-border/60">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs text-muted">Net payable</Text>
            <Text className="text-sm font-bold text-text">{formatINR(item.total)}</Text>
          </View>
          {item.paidAmount > 0 && (
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-muted">Paid</Text>
              <Text className="text-xs font-semibold text-success">{formatINR(item.paidAmount)}</Text>
            </View>
          )}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-muted">Bill date</Text>
            <Text className="text-xs text-muted">{formatDate(item.billDate)}</Text>
          </View>
        </View>
        {canApprove && (item.status === 'PENDING' || item.status === 'DRAFT') && (
          <View className="flex-row gap-2 mt-3">
            <View className="flex-1">
              <Button
                label={item.status === 'DRAFT' ? 'Confirm' : 'Approve'}
                variant="primary"
                size="sm"
                onPress={onApprove}
              />
            </View>
            <View className="flex-1">
              <Button label="Reject" variant="danger" size="sm" onPress={onReject} />
            </View>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
