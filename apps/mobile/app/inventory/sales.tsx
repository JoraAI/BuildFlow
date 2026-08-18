import React, { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, toast, BusyOverlay, useBusy } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import {
  useSalesOrders, useCreateSalesOrder, useSalesOrderAction, useInvoiceFromSalesOrder,
  useDeliveryChallans, useCreateDeliveryChallan, useChallanTransition,
  useSalesReturns, useCreateSalesReturn,
  usePurchaseReturns, useCreatePurchaseReturn,
  useCreditNotes, useDebitNotes, useIssueCreditNote, useIssueDebitNote,
  type SalesOrder, type DeliveryChallan, type SalesReturn, type PurchaseReturn, type CreditNote, type DebitNote,
} from '@/services/sales.queries';
import {
  NewSalesOrderModal, NewChallanModal, SalesReturnModal, PurchaseReturnModal, DispatchChallanSheet, NewQuoteModal,
} from '@/components/inventory/TransactionModals';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
import {
  useQuotes, useCreateQuote, useQuoteAction, useQuoteToSalesOrder, type Quote,
} from '@/services/inventory-gtm.queries';
import { downloadReportPdf } from '@/services/report-download';

type Tab = 'orders' | 'quotes' | 'deliveries' | 'returns' | 'notes';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  CONFIRMED: 'warning',
  DELIVERED: 'success',
  INVOICED: 'success',
  CANCELLED: 'danger',
  DISPATCHED: 'warning',
  ISSUED: 'success',
  VOID: 'danger',
};

