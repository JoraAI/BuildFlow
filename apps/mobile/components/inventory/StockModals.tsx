/**
 * BuildFlow - Stock adjust + opening-stock import modals
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 * Responsive: phone bottom sheet, desktop centered.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import type { StockSummaryRow } from '@/services/expansion.queries';
import type { AdjustStockInput, OpeningStockLine } from '@/services/expansion.queries';

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
      if (parts.length < 2) throw new Error(`Line "${line}" needs name/sku, qty[, rate]`);
      const name = parts[0];
      const qty = Number(parts[1]);
      const rate = parts.length > 2 && parts[2] !== '' ? Number(parts[2]) : undefined;
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Line "${line}" has an invalid quantity`);
      out.push({ name, quantity: qty, ...(rate !== undefined && Number.isFinite(rate) ? { rate } : {}) });
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
            Paste one line per item: name or SKU, quantity, optional rate. Items are matched by
            name/SKU from your catalog; unmatched rows are reported.
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input
              label="CSV (name-or-sku, qty, rate)"
              value={csv}
              onChangeText={setCsv}
              multiline
              placeholder={'Cement, 500, 350\nSteel rods, 1200, 88'}
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
