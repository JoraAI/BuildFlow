/**
 * BuildFlow - Warehouse ops modals (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 * Warehouse create/edit, stock transfer create, stock count create.
 * Responsive: phone bottom sheet, desktop centered (max-w-lg).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { Button, Input, Select } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { useStockSummary, type StockSummaryRow } from '@/services/expansion.queries';
import type { Warehouse } from '@/services/warehouse.queries';

function Sheet({
  title,
  subtitle,
  children,
  saving,
  onClose,
  visible = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  saving: boolean;
  onClose: () => void;
  visible?: boolean;
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
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={saving ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-lg max-h-[85%] p-4'}`}
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

const newKey = () => `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ── Warehouse create / edit ──────────────────────────────────────── */
export function WarehouseModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; code?: string; address?: string; isDefault?: boolean }) => Promise<void>;
  initial?: Warehouse | null;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCode(initial?.code ?? '');
      setAddress(initial?.address ?? '');
      setIsDefault(initial?.isDefault ?? false);
      setError('');
      setSaving(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Enter a warehouse name.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(isDefault ? { isDefault: true } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save warehouse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={open}
      title={initial ? 'Edit warehouse' : 'New warehouse'}
      subtitle="Multi-location stock for your business"
      saving={saving}
      onClose={onClose}
    >
      <Input label="Name *" value={name} onChangeText={setName} placeholder="e.g. Uppal Warehouse" />
      <Input label="Code (optional)" value={code} onChangeText={setCode} placeholder="e.g. UPP" autoCapitalize="characters" />
      <Input label="Address (optional)" value={address} onChangeText={setAddress} multiline placeholder="Plot, street, city" />
      <Pressable
        onPress={() => setIsDefault((v) => !v)}
        className="flex-row items-center justify-between py-3 px-3 rounded-lg border border-border bg-surface mt-1"
      >
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-text">Default warehouse</Text>
          <Text className="text-[11px] text-muted">New GRN, issue & adjustments go here unless you pick another.</Text>
        </View>
        <View className={`w-5 h-5 rounded border items-center justify-center ${isDefault ? 'bg-primary border-primary' : 'border-border'}`}>
          {isDefault ? <Text className="text-white text-xs font-bold">✓</Text> : null}
        </View>
      </Pressable>
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
        <Button
          label={saving ? 'Saving…' : initial ? 'Save' : 'Create'}
          variant="accent"
          className="flex-1 min-w-[120px]"
          loading={saving}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}

/* ── Stock transfer create ────────────────────────────────────────── */
type DraftLine = { key: string; resourceId: string; quantity: string };

export function TransferModal({
  open,
  onClose,
  onSubmit,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    fromLocationId: string;
    toLocationId: string;
    notes?: string;
    lines: Array<{ resourceId: string; quantity: number }>;
  }) => Promise<void>;
  warehouses: Warehouse[];
}) {
  const projectId = useAuthStore((s) => s.user?.defaultProjectId ?? '');
  const { data: summary } = useStockSummary(projectId);
  const rows: StockSummaryRow[] = summary ?? [];

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const def = warehouses.find((w) => w.isDefault);
      setFromId(def?.id ?? warehouses[0]?.id ?? '');
      setToId('');
      setNotes('');
      setLines([{ key: newKey(), resourceId: '', quantity: '' }]);
      setError('');
      setSaving(false);
    }
  }, [open, warehouses]);

  const srcWh = warehouses.find((w) => w.id === fromId);
  const balanceOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of srcWh?.balances ?? []) {
      const qty = Number(b.quantity);
      if (qty > 0) m.set(b.resourceId, qty);
    }
    return m;
  }, [srcWh]);
  const itemOptions = useMemo(() => {
    return (srcWh?.balances ?? [])
      .filter((b) => Number(b.quantity) > 0)
      .map((b) => {
        const row = rows.find((r) => r.resourceId === b.resourceId);
        const name = b.resource?.name ?? row?.name ?? 'Item';
        const unit = b.resource?.unit ?? row?.unit ?? '';
        return { title: `${name} (${Number(b.quantity)} ${unit} here)`, value: b.resourceId };
      });
  }, [srcWh, rows]);

  if (!open) return null;

  const whOptions = warehouses.map((w) => ({ title: w.name, value: w.id }));

  const submit = async () => {
    setError('');
    const good = lines.filter((l) => l.resourceId && Number(l.quantity) > 0);
    if (!fromId || !toId) {
      setError('Pick both source and destination warehouses.');
      return;
    }
    if (fromId === toId) {
      setError('Source and destination must be different.');
      return;
    }
    if (good.length === 0) {
      setError('Add at least one item with a quantity.');
      return;
    }
    for (const l of good) {
      const bal = balanceOf.get(l.resourceId) ?? 0;
      if (bal <= 0) {
        setError('Pick items that are on hand at the source warehouse.');
        return;
      }
      if (Number(l.quantity) > bal) {
        setError(`Quantity exceeds on-hand at source (${bal}).`);
        return;
      }
    }
    setSaving(true);
    try {
      await onSubmit({
        fromLocationId: fromId,
        toLocationId: toId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: good.map((l) => ({ resourceId: l.resourceId, quantity: Number(l.quantity) })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create transfer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={open}
      title="New stock transfer"
      subtitle="Draft → dispatch (stock leaves source) → receive (stock lands here)"
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="From warehouse"
        value={fromId || undefined}
        options={whOptions}
        onChange={(v) => {
          if (!v) return;
          setFromId(v);
          setLines([{ key: newKey(), resourceId: '', quantity: '' }]);
        }}
        placeholder="Pick source"
      />
      <Select label="To warehouse" value={toId || undefined} options={whOptions} onChange={(v) => v && setToId(v)} placeholder="Pick destination" />
      {fromId && itemOptions.length === 0 ? (
        <Text className="text-xs text-muted mt-2">
          No stock at this warehouse to transfer. Receive a GRN or pick another source.
        </Text>
      ) : null}
      {lines.map((l, i) => {
        const bal = l.resourceId ? (balanceOf.get(l.resourceId) ?? 0) : 0;
        return (
          <View key={l.key} className="gap-1 mt-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Select
                  label={i === 0 ? 'Item' : undefined}
                  value={l.resourceId || undefined}
                  options={itemOptions}
                  onChange={(v) => {
                    const next = [...lines];
                    next[i] = { ...l, resourceId: v ?? '' };
                    setLines(next);
                  }}
                  placeholder="Pick item"
                />
              </View>
              <Pressable
                onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className="pt-5 px-1"
                accessibilityLabel="Remove line"
              >
                <Text className="text-danger text-lg">×</Text>
              </Pressable>
            </View>
            <Input
              label="Quantity"
              value={l.quantity}
              onChangeText={(q) => {
                const next = [...lines];
                next[i] = { ...l, quantity: q };
                setLines(next);
              }}
              keyboardType="decimal-pad"
              placeholder={bal > 0 ? `On hand ${bal}` : '0'}
            />
          </View>
        );
      })}
      {itemOptions.length > 0 ? (
        <Button
          label="+ Add item"
          variant="secondary"
          size="sm"
          fullWidth
          onPress={() => setLines((ls) => [...ls, { key: newKey(), resourceId: '', quantity: '' }])}
        />
      ) : null}
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. stock move for the new branch" />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
        <Button
          label={saving ? 'Saving…' : 'Create transfer'}
          variant="accent"
          className="flex-1 min-w-[140px]"
          loading={saving}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}

/* ── Stock count create ───────────────────────────────────────────── */
type CountLine = { key: string; resourceId: string; countedQty: string };

export function CountModal({
  open,
  onClose,
  onSubmit,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    locationId: string;
    countDate: string;
    notes?: string;
    lines: Array<{ resourceId: string; countedQty: number }>;
  }) => Promise<void>;
  warehouses: Warehouse[];
}) {
  const projectId = useAuthStore((s) => s.user?.defaultProjectId ?? '');
  const { data: summary } = useStockSummary(projectId);
  const rows: StockSummaryRow[] = summary ?? [];

  const [locationId, setLocationId] = useState('');
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CountLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const def = warehouses.find((w) => w.isDefault);
      setLocationId(def?.id ?? warehouses[0]?.id ?? '');
      setCountDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setLines([{ key: newKey(), resourceId: '', countedQty: '' }]);
      setError('');
      setSaving(false);
    }
  }, [open, warehouses]);

  if (!open) return null;

  const locOptions = warehouses.map((w) => ({ title: w.name, value: w.id }));
  const itemOptions = rows.map((r) => ({ title: `${r.name} (${r.balance} ${r.unit})`, value: r.resourceId }));
  const locWh = warehouses.find((w) => w.id === locationId);
  const balanceOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of locWh?.balances ?? []) m.set(b.resourceId, Number(b.quantity));
    if (m.size > 0) return m;
    return new Map(rows.map((r) => [r.resourceId, r.balance]));
  }, [locWh, rows]);

  const submit = async () => {
    setError('');
    const good = lines.filter((l) => l.resourceId);
    if (!locationId) {
      setError('Pick a warehouse to count.');
      return;
    }
    if (good.length === 0) {
      setError('Add at least one item to count.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        locationId,
        countDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: good.map((l) => ({ resourceId: l.resourceId, countedQty: Number(l.countedQty) || 0 })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create stock count');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={open}
      title="New stock count"
      subtitle="Physical count vs system. Approving writes a STOCKTAKE adjustment."
      saving={saving}
      onClose={onClose}
    >
      <Select
        label="Warehouse"
        value={locationId || undefined}
        options={locOptions}
        onChange={(v) => v && setLocationId(v)}
        placeholder="Pick warehouse"
      />
      <Input label="Count date" value={countDate} onChangeText={setCountDate} />
      {lines.map((l, i) => {
        const sys = l.resourceId ? (balanceOf.get(l.resourceId) ?? 0) : 0;
        return (
          <View key={l.key} className="gap-1 mt-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Select
                  label={i === 0 ? 'Item' : undefined}
                  value={l.resourceId || undefined}
                  options={itemOptions}
                  onChange={(v) => {
                    const next = [...lines];
                    next[i] = { ...l, resourceId: v ?? '', countedQty: v ? String(balanceOf.get(v) ?? 0) : '' };
                    setLines(next);
                  }}
                  placeholder="Pick item"
                />
              </View>
              <Pressable
                onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className="pt-5 px-1"
                accessibilityLabel="Remove line"
              >
                <Text className="text-danger text-lg">×</Text>
              </Pressable>
            </View>
            <Input
              label={sys ? `Counted qty (system ${sys})` : 'Counted qty'}
              value={l.countedQty}
              onChangeText={(q) => {
                const next = [...lines];
                next[i] = { ...l, countedQty: q };
                setLines(next);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        );
      })}
      <Button
        label="+ Add item"
        variant="secondary"
        size="sm"
        fullWidth
        onPress={() => setLines((ls) => [...ls, { key: newKey(), resourceId: '', countedQty: '' }])}
      />
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. year-end stocktake" />
      {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
      <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
        <Button label="Cancel" variant="secondary" className="flex-1 min-w-[120px]" disabled={saving} onPress={onClose} />
        <Button
          label={saving ? 'Saving…' : 'Create count'}
          variant="accent"
          className="flex-1 min-w-[140px]"
          loading={saving}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}
