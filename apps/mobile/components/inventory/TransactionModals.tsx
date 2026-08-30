import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { useCustomers } from '@/services/party.queries';
import { useResources } from '@/services/estimate.queries';
import { useInvoices, useBills } from '@/services/accounting.queries';
import { useStockSummary } from '@/services/expansion.queries';
import { useSalesOrders, useValidateReturnScan, type DeliveryChallan } from '@/services/sales.queries';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';
import { BarcodeScannerOverlay } from '@/components/inventory/BarcodeScannerOverlay';
import { Ionicons } from '@expo/vector-icons';

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

function useProjectStockBalances(locationId?: string) {
  const projectId = useAuthStore((s) => s.user?.defaultProjectId ?? '');
  const { data } = useStockSummary(projectId, locationId);
  const rows: Array<{ resourceId: string; balance: number }> = data ?? [];
  return useMemo(() => new Map(rows.map((r) => [r.resourceId, r.balance])), [rows]);
}

function LineEditor({
  lines,
  setLines,
  showKind,
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price-list overrides.
  rateOverrides,
  allowedResourceIds,
  locationId,
  warehouseName,
}: {
  lines: DraftLine[];
  setLines: React.Dispatch<React.SetStateAction<DraftLine[]>>;
  showKind?: boolean;
  rateOverrides?: Record<string, number>;
  allowedResourceIds?: string[];
  locationId?: string;
  warehouseName?: string;
}) {
  const { data } = useResources();
  const resources: Array<{ id: string; name: string; unit: string; rate?: number | string | null; gstRate?: number | string | null }> =
    Array.isArray(data) ? data : (data?.data ?? []);
  const balances = useProjectStockBalances(locationId);
  const filteredResources = allowedResourceIds && allowedResourceIds.length > 0
    ? resources.filter((r) => allowedResourceIds.includes(r.id))
    : resources;
  const options = filteredResources.map((r) => {
    const bal = balances.get(r.id) ?? 0;
    return {
      title: `${r.name} · on hand ${bal} ${r.unit || ''}`,
      value: r.id,
    };
  });
  const patch = (key: string, field: keyof DraftLine, value: string) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  return (
    <View className="gap-2 mt-2">
      {lines.map((l, idx) => {
        const resource = resources.find((r) => r.id === l.resourceId);
        const onHand = l.resourceId ? (balances.get(l.resourceId) ?? 0) : 0;
        const requestedQty = Number(l.quantity) || 0;
        const isShortage = l.resourceId && requestedQty > onHand;

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

            {l.resourceId ? (
              <View className="flex-row items-center justify-between mt-1 px-0.5">
                <Text className="text-[11px] text-muted">
                  {warehouseName ? `${warehouseName} on-hand:` : 'Store on-hand:'} <Text className="font-semibold text-text">{onHand} {l.unit}</Text>
                </Text>
                {isShortage ? (
                  <Text className="text-[11px] font-semibold text-warning">
                    ⚠️ Qty exceeds stock on hand ({onHand})
                  </Text>
                ) : null}
              </View>
            ) : null}

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
    locationId?: string;
    notes?: string;
    lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: customers } = useCustomers();
  const { data: warehouses } = useWarehouses();
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
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
      if (warehouses && warehouses.length > 0) {
        const def = warehouses.find((w: Warehouse) => w.isDefault) ?? warehouses[0];
        if (def) setLocationId(def.id);
      }
    }
  }, [open, warehouses]);

  const customerOptions = (customers ?? []).map((c: { id: string; name: string }) => ({ title: c.name, value: c.id }));
  const selectedWarehouse = (warehouses ?? []).find((w: Warehouse) => w.id === locationId);

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
      const warehouseNote = selectedWarehouse ? `[Fulfillment Store: ${selectedWarehouse.name}]` : '';
      const finalNotes = [warehouseNote, notes.trim()].filter(Boolean).join(' ');

      await onSubmit({
        ...(customerId ? { customerId } : {}),
        customerName: name,
        orderDate,
        ...(locationId ? { locationId } : {}),
        ...(finalNotes ? { notes: finalNotes } : {}),
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
    <Sheet visible={open} title="New sales order" subtitle="Draft → confirm → challan → invoice. Items are dispatched from selected warehouse." saving={saving} onClose={onClose} fullScreen>
      <Select
        label="Dispatch From Warehouse / Store"
        value={locationId || undefined}
        options={(warehouses ?? []).map((w: Warehouse) => ({
          title: `${w.name}${w.isDefault ? ' (Default Store)' : ''}${w.code ? ` · ${w.code}` : ''}`,
          value: w.id,
        }))}
        onChange={(v) => v && setLocationId(v)}
        placeholder="Select Warehouse / Store"
      />
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
      <LineEditor
        lines={lines}
        setLines={setLines}
        rateOverrides={effectiveRates}
        locationId={locationId}
        warehouseName={selectedWarehouse?.name}
      />
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
    locationId?: string;
    notes?: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.6): subset lines + per-line batch.
    lines?: Array<{ salesOrderLineId: string; quantity: number; batchCode?: string }>;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: orders } = useSalesOrders();
  const { data: warehouses } = useWarehouses();
  const [salesOrderId, setSalesOrderId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line qty + batch.
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [batchByLine, setBatchByLine] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const balances = useProjectStockBalances(locationId);

  useEffect(() => {
    if (open) {
      setSalesOrderId('');
      setNotes('');
      setQtyByLine({});
      setBatchByLine({});
      setError('');
      if (warehouses && warehouses.length > 0) {
        const def = warehouses.find((w: Warehouse) => w.isDefault) ?? warehouses[0];
        if (def) setLocationId(def.id);
      }
    }
  }, [open, warehouses]);

  const eligible = useMemo(
    () =>
      (orders ?? []).filter((o: { id: string; status: string; soNumber: string; customerName: string; lines: Array<{ quantity: string; deliveredQty: string }> }) => {
        if (o.status !== 'CONFIRMED') return false;
        return o.lines.some((l) => Number(l.quantity) - Number(l.deliveredQty) > 0);
      }),
    [orders],
  );

  const selectedOrder = eligible.find((o: { id: string }) => o.id === salesOrderId);
  const selectedWarehouse = (warehouses ?? []).find((w: Warehouse) => w.id === locationId);

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
      const warehouseNote = selectedWarehouse ? `[Dispatched from: ${selectedWarehouse.name}]` : '';
      const finalNotes = [warehouseNote, notes.trim()].filter(Boolean).join(' ');

      await onSubmit({
        salesOrderId,
        ...(locationId ? { locationId } : {}),
        ...(finalNotes ? { notes: finalNotes } : {}),
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
      subtitle="Pick undelivered lines to ship from the selected warehouse. Dispatch moves stock OUT."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Dispatch From Warehouse / Store"
        value={locationId || undefined}
        options={(warehouses ?? []).map((w: Warehouse) => ({
          title: `${w.name}${w.isDefault ? ' (Default Store)' : ''}${w.code ? ` · ${w.code}` : ''}`,
          value: w.id,
        }))}
        onChange={(v) => v && setLocationId(v)}
        placeholder="Select Warehouse"
      />
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
            resourceId?: string;
            itemName: string;
            unit: string;
            quantity: string;
            deliveredQty: string;
          }>)
            .filter((l) => remainingFor(l) > 0)
            .map((l) => {
              const rem = remainingFor(l);
              const onHandInWh = l.resourceId ? (balances.get(l.resourceId) ?? 0) : 0;
              const requested = qtyByLine[l.id] !== undefined ? Number(qtyByLine[l.id]) : rem;
              const isInsufficient = l.resourceId && requested > onHandInWh;

              return (
                <View key={l.id} className="mb-2 pb-2 border-b border-border/40">
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-text" numberOfLines={1}>
                        {l.itemName}
                      </Text>
                      <Text className="text-[11px] text-muted">
                        Remaining: {rem} {l.unit} {l.resourceId ? `· ${selectedWarehouse?.name || 'Store'} on-hand: ${onHandInWh} ${l.unit}` : ''}
                      </Text>
                    </View>
                    <View className="w-24">
                      <Input
                        label=""
                        placeholder={String(rem)}
                        value={qtyByLine[l.id] ?? ''}
                        onChangeText={(v) => setQtyByLine((prev) => ({ ...prev, [l.id]: v }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  {isInsufficient ? (
                    <Text className="text-[11px] font-semibold text-warning mt-0.5">
                      ⚠️ Requested {requested} exceeds on-hand ({onHandInWh}) in {selectedWarehouse?.name || 'warehouse'}
                    </Text>
                  ) : null}
                  {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3/9.6): per-line batch. */}
                  <View className="mt-1">
                    <Input
                      label="Batch / lot code (optional)"
                      value={batchByLine[l.id] ?? ''}
                      onChangeText={(v) => setBatchByLine((prev) => ({ ...prev, [l.id]: v }))}
                      autoCapitalize="characters"
                      placeholder="e.g. LOT-2026-A - copied to the OUT movement on dispatch"
                    />
                  </View>
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
  const { data: warehouses } = useWarehouses();
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
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
      if (warehouses && warehouses.length > 0) {
        const def = warehouses.find((w: Warehouse) => w.isDefault) ?? warehouses[0];
        if (def) setLocationId(def.id);
      }
    }
  }, [open, warehouses]);

  const customerOptions = (customers ?? []).map((c: { id: string; name: string }) => ({ title: c.name, value: c.id }));
  const selectedWarehouse = (warehouses ?? []).find((w: Warehouse) => w.id === locationId);

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
    <Sheet visible={open} title="New Event / Client Quote" subtitle="Draft → Send → Accept → Convert to Sales Order. Item rates and event requirements are itemized below." saving={saving} onClose={onClose} fullScreen>
      <Select
        label="Check Stock Availability from Warehouse / Store"
        value={locationId || undefined}
        options={(warehouses ?? []).map((w: Warehouse) => ({
          title: `${w.name}${w.isDefault ? ' (Default Store)' : ''}${w.code ? ` · ${w.code}` : ''}`,
          value: w.id,
        }))}
        onChange={(v) => v && setLocationId(v)}
        placeholder="Select Warehouse"
      />
      <Select
        label="Customer / Client"
        value={customerId || undefined}
        options={customerOptions}
        onChange={(v) => {
          setCustomerId(v ?? '');
          const c = (customers ?? []).find((x: { id: string; name: string }) => x.id === v);
          if (c) setCustomerName(c.name);
        }}
        placeholder="Pick from master customers"
      />
      <Input label="Customer / Client name (if not in master)" value={customerName} onChangeText={setCustomerName} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input label="Quote date" value={quoteDate} onChangeText={setQuoteDate} />
        </View>
        <View className="flex-1">
          <Input label="Valid until" value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD" />
        </View>
      </View>
      <Input label="Event / Occasion / Reference (e.g. Wedding Stage Lighting Setup)" value={notes} onChangeText={setNotes} multiline />
      <LineEditor
        lines={lines}
        setLines={setLines}
        rateOverrides={effectiveRates}
        locationId={locationId}
        warehouseName={selectedWarehouse?.name}
      />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Create event quote'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
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
      if (warehouses && warehouses.length > 0) {
        const def = warehouses.find((w: Warehouse) => w.isDefault) ?? warehouses[0];
        if (def) setLocationId(def.id);
      } else {
        setLocationId('');
      }
      setError('');
      setSaving(false);
    }
  }, [open, warehouses]);

  if (!open) return null;

  return (
    <Sheet
      visible={open}
      title={`Dispatch ${dcNumber ?? 'challan'}`}
      subtitle="Stock moves OUT from the selected warehouse for all challan lines."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Dispatch from Warehouse / Store"
        value={locationId || undefined}
        onChange={(v) => setLocationId(v ?? '')}
        options={(warehouses ?? []).map((w: Warehouse) => ({
          title: `${w.name}${w.isDefault ? ' (Default Store)' : ''}${w.code ? ` · ${w.code}` : ''}`,
          value: w.id,
        }))}
        placeholder="Select Warehouse"
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

/* ── Delivery Challan Pre-Invoice Return (On-Site / Buffer Return) ── */

export function ChallanReturnModal({
  open,
  challan,
  onClose,
  onSubmit,
}: {
  open: boolean;
  challan: DeliveryChallan | null;
  onClose: () => void;
  onSubmit: (input: {
    lines: Array<{ resourceId: string; quantity: number; reason?: string; returnKind?: 'GOOD' | 'DAMAGED' }>;
    locationId?: string;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: warehouses } = useWarehouses();
  const { data: resourceData } = useResources();
  const resources: Array<{ id: string; name: string; unit: string; barcode?: string | null; sku?: string | null }> =
    Array.isArray(resourceData) ? resourceData : (resourceData?.data ?? []);

  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('Unconsumed site buffer return');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState('');

  useEffect(() => {
    if (open && challan) {
      setLocationId('');
      setReason('Unconsumed site buffer return');
      setLines(
        challan.lines.map((l: { resourceId: string; rate?: string | number; unit?: string }) => ({
          key: newKey(),
          resourceId: l.resourceId,
          quantity: '',
          rate: String(l.rate ?? 0),
          gstRate: '18',
          unit: l.unit || 'no',
          returnKind: 'GOOD',
        })),
      );
      setError('');
      setScanBuffer('');
      setScanToast('');
    }
  }, [open, challan]);

  const handleBarcodeScan = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed || !challan) return;
    setError('');
    setScanToast('');

    const catalogMatch = resources.find(
      (r) =>
        r.barcode?.toLowerCase() === trimmed ||
        r.sku?.toLowerCase() === trimmed ||
        r.name.toLowerCase().includes(trimmed),
    );

    if (!catalogMatch) {
      setError(`No item found matching "${code.trim()}".`);
      return;
    }

    const dcLine = challan.lines.find((l: { resourceId: string }) => l.resourceId === catalogMatch.id);
    if (!dcLine) {
      setError(
        `Item "${catalogMatch.name}" was not dispatched on Delivery Challan ${challan.dcNumber}. Only items on this challan can be returned.`,
      );
      return;
    }

    const maxDispatched = Number(dcLine.quantity);

    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.resourceId === catalogMatch.id);
      if (existingIdx >= 0) {
        const current = prev[existingIdx];
        const currQty = Number(current.quantity) || 0;
        const nextQty = Math.min(currQty + 1, maxDispatched);
        if (nextQty === currQty && currQty >= maxDispatched) {
          setError(`Max return limit (${maxDispatched} ${dcLine.unit}) reached for "${catalogMatch.name}".`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = { ...current, quantity: String(nextQty) };
        return updated;
      }
      return [
        ...prev,
        {
          key: newKey(),
          resourceId: catalogMatch.id,
          quantity: '1',
          unit: dcLine.unit || 'no',
          rate: String(dcLine.rate ?? 0),
          gstRate: '18',
          returnKind: 'GOOD',
        },
      ];
    });

    setScanToast(`Scanned: ${catalogMatch.name}`);
    setScanBuffer('');
  };

  const submit = async () => {
    setError('');
    if (!challan) return;
    const returnItems = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (returnItems.length === 0) {
      setError('Enter return quantities for at least one item.');
      return;
    }

    // Validate quantities against dispatched lines
    for (const item of returnItems) {
      const dcLine = challan.lines.find((l: { resourceId: string }) => l.resourceId === item.resourceId);
      if (!dcLine) {
        setError(`Item is not on challan ${challan.dcNumber}.`);
        return;
      }
      if (Number(item.quantity) > Number(dcLine.quantity)) {
        setError(`Cannot return ${item.quantity} ${item.unit} of "${dcLine.itemName}"; only ${dcLine.quantity} was dispatched.`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        locationId: locationId || undefined,
        lines: returnItems.map((l) => ({
          resourceId: l.resourceId,
          quantity: Number(l.quantity),
          reason: reason.trim() || undefined,
          returnKind: l.returnKind,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record return');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !challan) return null;

  return (
    <Sheet
      visible={open}
      title={`Return on Challan ${challan.dcNumber}`}
      subtitle={`Customer: ${challan.customerName}. Good items immediately restock to warehouse (Stock IN). Final invoice will bill the net accepted quantity.`}
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      {/* Scanner Bar */}
      <View className="bg-primary/5 rounded-xl border border-primary/20 p-3 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="barcode-outline" size={18} color="#0284c7" />
            <Text className="text-xs font-bold text-primary uppercase tracking-wide">Scan Returned Item</Text>
          </View>
          <Pressable
            onPress={() => setScannerOpen(true)}
            className="flex-row items-center gap-1 bg-primary px-2.5 py-1 rounded-md active:opacity-80"
          >
            <Ionicons name="camera-outline" size={14} color="#ffffff" />
            <Text className="text-xs font-semibold text-white">Camera Scan</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextInput
              value={scanBuffer}
              onChangeText={setScanBuffer}
              onSubmitEditing={() => handleBarcodeScan(scanBuffer)}
              placeholder="Scan barcode / SKU on challan..."
              placeholderTextColor="#94a3b8"
              className="bg-card text-text border border-border rounded-lg px-3 py-2 text-sm"
              returnKeyType="search"
            />
          </View>
          <Button
            label="Lookup"
            size="sm"
            variant="secondary"
            onPress={() => handleBarcodeScan(scanBuffer)}
            disabled={!scanBuffer.trim()}
          />
        </View>
        {scanToast ? (
          <View className="flex-row items-center gap-1.5 mt-2 bg-success/10 border border-success/20 px-2.5 py-1.5 rounded-md">
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text className="text-xs text-success font-medium flex-1">{scanToast}</Text>
          </View>
        ) : null}
      </View>

      <Select
        label="Restock into warehouse (optional)"
        value={locationId || undefined}
        onChange={(v) => setLocationId(v ?? '')}
        options={(warehouses ?? []).map((w: Warehouse) => ({ title: w.name, value: w.id }))}
        placeholder="Company default warehouse"
      />

      <Input label="Return Reason" value={reason} onChangeText={setReason} placeholder="e.g. Unconsumed site buffer, rejected finish" />

      <Text className="text-xs font-bold text-muted uppercase mt-3 mb-1">Items Dispatched on Challan</Text>
      <View className="gap-2">
        {challan.lines.map((dcL: { id: string; resourceId: string; itemName: string; unit: string; quantity: string | number }) => {
          const lineState = lines.find((l) => l.resourceId === dcL.resourceId);
          const returnQty = lineState?.quantity ?? '';
          const returnKind = lineState?.returnKind ?? 'GOOD';

          return (
            <View key={dcL.id} className="bg-surface rounded-xl border border-border p-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-semibold text-text flex-1">{dcL.itemName}</Text>
                <Text className="text-xs text-muted">Dispatched: {dcL.quantity} {dcL.unit}</Text>
              </View>
              <View className="flex-row items-center gap-2 mt-2">
                <View className="flex-1">
                  <Input
                    label={`Return Qty (${dcL.unit})`}
                    value={returnQty}
                    onChangeText={(val) => {
                      setLines((prev) =>
                        prev.map((l) => (l.resourceId === dcL.resourceId ? { ...l, quantity: val } : l)),
                      );
                    }}
                    placeholder={`Max ${dcL.quantity}`}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-row gap-1 pt-4">
                  {(['GOOD', 'DAMAGED'] as const).map((k) => {
                    const active = returnKind === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => {
                          setLines((prev) =>
                            prev.map((l) => (l.resourceId === dcL.resourceId ? { ...l, returnKind: k } : l)),
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                      >
                        <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-muted'}`}>
                          {k === 'GOOD' ? 'Restock' : 'Damaged'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1.5 mt-3 p-2 bg-danger/10 border border-danger/20 rounded-lg">
          <Ionicons name="alert-circle" size={16} color="#dc2626" />
          <Text className="text-xs text-danger font-medium flex-1">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Restocking…' : 'Restock Returned Items (Stock IN)'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>

      {scannerOpen ? (
        <BarcodeScannerOverlay
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={(code) => {
            setScannerOpen(false);
            handleBarcodeScan(code);
          }}
        />
      ) : null}
    </Sheet>
  );
}

/* ── Sales return (from a sent/paid invoice or quick scan) ────────── */
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
  const { data: resourceData } = useResources();
  const resources: Array<{ id: string; name: string; unit: string; barcode?: string | null; sku?: string | null }> =
    Array.isArray(resourceData) ? resourceData : (resourceData?.data ?? []);

  const [invoiceId, setInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState('');

  const validateScan = useValidateReturnScan();

  useEffect(() => {
    if (open) {
      setInvoiceId('');
      setReturnDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
      setScanBuffer('');
      setScanToast('');
    }
  }, [open]);

  const invoiceOptions = useMemo(
    () =>
      (invoices ?? []).filter((i: { id: string; status: string; invoiceNumber: string; clientName: string }) =>
        ['SENT', 'PAID', 'OVERDUE'].includes(i.status),
      ).map((i: { id: string; invoiceNumber: string; clientName: string }) => ({ title: `${i.invoiceNumber} · ${i.clientName}`, value: i.id })),
    [invoices],
  );
  const selectedInvoice = (invoices ?? []).find((i: { id: string; status: string; invoiceNumber: string; clientName: string; lineItems?: Array<{ description: string; quantity: number; resourceId?: string }> }) => i.id === invoiceId);

  const invoiceResourceIds = useMemo(() => {
    if (!selectedInvoice?.lineItems) return undefined;
    return selectedInvoice.lineItems
      .map((l: { resourceId?: string }) => l.resourceId)
      .filter((id: string | undefined): id is string => !!id);
  }, [selectedInvoice]);

  // Handle barcode / fast scan
  const handleBarcodeScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setScanToast('');

    try {
      const result = await validateScan.mutateAsync({
        barcode: trimmed,
        invoiceId: invoiceId || undefined,
      });

      if (!result.isValidDispatch || result.matchingLines.length === 0) {
        setError(`"${result.resource.name}" was not found in dispatches.`);
        return;
      }

      // If an invoice was already chosen, strictly ensure item was on that invoice
      if (invoiceId && selectedInvoice?.lineItems) {
        const isLineInInvoice = selectedInvoice.lineItems.some(
          (l: { resourceId?: string; description: string }) =>
            (l.resourceId && l.resourceId === result.resource.id) ||
            (l.description && l.description.toLowerCase() === result.resource.name.toLowerCase()),
        );
        if (!isLineInInvoice) {
          setError(
            `Item "${result.resource.name}" was not found in Invoice ${selectedInvoice.invoiceNumber}. Only items on this bill can be returned.`,
          );
          return;
        }
      }

      // Auto-lock invoice if not chosen yet
      if (!invoiceId && result.matchingLines.length > 0) {
        setInvoiceId(result.matchingLines[0].invoiceId);
      }

      const match = result.matchingLines[0];
      setLines((prev) => {
        const clean = prev.filter((l) => l.resourceId);
        const existingIdx = clean.findIndex((l) => l.resourceId === result.resource.id);
        if (existingIdx >= 0) {
          const current = clean[existingIdx];
          const currQty = Number(current.quantity) || 0;
          const nextQty = Math.min(currQty + 1, result.maxReturnable);
          if (nextQty === currQty && currQty >= result.maxReturnable) {
            setError(`Max returnable limit (${result.maxReturnable} ${result.resource.unit}) reached for "${result.resource.name}".`);
            return clean;
          }
          const updated = [...clean];
          updated[existingIdx] = { ...current, quantity: String(nextQty) };
          return updated;
        }

        const initQty = Math.min(1, result.maxReturnable);
        return [
          ...clean,
          {
            key: newKey(),
            resourceId: result.resource.id,
            quantity: String(initQty),
            unit: result.resource.unit || 'no',
            rate: String(match.rate),
            gstRate: String(match.gstRate ?? 18),
            returnKind: 'GOOD',
          },
        ];
      });

      setScanToast(`Scanned: ${result.resource.name} (${match.invoiceNumber})`);
      setScanBuffer('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Item verification failed');
    }
  };

  // Hardware scanner key listener on Web
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    let buffer = '';
    let lastKeyTime = Date.now();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = '';
      lastKeyTime = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          void handleBarcodeScan(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, invoiceId]);

  const submit = async () => {
    setError('');
    if (!invoiceId) {
      setError('Pick an invoice or scan an item to link the return.');
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
      subtitle="Restock good items or scrap damaged goods. Creates an automated draft credit note."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      {/* Fast POS Barcode Scanner Section */}
      <View className="bg-primary/5 rounded-xl border border-primary/20 p-3 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="barcode-outline" size={18} color="#0284c7" />
            <Text className="text-xs font-bold text-primary uppercase tracking-wide">POS Scan & Match</Text>
          </View>
          <Pressable
            onPress={() => setScannerOpen(true)}
            className="flex-row items-center gap-1 bg-primary px-2.5 py-1 rounded-md active:opacity-80"
          >
            <Ionicons name="camera-outline" size={14} color="#ffffff" />
            <Text className="text-xs font-semibold text-white">Camera Scan</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextInput
              value={scanBuffer}
              onChangeText={setScanBuffer}
              onSubmitEditing={() => handleBarcodeScan(scanBuffer)}
              placeholder="Scan barcode / enter SKU..."
              placeholderTextColor="#94a3b8"
              className="bg-card text-text border border-border rounded-lg px-3 py-2 text-sm"
              returnKeyType="search"
            />
          </View>
          <Button
            label="Lookup"
            size="sm"
            variant="secondary"
            onPress={() => handleBarcodeScan(scanBuffer)}
            disabled={!scanBuffer.trim()}
          />
        </View>
        {scanToast ? (
          <View className="flex-row items-center gap-1.5 mt-2 bg-success/10 border border-success/20 px-2.5 py-1.5 rounded-md">
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text className="text-xs text-success font-medium flex-1">{scanToast}</Text>
          </View>
        ) : null}
      </View>

      <Select
        label="Target Tax Invoice"
        value={invoiceId || undefined}
        options={invoiceOptions}
        onChange={(v) => setInvoiceId(v ?? '')}
        placeholder="Select sent / paid invoice"
      />
      {selectedInvoice && selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? (
        <Text className="text-xs text-muted mt-1 mb-2">
          Invoice lines: {selectedInvoice.lineItems.map((l: { description: string; quantity: number }) => `${l.description} × ${l.quantity}`).join(', ')}
        </Text>
      ) : null}

      <View className="flex-row gap-2 mt-1">
        <View className="flex-1">
          <Input label="Return date" value={returnDate} onChangeText={setReturnDate} />
        </View>
        <View className="flex-1">
          <Input label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. excess return, defective" />
        </View>
      </View>

      <LineEditor lines={lines} setLines={setLines} showKind allowedResourceIds={invoiceResourceIds} />

      {error ? (
        <View className="flex-row items-center gap-1.5 mt-3 p-2 bg-danger/10 border border-danger/20 rounded-lg">
          <Ionicons name="alert-circle" size={16} color="#dc2626" />
          <Text className="text-xs text-danger font-medium flex-1">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Record return & credit note'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>

      {scannerOpen ? (
        <BarcodeScannerOverlay
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={(code) => {
            setScannerOpen(false);
            void handleBarcodeScan(code);
          }}
        />
      ) : null}
    </Sheet>
  );
}

/* ── Purchase return (from a bill or fast SKU match) ─────────────── */

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
  const { data: resourceData } = useResources();
  const resources: Array<{ id: string; name: string; unit: string; barcode?: string | null; sku?: string | null; rate?: number | string | null; gstRate?: number | string | null }> =
    Array.isArray(resourceData) ? resourceData : (resourceData?.data ?? []);

  const [billId, setBillId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState('');

  useEffect(() => {
    if (open) {
      setBillId('');
      setReturnDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setLines([{ key: newKey(), resourceId: '', quantity: '', rate: '', gstRate: '18', unit: '', returnKind: 'GOOD' }]);
      setError('');
      setScanBuffer('');
      setScanToast('');
    }
  }, [open]);

  const billOptions = useMemo(
    () =>
      (bills ?? []).filter((b: { id: string; status: string; billNumber: string; vendorName: string }) =>
        ['APPROVED', 'PAID'].includes(b.status),
      ).map((b: { id: string; billNumber: string; vendorName: string }) => ({ title: `${b.billNumber} · ${b.vendorName}`, value: b.id })),
    [bills],
  );

  const handleBarcodeScan = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    setError('');
    setScanToast('');

    const match = resources.find(
      (r) =>
        r.barcode?.toLowerCase() === trimmed ||
        r.sku?.toLowerCase() === trimmed ||
        r.name.toLowerCase().includes(trimmed),
    );

    if (!match) {
      setError(`No catalog item found matching "${code.trim()}".`);
      return;
    }

    setLines((prev) => {
      const clean = prev.filter((l) => l.resourceId);
      const existingIdx = clean.findIndex((l) => l.resourceId === match.id);
      if (existingIdx >= 0) {
        const current = clean[existingIdx];
        const nextQty = (Number(current.quantity) || 0) + 1;
        const updated = [...clean];
        updated[existingIdx] = { ...current, quantity: String(nextQty) };
        return updated;
      }

      return [
        ...clean,
        {
          key: newKey(),
          resourceId: match.id,
          quantity: '1',
          unit: match.unit || 'no',
          rate: match.rate != null ? String(match.rate) : '',
          gstRate: match.gstRate != null ? String(match.gstRate) : '18',
          returnKind: 'GOOD',
        },
      ];
    });

    setScanToast(`Scanned: ${match.name}`);
    setScanBuffer('');
  };

  const submit = async () => {
    setError('');
    if (!billId) {
      setError('Pick a vendor bill to return goods against.');
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
      subtitle="Return stock to the vendor (Stock OUT). An automated draft debit note is created."
      fullScreen
      saving={saving}
      onClose={onClose}
    >
      {/* Fast Barcode / SKU Scanner Section */}
      <View className="bg-primary/5 rounded-xl border border-primary/20 p-3 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="barcode-outline" size={18} color="#0284c7" />
            <Text className="text-xs font-bold text-primary uppercase tracking-wide">Barcode / SKU Scanner</Text>
          </View>
          <Pressable
            onPress={() => setScannerOpen(true)}
            className="flex-row items-center gap-1 bg-primary px-2.5 py-1 rounded-md active:opacity-80"
          >
            <Ionicons name="camera-outline" size={14} color="#ffffff" />
            <Text className="text-xs font-semibold text-white">Camera Scan</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextInput
              value={scanBuffer}
              onChangeText={setScanBuffer}
              onSubmitEditing={() => handleBarcodeScan(scanBuffer)}
              placeholder="Scan barcode / enter SKU / product name..."
              placeholderTextColor="#94a3b8"
              className="bg-card text-text border border-border rounded-lg px-3 py-2 text-sm"
              returnKeyType="search"
            />
          </View>
          <Button
            label="Lookup"
            size="sm"
            variant="secondary"
            onPress={() => handleBarcodeScan(scanBuffer)}
            disabled={!scanBuffer.trim()}
          />
        </View>
        {scanToast ? (
          <View className="flex-row items-center gap-1.5 mt-2 bg-success/10 border border-success/20 px-2.5 py-1.5 rounded-md">
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text className="text-xs text-success font-medium flex-1">{scanToast}</Text>
          </View>
        ) : null}
      </View>

      <Select
        label="Vendor Bill"
        value={billId || undefined}
        options={billOptions}
        onChange={(v) => setBillId(v ?? '')}
        placeholder="Select approved / paid vendor bill"
      />
      <View className="flex-row gap-2 mt-1">
        <View className="flex-1">
          <Input label="Return date" value={returnDate} onChangeText={setReturnDate} />
        </View>
        <View className="flex-1">
          <Input label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. transit damage, rejected spec" />
        </View>
      </View>

      <LineEditor lines={lines} setLines={setLines} />

      {error ? (
        <View className="flex-row items-center gap-1.5 mt-3 p-2 bg-danger/10 border border-danger/20 rounded-lg">
          <Ionicons name="alert-circle" size={16} color="#dc2626" />
          <Text className="text-xs text-danger font-medium flex-1">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
        <Button label={saving ? 'Saving…' : 'Record return & debit note'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
      </View>

      {scannerOpen ? (
        <BarcodeScannerOverlay
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={(code) => {
            setScannerOpen(false);
            handleBarcodeScan(code);
          }}
        />
      ) : null}
    </Sheet>
  );
}