export default function InventorySalesScreen() {
  const { translate } = useInventoryLanguage();
  const router = useRouter();
  const { busy, run } = useBusy();
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet get
  // multi-line TABLES (InvoiceBillLists pattern); phones keep the card list.
  const { isTablet, isDesktop } = useViewport();
  const tableMode = isTablet || isDesktop;
  const projectId = useAuthStore((s) => s.user?.defaultProjectId ?? '');
  const [tab, setTab] = useState<Tab>('orders');
  const [soOpen, setSoOpen] = useState(false);
  const [challanOpen, setChallanOpen] = useState(false);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.2): quotes sub-tab.
  const [quoteOpen, setQuoteOpen] = useState(false);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): dispatch with a warehouse picker.
  const [dispatchChallan, setDispatchChallan] = useState<DeliveryChallan | null>(null);
  const [salesReturnOpen, setSalesReturnOpen] = useState(false);
  const [purchaseReturnOpen, setPurchaseReturnOpen] = useState(false);

  const orders = useSalesOrders();
  const quotes = useQuotes();
  const challans = useDeliveryChallans();
  const salesReturns = useSalesReturns();
  const purchaseReturns = usePurchaseReturns();
  const creditNotes = useCreditNotes();
  const debitNotes = useDebitNotes();
  const issueCreditNote = useIssueCreditNote();
  const issueDebitNote = useIssueDebitNote();

  const createSO = useCreateSalesOrder();
  const createQuote = useCreateQuote();
  const quoteAction = useQuoteAction();
  const quoteToSO = useQuoteToSalesOrder();
  const soAction = useSalesOrderAction();
  const invoiceFromSO = useInvoiceFromSalesOrder();
  const createChallan = useCreateDeliveryChallan();
  const challanTransition = useChallanTransition();
  const createSalesReturn = useCreateSalesReturn();
  const createPurchaseReturn = useCreatePurchaseReturn();

  const headerAction = () => {
    if (tab === 'orders') setSoOpen(true);
    else if (tab === 'quotes') setQuoteOpen(true);
    else if (tab === 'deliveries') setChallanOpen(true);
  };
  const headerLabel = tab === 'orders' ? 'New order' : tab === 'quotes' ? 'New quote' : tab === 'deliveries' ? 'New challan' : undefined;

  const renderOrder = ({ item }: { item: SalesOrder }) => {
    const delivered = item.deliveryChallans.some((d) => d.status === 'DISPATCHED' || d.status === 'DELIVERED');
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet row.
    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <Text className="flex-[1.1] text-sm font-mono font-semibold text-text">{item.soNumber}</Text>
          <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>{item.customerName}</Text>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-text text-right">₹{Number(item.total).toFixed(2)}</Text>
          <View className="flex-[2] flex-row flex-wrap justify-end gap-1">
            {item.status === 'DRAFT' ? (
              <Button label="Confirm" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                await soAction.mutateAsync({ id: item.id, action: 'confirm' });
                toast.success('Order confirmed');
              })} />
            ) : null}
            {item.status === 'CONFIRMED' ? (
              <Button label="Challan" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                await createChallan.mutateAsync({ salesOrderId: item.id });
                toast.success('Challan created - dispatch to move stock');
              })} />
            ) : null}
            {(item.status === 'CONFIRMED' || item.status === 'DELIVERED') && delivered ? (
              <Button label="Invoice" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
                const r = await invoiceFromSO.mutateAsync({ id: item.id });
                toast.success(`Invoice ${r.invoiceNumber} created`);
                if (r.creditLimitWarning) toast.warning(r.creditLimitWarning);
                router.push('/inventory/invoices' as never);
              })} />
            ) : null}
            {item.status === 'INVOICED' ? (
              <Button label="Invoices" size="sm" variant="secondary" onPress={() => router.push('/inventory/invoices' as never)} />
            ) : null}
            {(item.status === 'CONFIRMED' || item.status === 'DELIVERED') ? (
              <Button label="Cancel" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                await soAction.mutateAsync({ id: item.id, action: 'cancel' });
                toast.info('Order cancelled');
              })} />
            ) : null}
            <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/sales-orders/${item.id}`, `so-${item.soNumber}.pdf`)} />
          </View>
        </View>
      );
    }
    return (
      <Card className="mb-2 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-text">{item.soNumber}</Text>
            <Text className="text-xs text-muted">{item.customerName}</Text>
            <Text className="text-[11px] text-muted mt-0.5">Total ₹{Number(item.total).toFixed(2)} · {item.lines.length} line(s)</Text>
          </View>
          <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        {item.notes?.includes('AUTO_STOCK_ISSUE') ? (
          <Text className="text-[11px] text-muted mt-1">Counter sale from stock issue - already invoiced</Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {item.status === 'DRAFT' ? (
            <Button label="Confirm" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              await soAction.mutateAsync({ id: item.id, action: 'confirm' });
              toast.success('Order confirmed');
            })} />
          ) : null}
          {item.status === 'CONFIRMED' ? (
            <Button label="Create challan" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              await createChallan.mutateAsync({ salesOrderId: item.id });
              toast.success('Challan created - dispatch to move stock');
            })} />
          ) : null}
          {(item.status === 'CONFIRMED' || item.status === 'DELIVERED') && delivered ? (
            <Button label="Invoice delivered qty" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
              const r = await invoiceFromSO.mutateAsync({ id: item.id });
              toast.success(`Invoice ${r.invoiceNumber} created`);
              if (r.creditLimitWarning) toast.warning(r.creditLimitWarning);
              router.push('/inventory/invoices' as never);
            })} />
          ) : null}
          {item.status === 'INVOICED' ? (
            <Button label="Go to invoices" size="sm" variant="secondary" onPress={() => router.push('/inventory/invoices' as never)} />
          ) : null}
          {item.status === 'CONFIRMED' || item.status === 'DELIVERED' ? (
            <Button label="Cancel" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              await soAction.mutateAsync({ id: item.id, action: 'cancel' });
              toast.info('Order cancelled');
            })} />
          ) : null}
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.3): printable SO PDF. */}
          <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/sales-orders/${item.id}`, `so-${item.soNumber}.pdf`)} />
        </View>
      </Card>
    );
  };

  const renderQuote = ({ item }: { item: Quote }) => {
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet row.
    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.quoteNumber}</Text>
          <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>{item.customerName}</Text>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-text text-right">₹{Number(item.total).toFixed(2)}</Text>
          <View className="flex-[1.8] flex-row flex-wrap justify-end gap-1">
            {item.status === 'DRAFT' ? (
              <Button label="Send" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                await quoteAction.mutateAsync({ id: item.id, action: 'send' });
                toast.success('Quote sent');
              })} />
            ) : null}
            {item.status === 'SENT' ? (
              <>
                <Button label="Accept" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'accept' });
                  toast.success('Quote accepted - convert to a sales order');
                })} />
                <Button label="Reject" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
                  toast.info('Quote rejected');
                })} />
              </>
            ) : null}
            {item.status === 'ACCEPTED' ? (
              <>
                <Button label="To sales order" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
                  await quoteToSO.mutateAsync(item.id);
                  toast.success('Sales order created from quote');
                })} />
                <Button label="Reject" size="sm" variant="ghost" disabled={busy} onPress={() => void run(async () => {
                  await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
                  toast.info('Quote rejected');
                })} />
              </>
            ) : null}
          </View>
        </View>
      );
    }
    return (
      <Card className="mb-2 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-text">{item.quoteNumber}</Text>
          <Text className="text-xs text-muted">{item.customerName}</Text>
          <Text className="text-[11px] text-muted mt-0.5">Total ₹{Number(item.total).toFixed(2)} · {item.lines.length} line(s)</Text>
        </View>
        <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
      </View>
      <View className="flex-row flex-wrap gap-2 mt-3">
        {item.status === 'DRAFT' ? (
          <Button label="Send" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
            await quoteAction.mutateAsync({ id: item.id, action: 'send' });
            toast.success('Quote sent');
          })} />
        ) : null}
        {item.status === 'SENT' ? (
          <>
            <Button label="Accept" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
              await quoteAction.mutateAsync({ id: item.id, action: 'accept' });
              toast.success('Quote accepted - convert to a sales order');
            })} />
            <Button label="Reject" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
              toast.info('Quote rejected');
            })} />
          </>
        ) : null}
        {item.status === 'ACCEPTED' && !item.salesOrderId ? (
          <Button label="Create sales order" size="sm" variant="accent" disabled={busy} onPress={() => void run(async () => {
            await quoteToSO.mutateAsync(item.id);
            toast.success('Sales order created from quote');
          })} />
        ) : null}
        {item.status === 'ACCEPTED' ? (
          <Button label="Reject" size="sm" variant="ghost" disabled={busy} onPress={() => void run(async () => {
            await quoteAction.mutateAsync({ id: item.id, action: 'reject' });
            toast.info('Quote rejected');
          })} />
        ) : null}
      </View>
    </Card>
  );
  };

  const renderChallan = ({ item }: { item: DeliveryChallan }) => {
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet row.
    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.dcNumber}</Text>
          <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>{item.customerName}</Text>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <Text className="flex-1 text-sm text-text text-right">{item.lines.length} line(s)</Text>
          <View className="flex-[1.6] flex-row flex-wrap justify-end gap-1">
            {item.status === 'DRAFT' ? (
              <Button label="Dispatch (stock OUT)" size="sm" variant="accent" onPress={() => setDispatchChallan(item)} />
            ) : null}
            {item.status === 'DISPATCHED' ? (
              <Button label="Deliver" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
                await challanTransition.mutateAsync({ id: item.id, action: 'deliver' });
                toast.success('Delivered');
              })} />
            ) : null}
            <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/delivery-challans/${item.id}`, `dc-${item.dcNumber}.pdf`)} />
          </View>
        </View>
      );
    }
    return (
      <Card className="mb-2 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-text">{item.dcNumber}</Text>
          <Text className="text-xs text-muted">{item.customerName}</Text>
          <Text className="text-[11px] text-muted mt-0.5">
            {item.salesOrder ? `From ${item.salesOrder.soNumber} · ` : ''}{item.lines.length} line(s)
          </Text>
        </View>
        <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
      </View>
      <View className="flex-row flex-wrap gap-2 mt-3">
        {item.status === 'DRAFT' ? (
          <Button label="Dispatch (stock OUT)" size="sm" variant="accent" onPress={() => setDispatchChallan(item)} />
        ) : null}
        {item.status === 'DISPATCHED' ? (
          <Button label="Deliver" size="sm" variant="secondary" disabled={busy} onPress={() => void run(async () => {
            await challanTransition.mutateAsync({ id: item.id, action: 'deliver' });
            toast.success('Delivered');
          })} />
        ) : null}
        {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.3): printable DC PDF. */}
        <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/delivery-challans/${item.id}`, `dc-${item.dcNumber}.pdf`)} />
      </View>
    </Card>
  );
  };

  const renderReturn = ({ item }: { item: SalesReturn | PurchaseReturn }) => {
    const isSales = 'customerName' in item;
    const party = isSales ? item.customerName : (item as PurchaseReturn).vendorName;
    const note = isSales ? (item as SalesReturn).creditNote : (item as PurchaseReturn).debitNote;
    const noteLabel = note ? ('creditNoteNumber' in note ? note.creditNoteNumber : note.debitNoteNumber) : null;
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet row.
    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.returnNumber}</Text>
          <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>{party}</Text>
          <Text className="flex-1 text-xs text-muted">{isSales ? 'Sales return' : 'Purchase return'}</Text>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-text text-right">₹{Number(item.total).toFixed(2)}</Text>
          <View className="flex-[1.2] flex-row justify-end gap-1">
            <Button
              label={isSales ? 'Invoices' : 'Vendor bills'}
              size="sm"
              variant="secondary"
              onPress={() => router.push((isSales ? '/inventory/invoices' : '/inventory/bills') as never)}
            />
          </View>
        </View>
      );
    }
    return (
      <Card className="mb-2 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-text">{item.returnNumber}</Text>
            <Text className="text-xs text-muted">{party} · {isSales ? 'sales return' : 'purchase return'}</Text>
            <Text className="text-[11px] text-muted mt-0.5">
              Total ₹{Number(item.total).toFixed(2)} · {item.lines.length} line(s)
              {noteLabel ? ` · ${noteLabel}` : ''}
            </Text>
          </View>
          <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
        </View>
        <View className="flex-row flex-wrap gap-2 mt-3">
          <Button
            label={isSales ? 'Go to invoices' : 'Go to vendor bills'}
            size="sm"
            variant="secondary"
            onPress={() => router.push((isSales ? '/inventory/invoices' : '/inventory/bills') as never)}
          />
        </View>
      </Card>
    );
  };

  const renderNote = ({ item }: { item: { id: string; number: string; party: string; status: string; total: string; kind: 'credit' | 'debit' } }) => {
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet row.
    if (tableMode) {
      return (
        <View className="flex-row items-center px-4 py-3 bg-card border-b border-border/60">
          <Text className="flex-[1.2] text-sm font-mono font-semibold text-text">{item.number}</Text>
          <Text className="flex-[1.4] text-sm text-text" numberOfLines={1}>{item.party}</Text>
          <Text className="flex-1 text-xs text-muted">{item.kind === 'credit' ? 'Credit note' : 'Debit note'}</Text>
          <View className="flex-1">
            <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-text text-right">₹{Number(item.total).toFixed(2)}</Text>
          <View className="flex-[1.2] flex-row justify-end gap-1">
            {item.status === 'DRAFT' ? (
              <Button
                label="Issue note"
                size="sm"
                variant="accent"
                disabled={busy}
                onPress={() => void run(async () => {
                  await (item.kind === 'credit' ? issueCreditNote : issueDebitNote).mutateAsync(item.id);
                  toast.success('Note issued - included in Tally export');
                })}
              />
            ) : null}
          </View>
        </View>
      );
    }
    return (
      <Card className="mb-2 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-text">{item.number}</Text>
          <Text className="text-xs text-muted">{item.party}</Text>
          <Text className="text-[11px] text-muted mt-0.5">Total ₹{Number(item.total).toFixed(2)}</Text>
        </View>
        <Badge color={STATUS_COLOR[item.status] ?? 'neutral'} label={item.status} />
      </View>
      {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 5.4): issue a DRAFT note so Tally exports it. */}
      {item.status === 'DRAFT' ? (
        <View className="flex-row flex-wrap gap-2 mt-3">
          <Button
            label="Issue note"
            size="sm"
            variant="accent"
            disabled={busy}
            onPress={() => void run(async () => {
              await (item.kind === 'credit' ? issueCreditNote : issueDebitNote).mutateAsync(item.id);
              toast.success('Note issued - included in Tally export');
            })}
          />
          <Text className="text-[11px] text-muted w-full">
            Draft notes are not exported to Tally. Issue to finalise.
          </Text>
        </View>
      ) : null}
    </Card>
  );
  };

  type NoteRow = { id: string; number: string; party: string; status: string; total: string; kind: 'credit' | 'debit' };
  const creditRows: NoteRow[] = (creditNotes.data ?? []).map((n: CreditNote) => ({ id: n.id, number: n.creditNoteNumber, party: n.customerName, status: n.status, total: n.total, kind: 'credit' as const }));
  const debitRows: NoteRow[] = (debitNotes.data ?? []).map((n: DebitNote) => ({ id: n.id, number: n.debitNoteNumber, party: n.vendorName, status: n.status, total: n.total, kind: 'debit' as const }));

  const loading =
    (tab === 'orders' && orders.isLoading) ||
    (tab === 'quotes' && quotes.isLoading) ||
    (tab === 'deliveries' && challans.isLoading) ||
    (tab === 'returns' && (salesReturns.isLoading || purchaseReturns.isLoading)) ||
    (tab === 'notes' && (creditNotes.isLoading || debitNotes.isLoading));

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'orders', label: 'Sales orders' },
    { key: 'quotes', label: 'Quotes' },
    { key: 'deliveries', label: 'Deliveries' },
    { key: 'returns', label: 'Returns' },
    { key: 'notes', label: 'Credit/Debit notes' },
  ];

  const dataForTab: any[] =
    tab === 'orders'
      ? (orders.data ?? [])
      : tab === 'quotes'
        ? (quotes.data ?? [])
        : tab === 'deliveries'
          ? (challans.data ?? [])
          : tab === 'returns'
            ? [...(salesReturns.data ?? []), ...(purchaseReturns.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            : [...creditRows, ...debitRows].sort((a, b) => b.id.localeCompare(a.id));

  const renderRow = ({ item }: { item: any }) => {
    if (tab === 'orders') return renderOrder({ item: item as SalesOrder });
    if (tab === 'quotes') return renderQuote({ item: item as Quote });
    if (tab === 'deliveries') return renderChallan({ item: item as DeliveryChallan });
    if (tab === 'returns') return renderReturn({ item: item as SalesReturn | PurchaseReturn });
    return renderNote({ item });
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay visible={busy} title={translate('inventory.page.sales', 'Sales')} />
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 min-w-[180px] mr-2">
          <Text className="text-2xl font-bold text-text">{translate('inventory.page.sales', 'Sales')}</Text>
          <Text className="text-sm text-muted mt-0.5">
            Sales order → delivery challan → invoice. Stock issues also appear here as invoiced counter sales.
          </Text>
        </View>
        {headerLabel ? <Button label={headerLabel} variant="accent" size="sm" disabled={busy} onPress={headerAction} /> : null}
      </View>

      <View className="flex-row flex-wrap px-4 pb-2 gap-2">
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg border ${tab === t.key ? 'bg-primary border-primary' : 'bg-card border-border'}`}
          >
            <Text className={`text-xs font-medium ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3].map((i) => <LoadingSkeleton key={i} className="rounded-xl h-16" />)}
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4"
          data={dataForTab}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ListEmptyComponent={
            <EmptyState
              title={
                tab === 'orders' ? 'No sales orders yet'
                : tab === 'quotes' ? 'No quotes yet'
                : tab === 'deliveries' ? 'No delivery challans yet'
                : tab === 'returns' ? 'No returns yet'
                : 'No credit/debit notes yet'
              }
              description={
                tab === 'orders' ? 'Issue stock from Stock/materials to create a counter sale, or tap New order for the formal flow.'
                : tab === 'quotes' ? 'Create a quote, then accept it to convert to a sales order.'
                : tab === 'deliveries' ? 'Confirm a sales order, then create a challan.'
                : tab === 'returns' ? 'Record a return against an invoice or bill.'
                : 'Notes are created automatically from returns.'
              }
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View>
              {/* INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4, K8): desktop/tablet
                  column headers above the table rows. */}
              {tableMode && dataForTab.length > 0 ? (
                <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
                  <Text className="flex-[1.2] text-[11px] font-bold text-muted uppercase">Number</Text>
                  <Text className="flex-[1.4] text-[11px] font-bold text-muted uppercase">Party</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Status</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Total</Text>
                  <Text className="flex-[1.6] text-[11px] font-bold text-muted uppercase text-right">Actions</Text>
                </View>
              ) : null}
              {tab === 'returns' ? (
                <View className="flex-row flex-wrap gap-2 pb-2">
                  <Button label="New sales return" size="sm" variant="secondary" onPress={() => setSalesReturnOpen(true)} />
                  <Button label="New purchase return" size="sm" variant="secondary" onPress={() => setPurchaseReturnOpen(true)} />
                </View>
              ) : null}
            </View>
          }
        />
      )}

      {soOpen ? (
        <NewSalesOrderModal
          open={soOpen}
          onClose={() => setSoOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              await createSO.mutateAsync(input);
              toast.success('Sales order created');
              setSoOpen(false);
            });
          }}
        />
      ) : null}
      {quoteOpen ? (
        <NewQuoteModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              await createQuote.mutateAsync(input);
              toast.success('Quote created');
              setQuoteOpen(false);
            });
          }}
        />
      ) : null}
      {challanOpen ? (
        <NewChallanModal
          open={challanOpen}
          onClose={() => setChallanOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              await createChallan.mutateAsync(input);
              toast.success('Challan created');
              setChallanOpen(false);
            });
          }}
        />
      ) : null}
      {dispatchChallan ? (
        <DispatchChallanSheet
          open
          dcNumber={dispatchChallan.dcNumber}
          onClose={() => setDispatchChallan(null)}
          onDispatch={async (locationId) => {
            await run(async () => {
              const r = await challanTransition.mutateAsync({
                id: dispatchChallan.id,
                action: 'dispatch',
                locationId,
              });
              toast.success(
                r.draftInvoiceId
                  ? 'Dispatched - stock moved OUT · draft invoice created'
                  : 'Dispatched - stock moved OUT',
              );
              setDispatchChallan(null);
              if (r.draftInvoiceId) router.push('/inventory/invoices' as never);
            });
          }}
        />
      ) : null}
      {salesReturnOpen ? (
        <SalesReturnModal
          open={salesReturnOpen}
          projectId={projectId}
          onClose={() => setSalesReturnOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              const r = await createSalesReturn.mutateAsync(input);
              toast.success(`Return ${r.salesReturn.returnNumber} recorded - draft credit note created`);
              setSalesReturnOpen(false);
              router.push('/inventory/invoices' as never);
            });
          }}
        />
      ) : null}
      {purchaseReturnOpen ? (
        <PurchaseReturnModal
          open={purchaseReturnOpen}
          projectId={projectId}
          onClose={() => setPurchaseReturnOpen(false)}
          onSubmit={async (input) => {
            await run(async () => {
              const r = await createPurchaseReturn.mutateAsync(input);
              toast.success(`Return ${r.purchaseReturn.returnNumber} recorded - draft debit note created`);
              setPurchaseReturnOpen(false);
              router.push('/inventory/bills' as never);
            });
          }}
        />
      ) : null}
    </View>
  );
}

