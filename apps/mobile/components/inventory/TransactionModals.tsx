import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { Button, Input, Select } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { useCustomers } from '@/services/party.queries';
import { useResources } from '@/services/estimate.queries';
import { useInvoices, useBills } from '@/services/accounting.queries';
import { useStockSummary } from '@/services/expansion.queries';
import { useSalesOrders } from '@/services/sales.queries';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';

function Sheet({
  title,
  subtitle,
  children,
  saving,
  onClose,
  visible = true,
  fullScreen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  saving: boolean;
  onClose: () => void;
  /** When false the modal is hidden. Prefer unmounting callers when closed. */
  visible?: boolean;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.6): multi-line operational
  // modals (SO / challan / quote / returns) open as a viewport-filling
  // workspace; single-entity forms keep the compact dialog.
  fullScreen?: boolean;
}) {
  const { isPhone } = useViewport();
  return (
    <Modal
      visible={visible}
      animationType={isPhone ? 'slide' : 'fade'}
      transparent
      onRequestClose={saving ? undefined : onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : fullScreen ? '' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${
            fullScreen
              ? isPhone
                ? 'rounded-t-2xl h-[96%] p-4'
                : 'h-full'
              : isPhone
                ? 'rounded-t-2xl max-h-[92%] p-4'
                : 'rounded-2xl max-w-lg max-h-[85%] p-4'
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-1">{title}</Text>
          {subtitle ? <Text className="text-sm text-muted mb-3">{subtitle}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type DraftLine = {
  key: string;
  resourceId: string;
  quantity: string;
  rate: string;
  gstRate: string;
  unit: string;
  returnKind: 'GOOD' | 'DAMAGED';
};
const newKey = () => `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function useProjectStockBalances() {
  const projectId = useAuthStore((s) => s.user?.defaultProjectId ?? '');
  const { data } = useStockSummary(projectId);
  const rows: Array<{ resourceId: string; balance: number }> = data ?? [];
  return useMemo(() => new Map(rows.map((r) => [r.resourceId, r.balance])), [rows]);
}

function LineEditor({
  lines,
  setLines,
  showKind,
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price-list overrides.
  rateOverrides,
}: {
  lines: DraftLine[];
  setLines: React.Dispatch<React.SetStateAction<DraftLine[]>>;
  showKind?: boolean;
  rateOverrides?: Record<string, number>;
}) {
  const { data } = useResources();
  const resources: Array<{ id: string; name: string; unit: string; rate?: number | string | null; gstRate?: number | string | null }> =
    Array.isArray(data) ? data : (data?.data ?? []);
  const balances = useProjectStockBalances();
  const options = resources.map((r) => ({
    title: `${r.name}${balances.has(r.id) ? ` · on hand ${balances.get(r.id)}` : ''}`,
    value: r.id,
  }));
  const patch = (key: string, field: keyof DraftLine, value: string) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  return (
    <View className="gap-2 mt-2">
      {lines.map((l, idx) => {
        const resource = resources.find((r) => r.id === l.resourceId);
        return (
          <View key={l.key} className="bg-surface rounded-xl border border-border p-3">
            <Select
              label={`Item ${idx + 1}`}
              value={l.resourceId || undefined}
              options={options}
              onChange={(v) => {
                if (!v) return;
                const r = resources.find((x) => x.id === v);
                patch(l.key, 'resourceId', v);
                patch(l.key, 'unit', r?.unit ?? 'no');
                if (r?.gstRate != null) patch(l.key, 'gstRate', String(r.gstRate));
                const effective = rateOverrides?.[v];
                if (effective != null && effective > 0) {
                  patch(l.key, 'rate', String(effective));
                } else if (!l.rate && r?.rate != null && Number(r.rate) > 0) {
                  patch(l.key, 'rate', String(r.rate));
                }
              }}
              placeholder="Select item"
            />
            <View className="flex-row gap-2 mt-2">
              <View className="flex-1">
                <Input label="Qty" value={l.quantity} onChangeText={(v) => patch(l.key, 'quantity', v)} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Input label="Selling ₹" value={l.rate} onChangeText={(v) => patch(l.key, 'rate', v)} keyboardType="numeric" />
              </View>
              <View className="w-[80px]">
                <Input label="GST %" value={l.gstRate} onChangeText={(v) => patch(l.key, 'gstRate', v)} keyboardType="numeric" />
              </View>
              <Pressable onPress={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="justify-end pb-1">
                <Text className="text-sm font-semibold text-danger">✕</Text>
              </Pressable>
            </View>
            {showKind ? (
              <View className="flex-row gap-2 mt-2">
                {(['GOOD', 'DAMAGED'] as const).map((k) => {
                  const active = (l.returnKind ?? 'GOOD') === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => patch(l.key, 'returnKind', k)}
                      className={`px-3 py-1.5 rounded-lg border ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                    >
                      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-muted'}`}>
                        {k === 'GOOD' ? 'Good → restock' : 'Damaged → scrap'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
      <Button
        label="Add item"
        variant="secondary"
        size="sm"
        onPress={() => setLines((prev) => [...prev, { key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }])}
      />
    </View>
  );
}
/* ── New sales order ──────────────────────────────────────────────── */

export function NewSalesOrderModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    customerId?: string;
    customerName: string;
    orderDate: string;
    notes?: string;
    lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: customers } = useCustomers();
  const [customerId, setCustomerId] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): effective-rate prefill.
  const { data: effectiveRates } = useEffectiveRates(customerId || undefined);
  const [customerName, setCustomerName] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCustomerId('');
      setCustomerName('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
    }
  }, [open]);

  const customerOptions = (customers ?? []).map((c: { id: string; name: string }) => ({ title: c.name, value: c.id }));

  const submit = async () => {
    setError('');
    const name = customerId
      ? customerOptions.find((o: { value: string; title?: string }) => o.value === customerId)?.title ?? customerName
      : customerName.trim();
    const goodLines = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (!name || goodLines.length === 0) {
      setError('Pick a customer and add at least one item with quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...(customerId ? { customerId } : {}),
        customerName: name,
        orderDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: goodLines.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          unit: l.unit || 'no',
          rate: Number(l.rate) || 0,
          gstRate: Number(l.gstRate) || 0,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create sales order');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet visible={open} title="New sales order" subtitle="Draft → confirm → challan → invoice" saving={saving} onClose={onClose} fullScreen>
      <Select
        label="Customer"
        value={customerId || undefined}
        options={customerOptions}
        onChange={(v) => {
          setCustomerId(v ?? '');
          const c = (customers ?? []).find((x: { id: string; name: string }) => x.id === v);
          if (c) setCustomerName(c.name);
        }}
        placeholder="Pick from customers"
      />
      <Input label="Customer name (if not in master)" value={customerName} onChangeText={setCustomerName} />
      <Input label="Order date" value={orderDate} onChangeText={setOrderDate} />
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <LineEditor lines={lines} setLines={setLines} rateOverrides={effectiveRates} />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Create order'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>
    </Sheet>
  );
}

/* ── New delivery challan (from a confirmed SO) ───────────────────── */

export function NewChallanModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    salesOrderId: string;
    notes?: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.6): subset lines + per-line batch.
    lines?: Array<{ salesOrderLineId: string; quantity: number; batchCode?: string }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: orders } = useSalesOrders();
  const [salesOrderId, setSalesOrderId] = useState('');
  const [notes, setNotes] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line qty + batch.
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [batchByLine, setBatchByLine] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSalesOrderId('');
      setNotes('');
      setQtyByLine({});
      setBatchByLine({});
      setError('');
    }
  }, [open]);

  const eligible = useMemo(
    () =>
      (orders ?? []).filter((o: { id: string; status: string; soNumber: string; customerName: string; lines: Array<{ quantity: string; deliveredQty: string }> }) => {
        if (o.status !== 'CONFIRMED') return false;
        return o.lines.some((l) => Number(l.quantity) - Number(l.deliveredQty) > 0);
      }),
    [orders],
  );

  const selectedOrder = eligible.find((o: { id: string }) => o.id === salesOrderId);

  const remainingFor = (l: { quantity: string; deliveredQty: string }): number => {
    const rem = Number(l.quantity) - Number(l.deliveredQty);
    return rem > 0 ? rem : 0;
  };

  const submit = async () => {
    setError('');
    if (!salesOrderId) {
      setError('Pick a confirmed sales order.');
      return;
    }
    const so = eligible.find((o: { id: string }) => o.id === salesOrderId);
    const lines = (so?.lines ?? [])
      .filter((l: { id: string; quantity: string; deliveredQty: string }) => remainingFor(l) > 0)
      .map((l: { id: string; quantity: string; deliveredQty: string }) => {
        const qty = qtyByLine[l.id] !== undefined ? Number(qtyByLine[l.id]) : remainingFor(l);
        return {
          salesOrderLineId: l.id,
          quantity: qty,
          ...(batchByLine[l.id]?.trim() ? { batchCode: batchByLine[l.id].trim() } : {}),
        };
      })
      .filter((l: { quantity: number }) => l.quantity > 0);
    if (lines.length === 0) {
      setError('Choose at least one line with quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        salesOrderId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create challan');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet
      visible={open}
      title="New delivery challan"
      subtitle="Pick which undelivered lines to ship (defaults to all). Dispatch moves stock OUT."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Sales order"
        value={salesOrderId || undefined}
        options={eligible.map((o: { id: string; soNumber: string; customerName: string }) => ({ title: `${o.soNumber} · ${o.customerName}`, value: o.id }))}
        onChange={(v) => {
          setSalesOrderId(v ?? '');
          setQtyByLine({});
          setBatchByLine({});
        }}
        placeholder="Confirmed orders only"
      />
      {selectedOrder ? (
        <View className="bg-surface rounded-xl border border-border p-3 mt-2">
          <Text className="text-xs font-semibold text-muted uppercase mb-1.5">Lines to ship</Text>
          {(selectedOrder.lines as Array<{
            id: string;
            itemName: string;
            unit: string;
            quantity: string;
            deliveredQty: string;
          }>)
            .filter((l) => remainingFor(l) > 0)
            .map((l) => {
              const rem = remainingFor(l);
              return (
                <View key={l.id} className="mb-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-xs text-text" numberOfLines={1}>
                      {l.itemName} (undelivered {rem} {l.unit})
                    </Text>
                    <View className="w-20">
                      <Input
                        label=""
                        placeholder={String(rem)}
                        value={qtyByLine[l.id] ?? ''}
                        onChangeText={(v) => setQtyByLine((prev) => ({ ...prev, [l.id]: v }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line batch. */}
                  <Input
                    label="Batch / lot code (optional)"
                    value={batchByLine[l.id] ?? ''}
                    onChangeText={(v) => setBatchByLine((prev) => ({ ...prev, [l.id]: v }))}
                    autoCapitalize="characters"
                    placeholder="e.g. LOT-2026-A - copied to the OUT movement on dispatch"
                  />
                </View>
              );
            })}
        </View>
      ) : null}
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className={`flex-row gap-2 mt-4 mb-4 ${isPhone ? '' : ''}`}>
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Create challan'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>
    </Sheet>
  );
}

/* ── New quote (Phase 9.2: quote → sales order) ───────────────────── */

export function NewQuoteModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    customerId?: string;
    customerName: string;
    quoteDate?: string;
    validUntil?: string;
    notes?: string;
    lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
  }) => Promise<void>;
}) {
  const { data: customers } = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): effective-rate prefill on quotes too.
  const { data: effectiveRates } = useEffectiveRates(customerId || undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCustomerId('');
      setCustomerName('');
      setQuoteDate(new Date().toISOString().slice(0, 10));
      setValidUntil('');
      setNotes('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
    }
  }, [open]);

  const customerOptions = (customers ?? []).map((c: { id: string; name: string }) => ({ title: c.name, value: c.id }));

  const submit = async () => {
    setError('');
    const name = customerId
      ? customerOptions.find((o: { value: string }) => o.value === customerId)?.title ?? customerName
      : customerName.trim();
    const goodLines = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (!name || goodLines.length === 0) {
      setError('Pick a customer and add at least one item with quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...(customerId ? { customerId } : {}),
        customerName: name,
        quoteDate,
        ...(validUntil.trim() ? { validUntil: validUntil.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: goodLines.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          unit: l.unit || 'no',
          rate: Number(l.rate) || 0,
          gstRate: Number(l.gstRate) || 0,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create quote');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet visible={open} title="New quote" subtitle="Draft → send → accept → convert to a sales order" saving={saving} onClose={onClose} fullScreen>
      <Select
        label="Customer"
        value={customerId || undefined}
        options={customerOptions}
        onChange={(v) => {
          setCustomerId(v ?? '');
          const c = (customers ?? []).find((x: { id: string; name: string }) => x.id === v);
          if (c) setCustomerName(c.name);
        }}
        placeholder="Pick from customers"
      />
      <Input label="Customer name (if not in master)" value={customerName} onChangeText={setCustomerName} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input label="Quote date" value={quoteDate} onChangeText={setQuoteDate} />
        </View>
        <View className="flex-1">
          <Input label="Valid until" value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD" />
        </View>
      </View>
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <LineEditor lines={lines} setLines={setLines} rateOverrides={effectiveRates} />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Create quote'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>
    </Sheet>
  );
}

/* ── Dispatch a draft challan (warehouse picker, Phase 8.6) ────────── */

export function DispatchChallanSheet({
  open,
  dcNumber,
  onClose,
  onDispatch,
}: {
  open: boolean;
  dcNumber: string | null;
  onClose: () => void;
  onDispatch: (locationId?: string) => Promise<void>;
}) {
  const { data: warehouses } = useWarehouses();
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLocationId('');
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <Sheet
      visible={open}
      title={`Dispatch ${dcNumber ?? 'challan'}`}
      subtitle="Stock moves OUT for the challan lines. Optionally pick the dispatch warehouse."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Dispatch from warehouse (optional)"
        value={locationId || undefined}
        onChange={(v) => setLocationId(v ?? '')}
        options={(warehouses ?? []).map((w: Warehouse) => ({ title: w.name, value: w.id }))}
        placeholder="Company default warehouse"
      />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
        <Button
          label={saving ? 'Dispatching…' : 'Dispatch (stock OUT)'}
          variant="accent"
          className="flex-1 min-w-[140px]"
          loading={saving}
          onPress={() => {
            void (async () => {
              setSaving(true);
              setError('');
              try {
                await onDispatch(locationId || undefined);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not dispatch');
              } finally {
                setSaving(false);
              }
            })();
          }}
        />
      </View>
    </Sheet>
  );
}

/* ── Sales return (from a sent/paid invoice) ──────────────────────── */
export function SalesReturnModal({
  open,
  projectId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSubmit: (input: {
    invoiceId: string;
    returnDate: string;
    reason?: string;
    lines: Array<{
      resourceId: string;
      quantity: number;
      unit: string;
      rate: number;
      gstRate?: number;
      returnKind: 'GOOD' | 'DAMAGED';
    }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: invoices } = useInvoices(projectId);
  const [invoiceId, setInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setInvoiceId('');
      setReturnDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
    }
  }, [open]);

  const invoiceOptions = useMemo(
    () =>
      (invoices ?? []).filter((i: { id: string; status: string; invoiceNumber: string; clientName: string; lineItems: Array<{ description: string; quantity: number }> }) =>
        ['SENT', 'PAID', 'OVERDUE'].includes(i.status),
      ).map((i: { id: string; invoiceNumber: string; clientName: string }) => ({ title: `${i.invoiceNumber} · ${i.clientName}`, value: i.id })),
    [invoices],
  );
  const selectedInvoice = (invoices ?? []).find((i: { id: string; status: string; invoiceNumber: string; clientName: string; lineItems: Array<{ description: string; quantity: number }> }) => i.id === invoiceId);

  const submit = async () => {
    setError('');
    if (!invoiceId) {
      setError('Pick an invoice to return against.');
      return;
    }
    const goodLines = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (goodLines.length === 0) {
      setError('Add at least one returned item with quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        invoiceId,
        returnDate,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        lines: goodLines.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          unit: l.unit || 'no',
          rate: Number(l.rate) || 0,
          gstRate: Number(l.gstRate) || 0,
          returnKind: l.returnKind,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create return');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet
      visible={open}
      title="New sales return"
      subtitle="Good items restock; damaged items are scrapped. A draft credit note is created."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Invoice"
        value={invoiceId || undefined}
        options={invoiceOptions}
        onChange={(v) => setInvoiceId(v ?? '')}
        placeholder="Sent / paid invoices"
      />
      {selectedInvoice && selectedInvoice.lineItems.length > 0 ? (
        <Text className="text-xs text-muted mt-1 mb-2">
          Invoice lines: {selectedInvoice.lineItems.map((l: { description: string; quantity: number }) => `${l.description} × ${l.quantity}`).join(', ')}
        </Text>
      ) : null}
      <Input label="Return date" value={returnDate} onChangeText={setReturnDate} />
      <Input label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
      <LineEditor lines={lines} setLines={setLines} showKind />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className={`flex-row gap-2 mt-4 mb-4 ${isPhone ? '' : ''}`}>
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Record return'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>
    </Sheet>
  );
}

/* ── Purchase return (from a bill) ────────────────────────────────── */

export function PurchaseReturnModal({
  open,
  projectId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSubmit: (input: {
    billId: string;
    returnDate: string;
    reason?: string;
    lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: bills } = useBills(projectId);
  const [billId, setBillId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBillId('');
      setReturnDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
    }
  }, [open]);

  const billOptions = useMemo(
    () =>
      (bills ?? []).filter((b: { id: string; status: string; billNumber: string; vendorName: string }) =>
        ['APPROVED', 'PAID'].includes(b.status),
      ).map((b: { id: string; billNumber: string; vendorName: string }) => ({ title: `${b.billNumber} · ${b.vendorName}`, value: b.id })),
    [bills],
  );

  const submit = async () => {
    setError('');
    if (!billId) {
      setError('Pick a bill to return against.');
      return;
    }
    const goodLines = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (goodLines.length === 0) {
      setError('Add at least one returned item with quantity.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        billId,
        returnDate,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        lines: goodLines.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          unit: l.unit || 'no',
          rate: Number(l.rate) || 0,
          gstRate: Number(l.gstRate) || 0,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create return');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet
      visible={open}
      title="New purchase return"
      subtitle="Return stock to the vendor. A draft debit note is created."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Bill"
        value={billId || undefined}
        options={billOptions}
        onChange={(v) => setBillId(v ?? '')}
        placeholder="Approved / paid bills"
      />
      <Input label="Return date" value={returnDate} onChangeText={setReturnDate} />
      <Input label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
      <LineEditor lines={lines} setLines={setLines} />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className={`flex-row gap-2 mt-4 mb-4 ${isPhone ? '' : ''}`}>
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Record return'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>
    </Sheet>
  );
}

