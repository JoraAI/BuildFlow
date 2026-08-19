/**
 * BuildFlow - POS-style counter checkout cart
 * (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.3, K7–K8).
 *
 * Evolves the walk-in multi-item stock issue into a cart surface on the SAME
 * `issueStockManual` API:
 *   - Desktop/tablet: searchable catalog list LEFT + persistent cart RIGHT
 *     (qty, price, GST, line/subtotal/tax/grand total, low-stock warnings).
 *   - Phone: search/scan-first + compact cart cards + STICKY checkout footer.
 *   - Barcode while checkout is open adds / increments the cart line (reused
 *     BarcodeScannerOverlay + direct barcode lookup). The Stock-home "Find"
 *     input keeps navigating only when the checkout is CLOSED.
 *   - FEFO: the server allocates lots (11.2); this UI only warns (low stock,
 *     over-quantity, batch note) and surfaces the allocations returned in the
 *     issue response. It NEVER chooses lot quantities.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, TextInput } from 'react-native';
import { Button, Input, Select, Badge, toast } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { BarcodeScannerOverlay } from '@/components/inventory/BarcodeScannerOverlay';
import { useCustomers } from '@/services/party.queries';
import { apiFetch } from '@/lib/api-client';
import type { BarcodeItem } from '@/services/warehouse.queries';
import type { StockSummaryRow } from '@/services/expansion.queries';

type CartLine = { key: string; resourceId: string; quantity: string; unitPrice: string };

// INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7.6): compact numeric cell for
// table rows - no labeled Input (tall rows) inside a table.
function CellInput({
  value,
  onChangeText,
  keyboardType = 'decimal-pad',
  accessibilityLabel,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'decimal-pad' | 'numeric';
  accessibilityLabel?: string;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      accessibilityLabel={accessibilityLabel}
      placeholder={placeholder ?? '0'}
      placeholderTextColor="#94A3B8"
      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text text-center"
    />
  );
}

export interface CheckoutSubmitInput {
  lines: Array<{ resourceId: string; quantity: number; unitPrice?: number }>;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  allowExpired?: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function CheckoutCart({
  open,
  submitting,
  rows,
  itemLabel,
  initialResourceId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  rows: StockSummaryRow[];
  itemLabel: string;
  /** Set when the cart is opened from a stock row, so it starts with that item. */
  initialResourceId?: string | null;
  onClose: () => void;
  onSubmit: (input: CheckoutSubmitInput) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const { data: customers } = useCustomers();
  const rowFor = (resourceId: string) => rows.find((r) => r.resourceId === resourceId);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7.6): customer block stays
  // collapsed behind "Add customer" until the shopkeeper needs it.
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [allowExpired, setAllowExpired] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const seed = initialResourceId ? rows.find((r) => r.resourceId === initialResourceId) : undefined;
    setLines(
      seed && Number(seed.balance) > 0
        ? [
            {
              key: `cart-${Date.now()}-seed`,
              resourceId: seed.resourceId,
              quantity: '1',
              unitPrice:
                seed.catalogRate != null && Number(seed.catalogRate) > 0 ? String(seed.catalogRate) : '',
            },
          ]
        : [],
    );
    setSearch('');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
    setAllowExpired(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialResourceId]);

  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.1): explicit Esc close on web
  // (backdrop dismiss stays disabled while submitting).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || submitting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  const issuable = useMemo(() => rows.filter((r) => Number(r.balance) > 0), [rows]);
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.4): do NOT truncate the
  // catalog at 60 rows — render all filtered issuable items (search still
  // filters by name). FlatList virtualization elsewhere covers very large
  // catalogs; a Kirana store is a few hundred rows at most.
  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issuable.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [issuable, search]);

  const addItem = (resourceId: string) => {
    const row = rowFor(resourceId);
    const balance = Number(row?.balance ?? 0);
    const existing = lines.find((l) => l.resourceId === resourceId);
    if (existing) {
      const next = (Number(existing.quantity) || 0) + 1;
      if (row && next > balance) {
        toast.error(`Only ${balance} ${row.unit} of ${row.name} in stock`);
        return;
      }
      setLines((prev) => prev.map((l) => (l.key === existing.key ? { ...l, quantity: String(next) } : l)));
      return;
    }
    if (row && balance <= 0) {
      toast.error(`${row.name} is out of stock`);
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        resourceId,
        quantity: '1',
        unitPrice: row?.catalogRate != null && Number(row.catalogRate) > 0 ? String(row.catalogRate) : '',
      },
    ]);
  };
  const updateLine = (key: string, patch: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  // Barcode add/increment while checkout is open (11.3.4). Direct call (no
  // query cache) so the same code can be scanned repeatedly.
  const onScannedCode = async (code: string) => {
    try {
      const item = await apiFetch<BarcodeItem>(`/inventory/items/by-barcode/${encodeURIComponent(code.trim())}`);
      const row = rowFor(item.id);
      if (!row) {
        toast.error(`${item.name} is not in stock at this store`);
        return;
      }
      addItem(item.id);
      toast.success(`${row.name} added to cart`);
    } catch {
      toast.error('No item found with this barcode');
    }
  };
  /**
   * Per-line problem shown next to the line as the cashier types, and re-checked
   * on submit. The server still enforces stock, so this is only fast feedback.
   */
  const lineIssue = (l: CartLine): string | null => {
    const row = rowFor(l.resourceId);
    if (!row) return 'This item is no longer in the stock list.';
    const qty = Number(l.quantity);
    if (l.quantity.trim() === '' || !Number.isFinite(qty) || qty <= 0) {
      return 'Enter a quantity greater than 0.';
    }
    const balance = Number(row.balance);
    if (qty > balance) return `Only ${balance} ${row.unit} in stock.`;
    if (l.unitPrice !== '') {
      const price = Number(l.unitPrice);
      if (!Number.isFinite(price) || price < 0) return 'Enter a valid selling price.';
      if (row.mrp != null && Number(row.mrp) > 0 && price > Number(row.mrp)) {
        return `Selling price cannot be above MRP ₹${Number(row.mrp).toFixed(2)}.`;
      }
    }
    return null;
  };
  const blockingIssues = lines.filter((l) => lineIssue(l) !== null).length;

  // GST math for the cart display (informational; the draft invoice is the
  // authoritative GST computation server-side).
  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    for (const l of lines) {
      const row = rowFor(l.resourceId);
      const qty = Number(l.quantity) || 0;
      const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
      const lineNet = (price ?? 0) * qty;
      subtotal += lineNet;
      const rate = Number(row?.gstRate ?? 0);
      gst += round2((lineNet * rate) / 100);
    }
    return { subtotal: round2(subtotal), gst: round2(gst), grandTotal: round2(subtotal + gst) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const submit = () => {
    setError(null);
    if (lines.length === 0) {
      setError('Add at least one item to the cart.');
      return;
    }
    const payload: Array<{ resourceId: string; quantity: number; unitPrice?: number }> = [];
    for (const l of lines) {
      const row = rowFor(l.resourceId);
      const problem = lineIssue(l);
      if (!row || problem) {
        setError(row ? `${row.name}: ${problem}` : 'A cart line is missing from the item list.');
        return;
      }
      const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
      payload.push({
        resourceId: row.resourceId,
        quantity: Number(l.quantity),
        ...(price !== undefined ? { unitPrice: price } : {}),
      });
    }
    void onSubmit({
      lines: payload,
      ...(customerId ? { customerId } : {}),
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      notes: notes.trim() || undefined,
      // 11.3.5 / 11.2: FEFO is server-side; this only permits expired lots when
      // no fresh stock remains (authorized override).
      allowExpired,
    });
  };
  const cart = (
    <View className="flex-1">
      {lines.length === 0 ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-muted">Cart is empty - tap items to add.</Text>
        </View>
      ) : (
        lines.map((l) => {
          const row = rowFor(l.resourceId);
          if (!row) return null;
          const qty = Number(l.quantity) || 0;
          const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
          const lineNet = (price ?? 0) * qty;
          const lowStock = Number(row.balance) <= Number(row.reorderPoint ?? 0) && Number(row.reorderPoint ?? 0) > 0;
          const issue = lineIssue(l);
          return (
            <View
              key={l.key}
              className={`rounded-xl border p-3 mb-2 ${issue ? 'border-danger' : 'border-border'}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-text font-semibold flex-1 mr-2" numberOfLines={1}>
                  {row.name}
                </Text>
                <Pressable disabled={submitting} onPress={() => removeLine(l.key)} className="px-2 py-1">
                  <Text className="text-xs font-semibold text-danger">Remove</Text>
                </Pressable>
              </View>
              {row.trackingMode === 'BATCH_EXPIRY' ? (
                <Text className="text-[10px] text-muted mb-1">Batches closest to expiry are sold first</Text>
              ) : null}
              {lowStock ? <Badge color="warning" label={`Low stock: ${row.balance} ${row.unit}`} /> : null}
              <View className="flex-row gap-2 mt-2">
                <View className="w-28">
                  <Input
                    label={`Qty (max ${row.balance})`}
                    value={l.quantity}
                    onChangeText={(t) => updateLine(l.key, { quantity: t })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label="Selling ₹ / unit"
                    value={l.unitPrice}
                    onChangeText={(t) => updateLine(l.key, { unitPrice: t })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text className="text-[11px] text-muted mt-1">
                Line ₹{round2(lineNet)} · {row.gstRate ?? 0}% GST · in stock {row.balance} {row.unit}
                {row.costPrice != null && Number(row.costPrice) > 0 ? ` · Cost ₹${Number(row.costPrice).toFixed(2)}` : ''}
                {row.mrp != null ? ` · MRP ₹${Number(row.mrp).toFixed(2)}` : ''}
              </Text>
              {issue ? <Text className="text-[11px] text-danger mt-1">{issue}</Text> : null}
            </View>
          );
        })
      )}
      <View className="rounded-xl border border-border p-3 bg-surface">
        <View className="flex-row justify-between py-0.5">
          <Text className="text-xs text-muted">Subtotal</Text>
          <Text className="text-xs text-text">₹{totals.subtotal.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between py-0.5">
          <Text className="text-xs text-muted">GST</Text>
          <Text className="text-xs text-text">₹{totals.gst.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between py-1 border-t border-border mt-1">
          <Text className="text-sm font-bold text-text">Grand total</Text>
          <Text className="text-sm font-bold text-primary">₹{totals.grandTotal.toFixed(2)}</Text>
        </View>
      </View>
      <Pressable className="flex-row items-center gap-2 mt-2" onPress={() => setAllowExpired((v) => !v)}>
        <View className={`w-5 h-5 rounded border items-center justify-center ${allowExpired ? 'bg-accent border-accent' : 'border-border'}`}>
          {allowExpired ? <Text className="text-white text-xs font-bold">✓</Text> : null}
        </View>
        <Text className="text-xs text-muted flex-1">Include expired lots (only if no fresh stock)</Text>
      </Pressable>
    </View>
  );

  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7.6): collapsed behind an
  // "Add customer" toggle - cash sales never see the extra fields.
  const customerBlock = (
    <>
      <Pressable
        className="flex-row items-center justify-between py-2.5"
        onPress={() => setCustomerOpen((v) => !v)}
        accessibilityRole="button"
      >
        <Text className="text-sm font-semibold text-text">
          {customerOpen ? 'Customer' : 'Add customer (optional)'}
        </Text>
        <Text className="text-lg text-muted">{customerOpen ? '−' : '+'}</Text>
      </Pressable>
      {customerOpen ? (
        <>
          <Select
            label="Customer (optional - cash sale if blank)"
            value={customerId || undefined}
            options={(customers ?? []).map((c: { id: string; name: string }) => ({ title: c.name, value: c.id }))}
            onChange={(v) => {
              setCustomerId(v ?? '');
              const c = (customers ?? []).find(
                (x: { id: string; name: string; phone?: string | null; billingAddress?: string | null }) => x.id === v,
              );
              if (c) {
                if (!customerName) setCustomerName(c.name);
                if (!customerPhone && c.phone) setCustomerPhone(c.phone);
                if (!customerAddress && c.billingAddress) setCustomerAddress(c.billingAddress);
              }
            }}
            placeholder="Cash sale (no customer)"
          />
          <Input label="Customer name" value={customerName} onChangeText={setCustomerName} placeholder="Walk-in customer" />
          <Input label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="+91 …" />
          <Input label="Address" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Billing address" />
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="e.g. counter sale" />
        </>
      ) : null}
    </>
  );

  const checkoutButton = (
    <>
      {blockingIssues > 0 ? (
        <Text className="text-[11px] text-danger mb-2">
          {blockingIssues === 1 ? '1 item needs fixing' : `${blockingIssues} items need fixing`} before you can charge.
        </Text>
      ) : null}
      <Button
        label={submitting ? 'Completing sale…' : 'Charge & issue stock'}
        accessibilityLabel="Charge and issue stock"
        variant="accent"
        fullWidth
        loading={submitting}
        disabled={submitting || lines.length === 0 || blockingIssues > 0}
        onPress={submit}
      />
    </>
  );
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.1/11.6.2): viewport-filling
  // workspace — no max-w-4xl / h-[85%] / outer gutter on tablet+desktop; phone
  // near-fullscreen. Backdrop dismiss is disabled while submitting; × / Esc close.
  return (
    <Modal visible={open} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={submitting ? undefined : onClose}>
      <View className="flex-1 bg-black/40">
        <Pressable
          className="absolute inset-0"
          onPress={submitting ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Close checkout"
        />
        <View className={`flex-1 bg-card ${isPhone ? 'rounded-t-2xl mt-4' : ''}`}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Text className="text-lg font-bold text-text">Checkout</Text>
            <Pressable onPress={submitting ? undefined : onClose} className="p-2" accessibilityRole="button" accessibilityLabel="Close checkout">
              <Text className="text-muted text-2xl">×</Text>
            </Pressable>
          </View>

          {isPhone ? (
            <View className="flex-1 p-4">
              {/* 11.6.3: phone browse — catalog is ALWAYS visible; search filters. */}
              <View className="flex-row gap-2 mb-2">
                <View className="flex-1">
                  <Input label="" accessibilityLabel="Search items" value={search} onChangeText={setSearch} placeholder={`Search ${itemLabel}s…`} />
                </View>
                <View className="w-24">
                  <Button label="Scan" accessibilityLabel="Scan barcode to add to cart" variant="secondary" onPress={() => setScannerOpen(true)} disabled={submitting} />
                </View>
              </View>
              <View className="max-h-[38%] mb-2">
                <ScrollView keyboardShouldPersistTaps="handled">
                  {catalog.map((r) => (
                    <Pressable
                      key={r.resourceId}
                      onPress={() => addItem(r.resourceId)}
                      className="px-3 py-2 border-b border-border/60 flex-row justify-between"
                    >
                      <Text className="text-sm text-text flex-1 mr-2" numberOfLines={1}>{r.name}</Text>
                      <Text className="text-xs text-muted">{r.balance} {r.unit}</Text>
                    </Pressable>
                  ))}
                  {catalog.length === 0 ? (
                    <Text className="text-xs text-muted py-6 text-center">No matching items with stock.</Text>
                  ) : null}
                </ScrollView>
              </View>
              <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">{cart}</ScrollView>
              <View className="pt-2 pb-1">{customerBlock}</View>
              {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
              <View className="border-t border-border pt-3 mt-2">{checkoutButton}</View>
            </View>
          ) : (
            <View className="flex-1 flex-row">
              {/* 11.6.2: left on-hand catalog TABLE (sticky header, row add). */}
              <View className="flex-1 border-r border-border">
                <View className="px-4 py-3 border-b border-border flex-row gap-2 items-center">
                  <View className="flex-1">
                    <Input label="" accessibilityLabel="Search items" value={search} onChangeText={setSearch} placeholder={`Search ${itemLabel}s…`} />
                  </View>
                  <Button label="Scan" accessibilityLabel="Scan barcode to add to cart" variant="secondary" onPress={() => setScannerOpen(true)} disabled={submitting} />
                </View>
                <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
                  <Text className="flex-[2.2] text-[11px] font-bold text-muted uppercase">Item</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Unit</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">On hand</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">MRP</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Selling ₹</Text>
                  <Text className="flex-[1.2] text-[11px] font-bold text-muted uppercase text-right">Status</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Add</Text>
                </View>
                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                  {catalog.map((r) => (
                    <Pressable
                      key={r.resourceId}
                      onPress={() => addItem(r.resourceId)}
                      className="flex-row items-center px-4 py-2.5 bg-card border-b border-border/60"
                    >
                      <Text className="flex-[2.2] text-sm text-text" numberOfLines={1}>{r.name}</Text>
                      <Text className="flex-1 text-xs text-muted">{r.unit}</Text>
                      <Text className="flex-1 text-sm font-semibold text-primary text-right">{r.balance}</Text>
                      <Text className="flex-1 text-xs text-muted text-right">
                        {r.mrp != null && Number(r.mrp) > 0 ? `₹${Number(r.mrp).toFixed(2)}` : '—'}
                      </Text>
                      <Text className="flex-1 text-xs text-text text-right">
                        {r.catalogRate != null && Number(r.catalogRate) > 0 ? `₹${Number(r.catalogRate).toFixed(2)}` : '—'}
                      </Text>
                      <View className="flex-[1.2] items-end">
                        {Number(r.balance) <= Number(r.reorderPoint ?? 0) && Number(r.reorderPoint ?? 0) > 0 ? (
                          <Badge color="warning" label="Low" />
                        ) : r.trackingMode === 'BATCH_EXPIRY' ? (
                          <Badge color="neutral" label="FEFO" />
                        ) : null}
                      </View>
                      <View className="flex-1 items-end">
                        <Badge color="neutral" label="Add" />
                      </View>
                    </Pressable>
                  ))}
                  {catalog.length === 0 ? (
                    <Text className="text-xs text-muted py-8 text-center">No matching items with stock.</Text>
                  ) : null}
                </ScrollView>
              </View>
              {/* 11.6.2: right cart TABLE (Item · Qty · Selling ₹ · GST% · Line ₹ · Remove). */}
              <View className="flex-1">
                <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
                  <Text className="flex-[1.6] text-[11px] font-bold text-muted uppercase">Item</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Qty</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Selling ₹</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">GST%</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase text-right">Line ₹</Text>
                  <Text className="w-16 text-[11px] font-bold text-muted uppercase text-right">Remove</Text>
                </View>
                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                  {lines.length === 0 ? (
                    <Text className="text-sm text-muted py-10 text-center">Cart is empty — tap items to add.</Text>
                  ) : (
                    lines.map((l) => {
                      const row = rowFor(l.resourceId);
                      if (!row) return null;
                      const qty = Number(l.quantity) || 0;
                      const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
                      const lineNet = (price ?? 0) * qty;
                      const gstRate = Number(row.gstRate ?? 0);
                      return (
                        <View key={l.key} className="flex-row items-center px-4 py-2 bg-card border-b border-border/60">
                          <View className="flex-[1.6] min-w-0 mr-2">
                            <Text className="text-sm text-text" numberOfLines={1}>{row.name}</Text>
                            {/* 11.7.3: muted read-only cost hint (never edited here). */}
                            {row.costPrice != null && Number(row.costPrice) > 0 ? (
                              <Text className="text-[10px] text-muted">Cost ₹{Number(row.costPrice).toFixed(2)}</Text>
                            ) : null}
                          </View>
                          <View className="flex-1 pr-2">
                            <CellInput accessibilityLabel={`Quantity of ${row.name}`} value={l.quantity} onChangeText={(t) => updateLine(l.key, { quantity: t })} />
                          </View>
                          <View className="flex-1 pr-2">
                            <CellInput accessibilityLabel={`Selling price of ${row.name}`} value={l.unitPrice} onChangeText={(t) => updateLine(l.key, { unitPrice: t })} />
                          </View>
                          <Text className="flex-1 text-xs text-muted text-right">{gstRate}%</Text>
                          <Text className="flex-1 text-sm font-semibold text-text text-right">₹{round2(lineNet).toFixed(2)}</Text>
                          <View className="w-16 items-end">
                            <Pressable disabled={submitting} onPress={() => removeLine(l.key)} accessibilityRole="button" accessibilityLabel={`Remove ${row.name} from cart`} className="px-2 py-1">
                              <Text className="text-xs font-semibold text-danger">Remove</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
                <View className="border-t border-border px-4 py-3 bg-surface">
                  <View className="flex-row justify-between py-0.5">
                    <Text className="text-xs text-muted">Subtotal</Text>
                    <Text className="text-xs text-text">₹{totals.subtotal.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between py-0.5">
                    <Text className="text-xs text-muted">GST</Text>
                    <Text className="text-xs text-text">₹{totals.gst.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-t border-border mt-1">
                    <Text className="text-sm font-bold text-text">Grand total</Text>
                    <Text className="text-sm font-bold text-primary">₹{totals.grandTotal.toFixed(2)}</Text>
                  </View>
                  <View className="mt-2">{customerBlock}</View>
                  {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
                  {/* Sticky Charge footer */}
                  <View className="border-t border-border pt-3 mt-3">{checkoutButton}</View>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
      <BarcodeScannerOverlay
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setScannerOpen(false);
          void onScannedCode(code);
        }}
      />
    </Modal>
  );
}
