import React, { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, toast } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
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
        <View className="flex-row flex-wrap gap-2 mt-3">
          {item.status === 'DRAFT' ? (
            <Button label="Confirm" size="sm" variant="secondary" onPress={() => void soAction.mutateAsync({ id: item.id, action: 'confirm' }).then(() => toast.success('Order confirmed'))} />
          ) : null}
          {item.status === 'CONFIRMED' ? (
            <Button label="Create challan" size="sm" variant="secondary" onPress={() => void createChallan.mutateAsync({ salesOrderId: item.id }).then(() => toast.success('Challan created - dispatch to move stock'))} />
          ) : null}
          {(item.status === 'CONFIRMED' || item.status === 'DELIVERED') && delivered ? (
            <Button label="Invoice delivered qty" size="sm" variant="accent" onPress={() => void invoiceFromSO.mutateAsync({ id: item.id }).then((r) => {
              toast.success(`Invoice ${r.invoiceNumber} created`);
              if (r.creditLimitWarning) toast.warning(r.creditLimitWarning);
            })} />
          ) : null}
          {item.status === 'CONFIRMED' || item.status === 'DELIVERED' ? (
            <Button label="Cancel" size="sm" variant="secondary" onPress={() => void soAction.mutateAsync({ id: item.id, action: 'cancel' }).then(() => toast.info('Order cancelled'))} />
          ) : null}
          {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.3): printable SO PDF. */}
          <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/sales-orders/${item.id}`, `so-${item.soNumber}.pdf`)} />
        </View>
      </Card>
    );
  };

  const renderQuote = ({ item }: { item: Quote }) => (
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
          <Button label="Send" size="sm" variant="secondary" onPress={() => void quoteAction.mutateAsync({ id: item.id, action: 'send' }).then(() => toast.success('Quote sent'))} />
        ) : null}
        {item.status === 'SENT' ? (
          <>
            <Button label="Accept" size="sm" variant="accent" onPress={() => void quoteAction.mutateAsync({ id: item.id, action: 'accept' }).then(() => toast.success('Quote accepted - convert to a sales order'))} />
            <Button label="Reject" size="sm" variant="secondary" onPress={() => void quoteAction.mutateAsync({ id: item.id, action: 'reject' }).then(() => toast.info('Quote rejected'))} />
          </>
        ) : null}
        {item.status === 'ACCEPTED' && !item.salesOrderId ? (
          <Button label="Create sales order" size="sm" variant="accent" onPress={() => void quoteToSO.mutateAsync(item.id).then(() => toast.success('Sales order created from quote'))} />
        ) : null}
        {/* Allow rejecting/voiding an accepted quote (no duplicate Reject for SENT). */}
        {item.status === 'ACCEPTED' ? (
          <Button label="Reject" size="sm" variant="ghost" onPress={() => void quoteAction.mutateAsync({ id: item.id, action: 'reject' }).then(() => toast.info('Quote rejected'))} />
        ) : null}
      </View>
    </Card>
  );

  const renderChallan = ({ item }: { item: DeliveryChallan }) => (
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
          <Button label="Deliver" size="sm" variant="secondary" onPress={() => void challanTransition.mutateAsync({ id: item.id, action: 'deliver' }).then(() => toast.success('Delivered'))} />
        ) : null}
        {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 9.3): printable DC PDF. */}
        <Button label="PDF" size="sm" variant="ghost" onPress={() => void downloadReportPdf(`/inventory/pdf/delivery-challans/${item.id}`, `dc-${item.dcNumber}.pdf`)} />
      </View>
    </Card>
  );
  const renderReturn = ({ item }: { item: SalesReturn | PurchaseReturn }) => {
    const isSales = 'customerName' in item;
    const party = isSales ? item.customerName : (item as PurchaseReturn).vendorName;
    const note = isSales ? (item as SalesReturn).creditNote : (item as PurchaseReturn).debitNote;
    const noteLabel = note ? ('creditNoteNumber' in note ? note.creditNoteNumber : note.debitNoteNumber) : null;
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
      </Card>
    );
  };

  const renderNote = ({ item }: { item: { id: string; number: string; party: string; status: string; total: string; kind: 'credit' | 'debit' } }) => (
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
            onPress={() =>
              void (item.kind === 'credit' ? issueCreditNote : issueDebitNote)
                .mutateAsync(item.id)
                .then(() => toast.success('Note issued - included in Tally export'))
            }
          />
          <Text className="text-[11px] text-muted w-full">
            Draft notes are not exported to Tally. Issue to finalise.
          </Text>
        </View>
      ) : null}
    </Card>
  );

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
      <View className="px-4 pt-4 pb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 min-w-[180px] mr-2">
          <Text className="text-2xl font-bold text-text">Sales</Text>
          <Text className="text-sm text-muted mt-0.5">
            Sales order → delivery challan → invoice. Returns create draft credit/debit notes.
          </Text>
        </View>
        {headerLabel ? <Button label={headerLabel} variant="accent" size="sm" onPress={headerAction} /> : null}
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
                tab === 'orders' ? 'Create an order to start the formal sales flow.'
                : tab === 'quotes' ? 'Create a quote, then accept it to convert to a sales order.'
                : tab === 'deliveries' ? 'Confirm a sales order, then create a challan.'
                : tab === 'returns' ? 'Record a return against an invoice or bill.'
                : 'Notes are created automatically from returns.'
              }
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            tab === 'returns' ? (
              <View className="flex-row flex-wrap gap-2 pb-2">
                <Button label="New sales return" size="sm" variant="secondary" onPress={() => setSalesReturnOpen(true)} />
                <Button label="New purchase return" size="sm" variant="secondary" onPress={() => setPurchaseReturnOpen(true)} />
              </View>
            ) : null
          }
        />
      )}

      {soOpen ? (
        <NewSalesOrderModal
          open={soOpen}
          onClose={() => setSoOpen(false)}
          onSubmit={async (input) => {
            await createSO.mutateAsync(input);
            toast.success('Sales order created');
            setSoOpen(false);
          }}
        />
      ) : null}
      {quoteOpen ? (
        <NewQuoteModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          onSubmit={async (input) => {
            await createQuote.mutateAsync(input);
            toast.success('Quote created');
            setQuoteOpen(false);
          }}
        />
      ) : null}
      {challanOpen ? (
        <NewChallanModal
          open={challanOpen}
          onClose={() => setChallanOpen(false)}
          onSubmit={async (input) => {
            await createChallan.mutateAsync(input);
            toast.success('Challan created');
            setChallanOpen(false);
          }}
        />
      ) : null}
      {dispatchChallan ? (
        <DispatchChallanSheet
          open
          dcNumber={dispatchChallan.dcNumber}
          onClose={() => setDispatchChallan(null)}
          onDispatch={async (locationId) => {
            await challanTransition.mutateAsync({
              id: dispatchChallan.id,
              action: 'dispatch',
              locationId,
            });
            toast.success('Dispatched - stock moved OUT');
            setDispatchChallan(null);
          }}
        />
      ) : null}
      {salesReturnOpen ? (
        <SalesReturnModal
          open={salesReturnOpen}
          projectId={projectId}
          onClose={() => setSalesReturnOpen(false)}
          onSubmit={async (input) => {
            const r = await createSalesReturn.mutateAsync(input);
            toast.success(`Return ${r.salesReturn.returnNumber} recorded - draft credit note created`);
            setSalesReturnOpen(false);
          }}
        />
      ) : null}
      {purchaseReturnOpen ? (
        <PurchaseReturnModal
          open={purchaseReturnOpen}
          projectId={projectId}
          onClose={() => setPurchaseReturnOpen(false)}
          onSubmit={async (input) => {
            const r = await createPurchaseReturn.mutateAsync(input);
            toast.success(`Return ${r.purchaseReturn.returnNumber} recorded - draft debit note created`);
            setPurchaseReturnOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

