/**
 * Inventory shell - Stock home.
 *
 * Stock summary + recent movements for the tenant's default STORE project.
 * Supports manual stock issue (OUT) with selling price → draft sales invoice.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, Input, Select, toast } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { useRouter } from 'expo-router';
import {
  useStockSummary,
  useStockMovements,
  useIssueStock,
  expansionKeys,
  type StockSummaryRow,
  type StockMovementRow,
} from '@/services/expansion.queries';

async function bufferUntil(
  run: () => Promise<unknown>,
  predicate: () => boolean,
  timeoutMs = 12000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await run();
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  await run();
  return predicate();
}

export default function InventoryStockScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const qc = useQueryClient();
  const { isDesktop } = useViewport();
  const projectId = user?.defaultProjectId ?? '';

  const { data: summary, isLoading, isFetching, refetch } = useStockSummary(projectId);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  /** When opened from a row CTA, prefill the multi sheet with this one material. */
  const [issueInitialResourceId, setIssueInitialResourceId] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const {
    data: movements,
    refetch: refetchMovements,
  } = useStockMovements(projectId, selectedResourceId ?? undefined);
  const issueStock = useIssueStock(projectId);

  const totals = useMemo(() => {
    const rows: StockSummaryRow[] = summary ?? [];
    return {
      items: rows.length,
      onHand: rows.reduce((acc: number, r: StockSummaryRow) => acc + (Number(r.balance) || 0), 0),
      received: rows.reduce((acc: number, r: StockSummaryRow) => acc + (Number(r.received) || 0), 0),
      issued: rows.reduce((acc: number, r: StockSummaryRow) => acc + (Number(r.issued) || 0), 0),
    };
  }, [summary]);

  /** Any material with on-hand stock is issuable. */
  const hasIssuableStock = useMemo(
    () => (summary ?? []).some((r: StockSummaryRow) => Number(r.balance) > 0),
    [summary],
  );

  const onRefresh = () => {
    void refetch();
    void refetchMovements();
  };

  return (
    <View className="flex-1 bg-surface">
      {buffering ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
          <View className="flex-1 bg-black/50 items-center justify-center px-8">
            <View className="bg-card rounded-2xl px-6 py-5 items-center max-w-sm w-full border border-border">
              <ActivityIndicator size="large" />
              <Text className="text-base font-bold text-text mt-4 text-center">Updating stock…</Text>
              <Text className="text-xs text-muted mt-2 text-center">
                Please wait until stock and the draft invoice refresh. Don’t change anything while this
                is in progress.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}

      <View
        className={`px-4 pt-4 pb-2 ${
          isDesktop ? 'flex-row items-center justify-between gap-4' : 'gap-3'
        }`}
      >
        <View className={isDesktop ? 'flex-1 min-w-0' : undefined}>
          <Text className="text-2xl font-bold text-text">Stock</Text>
          <Text className="text-sm text-muted mt-0.5">{user?.companyName} · 1 store</Text>
        </View>
        {/* Desktop: compact toolbar (Materials + Bulk issue). Phone: same actions, wrap neatly. */}
        <View
          className={`flex-row items-center gap-2 ${isDesktop ? '' : 'flex-wrap'}`}
        >
          <Button
            label="Materials"
            variant="secondary"
            size="sm"
            disabled={buffering}
            onPress={() => router.push('/inventory/materials' as never)}
          />
          <Button
            label="Bulk issue"
            variant="accent"
            size="sm"
            disabled={buffering || !hasIssuableStock}
            onPress={() => {
              setIssueInitialResourceId(null);
              setIssueOpen(true);
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} className="rounded-xl h-16" />
          ))}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={summary ?? []}
          keyExtractor={(item) => item.resourceId}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !buffering}
              onRefresh={onRefresh}
              tintColor="#1E3A5F"
            />
          }
          ListHeaderComponent={
            <View className="px-4 pb-2">
              <View className={`flex-row gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
                <Card className="flex-1 min-w-[140px] p-4">
                  <Text className="text-xs text-muted">Items</Text>
                  <Text className="text-2xl font-bold text-primary">{totals.items}</Text>
                </Card>
                <Card className="flex-1 min-w-[140px] p-4">
                  <Text className="text-xs text-muted">On hand</Text>
                  <Text className="text-2xl font-bold text-primary">{totals.onHand}</Text>
                </Card>
                <Card className="flex-1 min-w-[140px] p-4">
                  <Text className="text-xs text-muted">Received</Text>
                  <Text className="text-2xl font-bold text-success">{totals.received}</Text>
                </Card>
                <Card className="flex-1 min-w-[140px] p-4">
                  <Text className="text-xs text-muted">Issued</Text>
                  <Text className="text-2xl font-bold text-danger">{totals.issued}</Text>
                </Card>
              </View>

              {selectedResourceId && movements ? (
                <Card className="mt-3 p-4">
                  <Text className="text-sm font-bold text-text mb-2">Recent movements</Text>
                  {movements.length === 0 ? (
                    <Text className="text-sm text-muted">No movements for this item.</Text>
                  ) : (
                    movements.map((m: StockMovementRow) => (
                      <View
                        key={m.id}
                        className="flex-row items-center justify-between py-1.5 border-b border-border/60"
                      >
                        <View className="flex-1 min-w-0 mr-2">
                          <Text className="text-sm text-text" numberOfLines={1}>
                            {m.referenceLabel ?? m.referenceType ?? 'Movement'}
                          </Text>
                          <Text className="text-[11px] text-muted">
                            {m.locationName} · {new Date(m.createdAt).toLocaleDateString('en-IN')}
                          </Text>
                        </View>
                        <Badge
                          color={m.type === 'IN' ? 'success' : 'danger'}
                          label={`${m.type === 'IN' ? '+' : '-'}${m.quantity} ${m.unit}`}
                        />
                      </View>
                    ))
                  )}
                </Card>
              ) : null}

              <Text className="text-sm font-bold text-text mt-4 mb-2">Stock summary</Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = item.resourceId === selectedResourceId;
            return (
              <Pressable
                disabled={buffering}
                onPress={() => setSelectedResourceId(selected ? null : item.resourceId)}
                className={`px-4 py-3 ${selected ? 'bg-primary/5' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 min-w-0 mr-2">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-[11px] text-muted">{item.unit}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-16">
                      <Text className="text-xs text-muted">Bal</Text>
                      <Text className="text-sm font-bold text-primary">{item.balance}</Text>
                    </View>
                    <Button
                      label="Issue"
                      size="sm"
                      variant="secondary"
                      disabled={buffering || Number(item.balance) <= 0}
                      onPress={() => {
                        setIssueInitialResourceId(item.resourceId);
                        setIssueOpen(true);
                      }}
                    />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="No stock yet"
              description="Add materials, create a purchase order, and record a GRN to bring stock in. Then issue stock when you sell or use materials."
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <MultiIssueStockModal
        open={issueOpen}
        submitting={issueStock.isPending || buffering}
        rows={summary ?? []}
        initialResourceId={issueInitialResourceId}
        onClose={() => {
          if (!buffering) {
            setIssueOpen(false);
            setIssueInitialResourceId(null);
          }
        }}
        onSubmit={async (input) => {
          const prevBalances = new Map<string, number>();
          for (const l of input.lines) {
            const row = (summary ?? []).find((r: StockSummaryRow) => r.resourceId === l.resourceId);
            prevBalances.set(l.resourceId, row ? Number(row.balance) : 0);
          }
          setBuffering(true);
          try {
            const result = await issueStock.mutateAsync(input);
            await bufferUntil(
              async () => {
                await refetch();
                if (selectedResourceId) await refetchMovements();
                await qc.refetchQueries({ queryKey: ['invoices', 'list', projectId] });
              },
              () => {
                const rows =
                  (qc.getQueryData(expansionKeys.stockSummary(projectId)) as
                    | StockSummaryRow[]
                    | undefined) ?? [];
                return input.lines.every((l) => {
                  const prev = prevBalances.get(l.resourceId) ?? 0;
                  const row = rows.find((r) => r.resourceId === l.resourceId);
                  if (!row) return false;
                  return Number(row.balance) <= prev - l.quantity + 0.001;
                });
              },
            );
            const names = result.lines
              .map((l) => `${l.resourceName} ${l.quantityIssued} ${l.unit}`)
              .join(', ');
            toast.success(
              result.draftInvoiceId ? `Issued ${names} · draft invoice created` : `Issued ${names}`,
            );
            setIssueOpen(false);
            setIssueInitialResourceId(null);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Issue failed');
            throw e;
          } finally {
            setBuffering(false);
          }
        }}
      />
    </View>
  );
}

function MultiIssueStockModal({
  open,
  submitting,
  rows,
  initialResourceId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  rows: StockSummaryRow[];
  initialResourceId?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    lines: Array<{ resourceId: string; quantity: number; unitPrice?: number }>;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();

  type DraftIssueLine = { key: string; resourceId: string; quantity: string; unitPrice: string };
  const newKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [lines, setLines] = useState<DraftIssueLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset the draft each time the sheet opens. Keyed on open so refetching rows
  // mid-submit (buffering) does not wipe the user's entries.
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
        },
      ]);
    } else {
      setLines([{ key: newKey(), resourceId: '', quantity: '', unitPrice: '' }]);
    }
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialResourceId]);

  /** Only materials with on-hand stock can be issued. */
  const issuable = rows.filter((r) => Number(r.balance) > 0);

  const rowFor = (resourceId: string) => rows.find((r) => r.resourceId === resourceId);

  const updateLine = (key: string, patch: Partial<DraftIssueLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    setError(null);
    setLines((prev) => [...prev, { key: newKey(), resourceId: '', quantity: '', unitPrice: '' }]);
  };

  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  /** Options for one line exclude materials already picked on other lines. */
  const optionsFor = (line: DraftIssueLine) => {
    const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.resourceId));
    return issuable
      .filter((r) => !taken.has(r.resourceId))
      .map((r) => ({ title: `${r.name} (${r.balance} ${r.unit})`, value: r.resourceId }));
  };

  const submit = () => {
    setError(null);
    const payload: Array<{ resourceId: string; quantity: number; unitPrice?: number }> = [];
    for (const l of lines) {
      if (!l.resourceId) {
        setError('Choose a material for every line.');
        return;
      }
      const row = rowFor(l.resourceId);
      const qty = Number(l.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Enter a positive quantity for ${row?.name ?? 'material'}.`);
        return;
      }
      if (row && qty > Number(row.balance)) {
        setError(`Only ${row.balance} ${row.unit} of ${row.name} available.`);
        return;
      }
      const price = l.unitPrice === '' ? undefined : Number(l.unitPrice);
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        setError(`Enter a selling price (0 or more) for ${row?.name ?? 'material'}.`);
        return;
      }
      payload.push({
        resourceId: l.resourceId,
        quantity: qty,
        ...(price !== undefined ? { unitPrice: price } : {}),
      });
    }
    void onSubmit({
      lines: payload,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      visible={open}
      animationType={isPhone ? 'slide' : 'fade'}
      transparent
      onRequestClose={submitting ? undefined : onClose}
    >
      <Pressable
        className={`flex-1 bg-black/40 ${isPhone ? 'justify-end' : 'items-center justify-center p-4'}`}
        onPress={submitting ? undefined : onClose}
      >
        <Pressable
          className={`bg-card w-full ${
            isPhone ? 'rounded-t-2xl max-h-[92%] p-4' : 'rounded-2xl max-w-2xl max-h-[85%] p-5'
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-text mb-1">
            {initialResourceId ? 'Issue stock' : 'Bulk issue'}
          </Text>
          <Text className="text-sm text-muted mb-3">
            {initialResourceId
              ? 'Set quantity and selling price. Creates a stock OUT and draft sales invoice.'
              : 'Add multiple materials and quantities. One submit creates stock OUTs and one draft sales invoice.'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {lines.map((line, idx) => {
              const row = rowFor(line.resourceId);
              return (
                <View key={line.key} className="rounded-xl border border-border p-3 mb-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-bold text-text">
                      {initialResourceId ? 'Material' : `Material ${idx + 1}`}
                    </Text>
                    {!initialResourceId && lines.length > 1 ? (
                      <Pressable
                        disabled={submitting}
                        onPress={() => removeLine(line.key)}
                        className="px-2 py-1"
                      >
                        <Text className="text-xs font-semibold text-danger">Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Select
                    label="Material"
                    value={line.resourceId || undefined}
                    onChange={(v) => {
                      if (!v) return;
                      // Double-guard duplicates (options already exclude them).
                      if (lines.some((l) => l.key !== line.key && l.resourceId === v)) {
                        setError('Each material can be issued only once.');
                        return;
                      }
                      const selected = rowFor(v);
                      setError(null);
                      updateLine(line.key, {
                        resourceId: v,
                        unitPrice:
                          selected &&
                          selected.catalogRate != null &&
                          Number(selected.catalogRate) > 0
                            ? String(selected.catalogRate)
                            : line.unitPrice,
                      });
                    }}
                    options={optionsFor(line)}
                    placeholder="Choose material"
                    // Per-row Issue: material is fixed; Bulk issue: editable.
                    disabled={submitting || !!initialResourceId}
                  />
                  <View className="flex-row gap-2 mt-2">
                    <View className="flex-1">
                      <Input
                        label={`Quantity (${row?.unit ?? ''})`}
                        value={line.quantity}
                        onChangeText={(t) => updateLine(line.key, { quantity: t })}
                        keyboardType="decimal-pad"
                        placeholder="0"
                      />
                    </View>
                    <View className="flex-1">
                      <Input
                        label="Selling ₹ / unit"
                        value={line.unitPrice}
                        onChangeText={(t) => updateLine(line.key, { unitPrice: t })}
                        keyboardType="decimal-pad"
                        placeholder={
                          row?.catalogRate != null ? `Catalog ₹${row.catalogRate}` : 'Price'
                        }
                      />
                    </View>
                  </View>
                </View>
              );
            })}
            {/* Bulk issue only — hidden when opened from a per-row Issue CTA. */}
            {!initialResourceId ? (
              <>
                <Button
                  label="+ Add material"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  disabled={
                    submitting ||
                    !issuable.some((r) => !lines.some((l) => l.resourceId === r.resourceId))
                  }
                  onPress={addLine}
                />
                <Text className="text-[11px] text-muted mt-1 mb-1">
                  {!issuable.some((r) => !lines.some((l) => l.resourceId === r.resourceId))
                    ? 'All on-hand materials are already on this list.'
                    : 'Add another on-hand material to this same issue.'}
                </Text>
              </>
            ) : null}
            <View className="h-3" />
            <Input
              label="Customer (optional)"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Defaults to Walk-in customer"
            />
            <Input
              label="Customer phone (optional)"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              placeholder="+91 …"
            />
            <Input
              label="Customer address (optional)"
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Billing address"
            />
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="e.g. Delivery ref / site"
            />
            {error ? <Text className="text-sm text-danger mt-2">{error}</Text> : null}
            <View className="flex-row gap-2 mt-4 mb-4">
              <Button
                label="Cancel"
                variant="secondary"
                className="flex-1"
                disabled={submitting}
                onPress={onClose}
              />
              <Button
                label={
                  submitting ? 'Issuing…' : initialResourceId ? 'Issue' : 'Bulk issue'
                }
                variant="accent"
                className="flex-1"
                disabled={submitting}
                loading={submitting}
                onPress={submit}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
