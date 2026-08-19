/**
 * BuildFlow - Stock adjust + opening-stock import modals
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 * Responsive: phone bottom sheet, desktop centered.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, TextInput } from 'react-native';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import type { StockSummaryRow } from '@/services/expansion.queries';
import type { AdjustStockInput, OpeningStockLine } from '@/services/expansion.queries';
import { useCustomers, type PartyRow } from '@/services/party.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';

// INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7.6): compact numeric/text cell
// for table rows - no labeled Input (tall rows) inside a table.
function CellInput({
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'none',
  accessibilityLabel,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'decimal-pad' | 'numeric' | 'default';
  autoCapitalize?: 'none' | 'characters';
  accessibilityLabel?: string;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      accessibilityLabel={accessibilityLabel}
      placeholder={placeholder ?? '0'}
      placeholderTextColor="#94A3B8"
      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text"
    />
  );
}

const ADJUST_REASONS = [
  { title: 'Damage', value: 'DAMAGE' },
  { title: 'Loss', value: 'LOSS' },
  { title: 'Theft', value: 'THEFT' },
  { title: 'Expiry', value: 'EXPIRY' },
  { title: 'Stocktake', value: 'STOCKTAKE' },
  { title: 'Found stock', value: 'FOUND_STOCK' },
  { title: 'Correction', value: 'CORRECTION' },
  { title: 'Other', value: 'OTHER' },
];

export function AdjustStockModal({
  row,
  open,
  onClose,
  onSubmit,
}: {
  row: StockSummaryRow | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AdjustStockInput) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('CORRECTION');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDirection('add');
      setQty('');
      setReason('CORRECTION');
      setNotes('');
      setError(null);
    }
  }, [open, row?.resourceId]);

  const submit = async () => {
    setError(null);
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a positive quantity.');
      return;
    }
    if (!row) return;
    setSaving(true);
    try {
      await onSubmit({
        resourceId: row.resourceId,
        delta: direction === 'add' ? n : -n,
        reason: reason as AdjustStockInput['reason'],
        notes: notes.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType={isPhone ? 'slide' : 'fade'} transparent onRequestClose={saving ? undefined : onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-1">Adjust stock</Text>
          <Text className="text-sm text-muted mb-3">
            {row?.name} · on hand {row?.balance} {row?.unit}. Every change is logged with a reason.
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="flex-row gap-2 mb-3">
              {(['add', 'remove'] as const).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDirection(d)}
                  className={`flex-1 py-2 rounded-lg border items-center ${direction === d ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}
                >
                  <Text className={`text-sm font-semibold ${direction === d ? 'text-primary' : 'text-muted'}`}>
                    {d === 'add' ? '+ Add stock' : '− Remove stock'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              label={`Quantity to ${direction === 'add' ? 'add' : 'remove'} (${row?.unit ?? ''})`}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Select label="Reason" value={reason} onChange={(v) => v && setReason(v)} options={ADJUST_REASONS} />
            <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. carton damaged in transit" />
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-4">
              <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
              <Button label={saving ? 'Saving…' : 'Apply adjustment'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Opening stock import ──────────────────────────────────────────── */

