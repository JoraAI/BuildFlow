/**
 * BuildFlow - Stock adjust + opening-stock import modals
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 * Responsive: phone bottom sheet, desktop centered.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, TextInput } from 'react-native';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import type { StockSummaryRow } from '@/services/expansion.queries';
import type { AdjustStockInput, OpeningStockLine } from '@/services/expansion.queries';
import { useCustomers, type PartyRow } from '@/services/party.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';
import { useCompany } from '@/services/settings.queries';
import { useResources, type Resource } from '@/services/estimate.queries';
import { resolveSellRate, toBaseQty } from '@buildflow/shared';

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
  { title: 'Wastage', value: 'WASTAGE' },
  { title: 'Free sample', value: 'FREE_SAMPLE' },
  { title: 'Theft', value: 'THEFT' },
  { title: 'Expiry', value: 'EXPIRY' },
  { title: 'Stocktake', value: 'STOCKTAKE' },
  { title: 'Found stock', value: 'FOUND_STOCK' },
  { title: 'Correction', value: 'CORRECTION' },
  { title: 'Other', value: 'OTHER' },
];

const REMOVE_ONLY_REASONS = new Set(['WASTAGE', 'FREE_SAMPLE', 'DAMAGE', 'LOSS', 'THEFT', 'EXPIRY']);

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
            <Select
              label="Reason"
              value={reason}
              onChange={(v) => {
                if (!v) return;
                setReason(v);
                if (REMOVE_ONLY_REASONS.has(v)) setDirection('remove');
              }}
              options={ADJUST_REASONS}
            />
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="e.g. free sample for distributor / production wastage"
            />
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
    lines: Array<{
      resourceId: string;
      quantity: number;
      unit?: string;
      unitPrice?: number;
      batchCode?: string;
    }>;
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
  const { data: company } = useCompany();
  const { data: resourceData } = useResources();
  const multiUnitOn = Boolean(company?.multiUnitEnabled);
  const resourcesById = useMemo(() => {
    const map = new Map<string, Resource>();
    for (const r of resourceData?.data ?? []) map.set(r.id, r);
    return map;
  }, [resourceData?.data]);

  type DraftIssueLine = {
    key: string;
    resourceId: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    batchCode: string;
  };
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

  const selectedParty = (customers ?? []).find((c: PartyRow) => c.id === customerId);
  // Walk-in / no party → retailer (CUSTOMER) prices; distributors opt in via party role.
  const buyerRole =
    selectedParty?.buyerRole === 'DISTRIBUTOR' ? ('DISTRIBUTOR' as const) : ('CUSTOMER' as const);

  const catalogFor = (resourceId: string) => resourcesById.get(resourceId);
  const unitOptionsFor = (resourceId: string) => {
    const r = catalogFor(resourceId);
    const row = rows.find((x) => x.resourceId === resourceId);
    if (!r) {
      return row?.unit ? [{ title: row.unit, value: row.unit }] : [];
    }
    const units = r.units ?? [];
    if (multiUnitOn && units.length > 0) {
      return units.map((u) => ({
        title:
          u.isBase || Number(u.conversionToBase) === 1
            ? `${u.unitName} (base)`
            : `${u.unitName} (= ${u.conversionToBase} ${r.unit})`,
        value: u.unitName,
      }));
    }
    return [{ title: r.unit, value: r.unit }];
  };
  const factorFor = (resourceId: string, unitName: string) => {
    const r = catalogFor(resourceId);
    if (!r) return 1;
    const row = (r.units ?? []).find((u) => u.unitName === unitName);
    if (row) return Number(row.conversionToBase) || 1;
    return unitName === r.unit ? 1 : 1;
  };
  const resolvePrice = (resourceId: string, unitName: string) => {
    const override = effectiveRates?.[resourceId];
    const r = catalogFor(resourceId);
    const row = rows.find((x) => x.resourceId === resourceId);
    if (!r) {
      return override != null && override > 0
        ? String(override)
        : row?.catalogRate != null && Number(row.catalogRate) > 0
          ? String(row.catalogRate)
          : '';
    }
    const n = resolveSellRate({
      resource: {
        unit: r.unit,
        rate: Number(r.rate) || 0,
        distributorRate: r.distributorRate == null ? null : Number(r.distributorRate),
        customerRate: r.customerRate == null ? null : Number(r.customerRate),
        units: r.units ?? undefined,
      },
      unitName: unitName || r.unit,
      buyerRole,
      priceListOverride: override != null && override > 0 ? override : null,
    });
    return n > 0 ? String(n) : '';
  };

  useEffect(() => {
    if (!open) return;
    if (initialResourceId) {
      const row = rows.find((r) => r.resourceId === initialResourceId);
      const unit = row?.unit || catalogFor(initialResourceId)?.unit || '';
      setLines([
        {
          key: newKey(),
          resourceId: initialResourceId,
          quantity: '',
          unit,
          unitPrice: resolvePrice(initialResourceId, unit),
          batchCode: '',
        },
      ]);
    } else {
      setLines([{ key: newKey(), resourceId: '', quantity: '', unit: '', unitPrice: '', batchCode: '' }]);
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
    if (!open) return;
    setLines((prev) =>
      prev.map((l) => {
        if (!l.resourceId) return l;
        const unit = l.unit || catalogFor(l.resourceId)?.unit || '';
        return { ...l, unit, unitPrice: resolvePrice(l.resourceId, unit) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, effectiveRates, buyerRole]);

  const addLine = () => {
    setError(null);
    setLines((prev) => [
      ...prev,
      { key: newKey(), resourceId: '', quantity: '', unit: '', unitPrice: '', batchCode: '' },
    ]);
  };
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const optionsFor = (line: DraftIssueLine) => {
    const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.resourceId));
    return issuable
      .filter((r) => !taken.has(r.resourceId))
      .map((r) => ({ title: `${r.name} (${r.balance} ${r.unit})`, value: r.resourceId }));
  };

  const applyItem = (lineKey: string, resourceId: string) => {
    if (lines.some((l) => l.key !== lineKey && l.resourceId === resourceId)) {
      setError(`Each ${itemLower} can be issued only once.`);
      return;
    }
    const unit = catalogFor(resourceId)?.unit || rowFor(resourceId)?.unit || '';
    setError(null);
    updateLine(lineKey, {
      resourceId,
      unit,
      unitPrice: resolvePrice(resourceId, unit),
    });
  };

  const applyUnit = (lineKey: string, unitName: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l;
        if (!l.resourceId) return { ...l, unit: unitName };
        return {
          ...l,
          unit: unitName,
          unitPrice: resolvePrice(l.resourceId, unitName),
        };
      }),
    );
  };

  const submit = () => {
    setError(null);
    const payload: Array<{
      resourceId: string;
      quantity: number;
      unit?: string;
      unitPrice?: number;
      batchCode?: string;
    }> = [];
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
      const unit = l.unit || row?.unit || '';
      const stockNeed = toBaseQty(qty, factorFor(l.resourceId, unit));
      if (row && stockNeed > Number(row.balance) + 1e-9) {
        setError(
          `Only ${row.balance} ${row.unit} of ${row.name} available` +
            (stockNeed !== qty ? ` (need ${stockNeed} ${row.unit})` : '') +
            '.',
        );
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
        ...(unit ? { unit } : {}),
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
                  {multiUnitOn ? (
                    <Text className="w-[88px] text-[11px] font-bold text-muted uppercase">Unit</Text>
                  ) : null}
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Qty</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Selling ₹</Text>
                  <Text className="flex-1 text-[11px] font-bold text-muted uppercase">Batch</Text>
                  <Text className="w-20 text-[11px] font-bold text-muted uppercase text-right">Remove</Text>
                </View>
                <View className="border border-t-0 border-border rounded-b-lg mb-3">
                  {lines.map((line) => {
                    const row = rowFor(line.resourceId);
                    const unitOpts = unitOptionsFor(line.resourceId);
                    const showUnitPicker = multiUnitOn && unitOpts.length > 1;
                    const stockNeed = toBaseQty(
                      Number(line.quantity) || 0,
                      factorFor(line.resourceId, line.unit || row?.unit || ''),
                    );
                    const overStock =
                      Boolean(row) &&
                      Number(line.quantity) > 0 &&
                      stockNeed > Number(row!.balance) + 1e-9;
                    return (
                      <View key={line.key} className="flex-row items-center px-3 py-2 border-b border-border/60 last:border-b-0">
                        <View className="flex-[1.8] pr-2">
                          <Select
                            compact
                            value={line.resourceId || undefined}
                            onChange={(v) => v && applyItem(line.key, v)}
                            options={optionsFor(line)}
                            placeholder={`Choose ${itemLower}`}
                            disabled={submitting || !!initialResourceId}
                          />
                        </View>
                        {multiUnitOn ? (
                          <View className="w-[88px] pr-2">
                            {showUnitPicker ? (
                              <Select
                                compact
                                value={line.unit || undefined}
                                onChange={(v) => v && applyUnit(line.key, v)}
                                options={unitOpts}
                                placeholder="Unit"
                                disabled={submitting || !line.resourceId}
                              />
                            ) : (
                              <Text className="text-xs text-muted">{line.unit || row?.unit || '—'}</Text>
                            )}
                          </View>
                        ) : null}
                        <View className="flex-1 pr-2">
                          <CellInput
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Quantity of ${row?.name ?? itemLower}`}
                            value={line.quantity}
                            onChangeText={(t) => updateLine(line.key, { quantity: t })}
                            placeholder="0"
                          />
                          {overStock ? (
                            <Text className="text-[11px] text-danger">
                              Only {row!.balance} {row!.unit} in stock
                              {stockNeed !== Number(line.quantity)
                                ? ` (need ${stockNeed} ${row!.unit})`
                                : ''}
                              .
                            </Text>
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
                    <Text className="text-xs text-muted py-8 text-center">No lines yet - add a line below.</Text>
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
                        onChange={(v) => v && applyItem(line.key, v)}
                        options={optionsFor(line)}
                        placeholder={`Choose ${itemLower}`}
                        disabled={submitting || !!initialResourceId}
                      />
                      {multiUnitOn && unitOptionsFor(line.resourceId).length > 1 ? (
                        <View className="mt-2">
                          <Select
                            label="Unit"
                            value={line.unit || undefined}
                            onChange={(v) => v && applyUnit(line.key, v)}
                            options={unitOptionsFor(line.resourceId)}
                            placeholder="Unit"
                            disabled={submitting || !line.resourceId}
                          />
                        </View>
                      ) : null}
                      <View className="flex-row gap-2 mt-2 items-center">
                        <View className="flex-1">
                          {/* UX polish M7 / 11.8: compact cell, no tall labeled Input. */}
                          <CellInput
                            keyboardType="decimal-pad"
                            accessibilityLabel={row ? `Quantity of ${row.name}` : 'Quantity'}
                            value={line.quantity}
                            onChangeText={(t) => updateLine(line.key, { quantity: t })}
                            placeholder="0"
                          />
                          {row &&
                          Number(line.quantity) > 0 &&
                          toBaseQty(
                            Number(line.quantity) || 0,
                            factorFor(line.resourceId, line.unit || row.unit),
                          ) >
                            Number(row.balance) + 1e-9 ? (
                            <Text className="text-[11px] text-danger">
                              Only {row.balance} {row.unit} in stock.
                            </Text>
                          ) : null}
                        </View>
                        <View className="flex-1">
                          <CellInput
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Selling price of ${row?.name ?? itemLower}`}
                            value={line.unitPrice}
                            onChangeText={(t) => updateLine(line.key, { unitPrice: t })}
                            placeholder={row?.catalogRate != null ? `₹${row.catalogRate}` : 'Price'}
                          />
                        </View>
                      </View>
                      <View className="mt-2">
                        <CellInput
                          autoCapitalize="characters"
                          accessibilityLabel={`Batch code of ${row?.name ?? itemLower}`}
                          value={line.batchCode}
                          onChangeText={(t) => updateLine(line.key, { batchCode: t })}
                          placeholder="Batch / lot (optional)"
                        />
                      </View>
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