export function OpeningStockModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (lines: OpeningStockLine[]) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  const [csv, setCsv] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCsv('');
      setError(null);
    }
  }, [open]);

  const parseLines = (): OpeningStockLine[] => {
    const out: OpeningStockLine[] = [];
    for (const raw of csv.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) throw new Error(`Line "${line}" needs name/sku, qty[, rate[, batch, mfg, exp]]`);
      const name = parts[0];
      const qty = Number(parts[1]);
      const rate = parts.length > 2 && parts[2] !== '' ? Number(parts[2]) : undefined;
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Line "${line}" has an invalid quantity`);
      const batchCode = parts.length > 3 && parts[3] !== '' ? parts[3] : undefined;
      const manufacturedAt = parts.length > 4 && parts[4] !== '' ? new Date(parts[4]) : undefined;
      const expiresAt = parts.length > 5 && parts[5] !== '' ? new Date(parts[5]) : undefined;
      if (manufacturedAt && Number.isNaN(manufacturedAt.getTime())) {
        throw new Error(`Line "${line}" has an invalid mfg date`);
      }
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        throw new Error(`Line "${line}" has an invalid expiry date`);
      }
      out.push({
        name,
        quantity: qty,
        ...(rate !== undefined && Number.isFinite(rate) ? { rate } : {}),
        ...(batchCode ? { batchCode } : {}),
        ...(manufacturedAt ? { manufacturedAt } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
    }
    return out;
  };

  const submit = async () => {
    setError(null);
    let lines: OpeningStockLine[];
    try {
      lines = parseLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse CSV');
      return;
    }
    if (lines.length === 0) {
      setError('Paste at least one line.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType={isPhone ? 'slide' : 'fade'} transparent onRequestClose={saving ? undefined : onClose}>
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-1">Import opening stock</Text>
          <Text className="text-sm text-muted mb-3">
            Paste one line per item: name or SKU, quantity, optional rate, optional batch code,
            optional mfg date, optional expiry date. Items are matched by name/SKU from your
            catalog; unmatched rows are reported.
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input
              label="CSV (name-or-sku, qty, rate, batch, mfg, exp)"
              value={csv}
              onChangeText={setCsv}
              multiline
              placeholder={'Cement, 500, 350\nMilk Pouch 500 ml, 100, 28, LOT-0901, 2026-08-01, 2026-08-15'}
            />
            <View className="flex-row gap-1.5 mb-2 flex-wrap">
              <Badge color="neutral" label={`${csv.split('\n').filter((l) => l.trim()).length} line(s)`} />
              <Badge color="neutral" label="Sets opening balance (ADJUST · OPENING_STOCK)" />
            </View>
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-4">
              <Button label="Cancel" variant="secondary" className="flex-1" disabled={saving} onPress={onClose} />
              <Button label={saving ? 'Importing…' : 'Import'} variant="accent" className="flex-1" loading={saving} onPress={submit} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MultiIssueStockModal({
  open,
  submitting,
  rows,
  initialResourceId,
  itemLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  rows: StockSummaryRow[];
  initialResourceId?: string | null;
  itemLabel: string;
  onClose: () => void;
  onSubmit: (input: {
    lines: Array<{ resourceId: string; quantity: number; unitPrice?: number; batchCode?: string }>;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerId?: string;
    notes?: string;
    allowExpired?: boolean;
  }) => Promise<void>;
}) {
  const { isPhone, isTablet, isDesktop } = useViewport();
  const tableMode = isTablet || isDesktop;
  const { data: customers } = useCustomers();
  type DraftIssueLine = { key: string; resourceId: string; quantity: string; unitPrice: string; batchCode: string };
  const newKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [lines, setLines] = useState<DraftIssueLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerId, setCustomerId] = useState('');
  const { data: effectiveRates } = useEffectiveRates(customerId || undefined);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): authorized override to sell
  // EXPIRED lots (FEFO otherwise rejects expired-only stock).
  const [allowExpired, setAllowExpired] = useState(false);
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7.6): customer block collapsed
  // behind "Add customer" until needed.
  const [customerOpen, setCustomerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialResourceId) {
      const row = rows.find((r) => r.resourceId === initialResourceId);
      setLines([
        {
          key: newKey(),
          resourceId: initialResourceId,
          quantity: '',
          unitPrice:
            row && row.catalogRate != null && Number(row.catalogRate) > 0
              ? String(row.catalogRate)
              : '',
          batchCode: '',
        },
      ]);
    } else {
      setLines([{ key: newKey(), resourceId: '', quantity: '', unitPrice: '', batchCode: '' }]);
    }
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerId('');
    setNotes('');
    setAllowExpired(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialResourceId]);

  const issuable = rows.filter((r) => Number(r.balance) > 0);
  const itemLower = itemLabel.toLowerCase();
  const rowFor = (resourceId: string) => rows.find((r) => r.resourceId === resourceId);
  const updateLine = (key: string, patch: Partial<DraftIssueLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  useEffect(() => {
    if (!customerId || !effectiveRates) return;
    setLines((prev) =>
      prev.map((l) => {
        if (!l.resourceId) return l;
        const override = effectiveRates[l.resourceId];
        if (override == null || override <= 0) return l;
        return { ...l, unitPrice: String(override) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, effectiveRates]);

  const addLine = () => {
    setError(null);
    setLines((prev) => [...prev, { key: newKey(), resourceId: '', quantity: '', unitPrice: '', batchCode: '' }]);
  };
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const optionsFor = (line: DraftIssueLine) => {
    const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.resourceId));
    return issuable
      .filter((r) => !taken.has(r.resourceId))
      .map((r) => ({ title: `${r.name} (${r.balance} ${r.unit})`, value: r.resourceId }));
  };

  const submit = () => {
    setError(null);
    const payload: Array<{ resourceId: string; quantity: number; unitPrice?: number; batchCode?: string }> = [];
    for (const l of lines) {
      if (!l.resourceId) {
        setError(`Choose a ${itemLower} for every line.`);
        return;
      }
      const row = rowFor(l.resourceId);
      const qty = Number(l.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Enter a positive quantity for ${row?.name ?? itemLower}.`);
        return;
      }
      if (row && qty > Number(row.balance)) {
        setError(`Only ${row.balance} ${row.unit} of ${row.name} available.`);
        return;
      }
      const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        setError(`Enter a selling price (0 or more) for ${row?.name ?? itemLower}.`);
        return;
      }
      payload.push({
        resourceId: l.resourceId,
        quantity: qty,
        ...(price !== undefined ? { unitPrice: price } : {}),
        ...(l.batchCode.trim() ? { batchCode: l.batchCode.trim() } : {}),
      });
    }
    void onSubmit({
      lines: payload,
      ...(customerId ? { customerId } : {}),
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      notes: notes.trim() || undefined,
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): authorized override for
      // expired lots - FEFO still picks earliest expiry, but allows expired.
      allowExpired,
    });
  };

  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.6.5): full-screen workspace for
  // Bulk issue; tablet+desktop get a line TABLE (Item · Qty · Selling ₹ · Batch ·
  // Remove); phones keep stacked lines but full-height. Same issueStockManual API.
  return (
    <Modal
      visible={open}
      animationType={isPhone ? 'slide' : 'fade'}
      transparent
      onRequestClose={submitting ? undefined : onClose}
    >
      <View className="flex-1 bg-black/40">
        <Pressable
          className="absolute inset-0"
          onPress={submitting ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Close bulk issue"
        />
        <View className={`flex-1 bg-card ${isPhone ? 'rounded-t-2xl mt-4' : ''}`}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <View className="flex-1">
              <Text className="text-lg font-bold text-text">{initialResourceId ? 'Issue stock' : 'Bulk issue'}</Text>
              <Text className="text-xs text-muted">
                {initialResourceId
                  ? 'Set quantity and selling price. Creates a stock OUT and draft sales invoice.'
                  : 'Add multiple materials and quantities. One submit creates stock OUTs and one draft sales invoice.'}
              </Text>
            </View>
            <Pressable onPress={submitting ? undefined : onClose} className="p-2" accessibilityRole="button" accessibilityLabel="Close bulk issue">
              <Text className="text-muted text-2xl">×</Text>
            </Pressable>
          </View>
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {tableMode ? (
              <View className="p-4">
                <View className="flex-row items-center px-3 py-2 bg-surface border border-border rounded-t-lg">
                  <Text className="flex-[1.8] text-[11px] font-bold text-muted uppercase">Item</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Qty</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Selling ₹</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Batch</Text>
                  <Text className="w-20 text-[11px] font-bold text-muted uppercase text-right">Remove</Text>
                </View>
                <View className="border border-t-0 border-border rounded-b-lg mb-3">
                  {lines.map((line) => {
                    const row = rowFor(line.resourceId);
                    return (
                      <View key={line.key} className="flex-row items-center px-3 py-2 border-b border-border/60 last:border-b-0">
                        <View className="flex-[1.8] pr-2">
                          <Select
                            compact
                            value={line.resourceId || undefined}
                            onChange={(v) => {
                              if (!v) return;
                              if (lines.some((l) => l.key !== line.key && l.resourceId === v)) {
                                setError(`Each ${itemLower} can be issued only once.`);
                                return;
                              }
                              const selected = rowFor(v);
                              setError(null);
                              updateLine(line.key, {
                                resourceId: v,
                                unitPrice:
                                  selected && selected.catalogRate != null && Number(selected.catalogRate) > 0
                                    ? String(selected.catalogRate)
                                    : line.unitPrice,
                              });
                            }}
                            options={optionsFor(line)}
                            placeholder={`Choose ${itemLower}`}
                            disabled={submitting || !!initialResourceId}
                          />
                        </View>
                        <View className="flex-1 pr-2">
                          <CellInput
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Quantity of ${row?.name ?? itemLower}`}
                            value={line.quantity}
                            onChangeText={(t) => updateLine(line.key, { quantity: t })}
                            placeholder="0"
                          />
                          {row && Number(line.quantity) > Number(row.balance) ? (
                            <Text className="text-[11px] text-danger">Only {row.balance} {row.unit} in stock.</Text>
                          ) : null}
                        </View>
                        <View className="flex-1 pr-2">
                          <CellInput
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Selling price of ${row?.name ?? itemLower}`}
                            value={line.unitPrice}
                            onChangeText={(t) => updateLine(line.key, { unitPrice: t })}
                            placeholder={row?.catalogRate != null ? `₹${row.catalogRate}` : 'Price'}
                          />
                        </View>
                        <View className="flex-1 pr-2">
                          <CellInput
                            keyboardType="default"
                            autoCapitalize="characters"
                            accessibilityLabel={`Batch code of ${row?.name ?? itemLower}`}
                            value={line.batchCode}
                            onChangeText={(t) => updateLine(line.key, { batchCode: t })}
                            placeholder="Batch"
                          />
                        </View>
                        <View className="w-20 items-end">
                          {!initialResourceId && lines.length > 1 ? (
                            <Pressable disabled={submitting} onPress={() => removeLine(line.key)} accessibilityRole="button" accessibilityLabel={`Remove ${row?.name ?? itemLower}`} className="px-2 py-1">
                              <Text className="text-xs font-semibold text-danger">Remove</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                  {lines.length === 0 ? (
                    <Text className="text-xs text-muted py-8 text-center">No lines yet — add a line below.</Text>
                  ) : null}
                </View>
                {!initialResourceId ? (
                  <Button
                    label={`+ Add ${itemLower}`}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    disabled={submitting || !issuable.some((r) => !lines.some((l) => l.resourceId === r.resourceId))}
                    onPress={addLine}
                  />
                ) : null}
              </View>
            ) : (
              <View className="p-4">
                {lines.map((line, idx) => {
                  const row = rowFor(line.resourceId);
                  return (
                    <View key={line.key} className="rounded-xl border border-border p-3 mb-2">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-text">
                          {initialResourceId ? itemLabel : `${itemLabel} ${idx + 1}`}
                        </Text>
                        {!initialResourceId && lines.length > 1 ? (
                          <Pressable disabled={submitting} onPress={() => removeLine(line.key)} className="px-2 py-1">
                            <Text className="text-xs font-semibold text-danger">Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Select
                        label={itemLabel}
                        value={line.resourceId || undefined}
                        onChange={(v) => {
                          if (!v) return;
                          if (lines.some((l) => l.key !== line.key && l.resourceId === v)) {
                            setError(`Each ${itemLower} can be issued only once.`);
                            return;
                          }
                          const selected = rowFor(v);
                          setError(null);
                          updateLine(line.key, {
                            resourceId: v,
                            unitPrice:
                              selected && selected.catalogRate != null && Number(selected.catalogRate) > 0
                                ? String(selected.catalogRate)
                                : line.unitPrice,
                          });
                        }}
                        options={optionsFor(line)}
                        placeholder={`Choose ${itemLower}`}
                        disabled={submitting || !!initialResourceId}
                      />
                      <View className="flex-row gap-2 mt-2">
                        <View className="flex-1">
                          <Input
                            label={row ? `Quantity (${row.unit}, max ${row.balance})` : 'Quantity'}
                            value={line.quantity}
                            onChangeText={(t) => updateLine(line.key, { quantity: t })}
                            keyboardType="decimal-pad"
                            placeholder="0"
                          />
                          {row && Number(line.quantity) > Number(row.balance) ? (
                            <Text className="text-[11px] text-danger">
                              Only {row.balance} {row.unit} in stock.
                            </Text>
                          ) : null}
                        </View>
                        <View className="flex-1">
                          <Input
                            label="Selling ₹ / unit"
                            value={line.unitPrice}
                            onChangeText={(t) => updateLine(line.key, { unitPrice: t })}
                            keyboardType="decimal-pad"
                            placeholder={row?.catalogRate != null ? `Catalog ₹${row.catalogRate}` : 'Price'}
                          />
                        </View>
                      </View>
                      <Input
                        label="Batch / lot code (optional)"
                        value={line.batchCode}
                        onChangeText={(t) => updateLine(line.key, { batchCode: t })}
                        autoCapitalize="characters"
                        placeholder="e.g. LOT-2026-A"
                      />
                    </View>
                  );
                })}
                {!initialResourceId ? (
                  <>
                    <Button
                      label={`+ Add ${itemLower}`}
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={submitting || !issuable.some((r) => !lines.some((l) => l.resourceId === r.resourceId))}
                      onPress={addLine}
                    />
                    <Text className="text-[11px] text-muted mt-1 mb-1">
                      {!issuable.some((r) => !lines.some((l) => l.resourceId === r.resourceId))
                        ? `All on-hand ${itemLower}s are already on this list.`
                        : `Add another on-hand ${itemLower} to this same issue.`}
                    </Text>
                  </>
                ) : null}
              </View>
            )}
            <View className={tableMode ? 'px-4 pb-4' : 'px-4 pb-4'}>
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
                    label="Customer (optional)"
                    value={customerId || undefined}
                    options={(customers ?? []).map((c: PartyRow) => ({ title: c.name, value: c.id }))}
                    onChange={(v) => {
                      setCustomerId(v ?? '');
                      const c = (customers ?? []).find((x: PartyRow) => x.id === v);
                      if (c) {
                        if (!customerName) setCustomerName(c.name);
                        if (!customerPhone && c.phone) setCustomerPhone(c.phone);
                        if (!customerAddress && c.billingAddress) setCustomerAddress(c.billingAddress);
                      }
                    }}
                    placeholder="Pick from customers"
                  />
                  <Input label="Customer name (optional)" value={customerName} onChangeText={setCustomerName} placeholder="Defaults to Walk-in customer" />
                  <Input label="Customer phone (optional)" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="+91 …" />
                  <Input label="Customer address (optional)" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Billing address" />
                  <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Delivery ref / site" />
                </>
              ) : null}
              {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
              {/* INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): authorized override -
                  FEFO still sells earliest-expiry lots first; this permits EXPIRED
                  lots when no fresh stock is left. */}
              <Pressable className="flex-row items-center gap-2 mt-1" disabled={submitting} onPress={() => setAllowExpired((v) => !v)}>
                <View className={`w-5 h-5 rounded border items-center justify-center ${allowExpired ? 'bg-accent border-accent' : 'border-border'}`}>
                  {allowExpired ? <Text className="text-white text-xs font-bold">✓</Text> : null}
                </View>
                <Text className="text-xs text-muted flex-1">Include expired lots (only if no fresh stock is left)</Text>
              </Pressable>
              <View className="flex-row gap-2 mt-4 mb-4">
                <Button label="Cancel" variant="secondary" className="flex-1" disabled={submitting} onPress={onClose} />
                <Button
                  label={submitting ? 'Issuing…' : initialResourceId ? 'Issue' : 'Bulk issue'}
                  variant="accent"
                  className="flex-1"
                  disabled={submitting}
                  loading={submitting}
                  onPress={submit}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
