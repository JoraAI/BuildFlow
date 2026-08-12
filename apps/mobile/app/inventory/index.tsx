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
import { getInventoryLabel, getInventoryLabelMode, hasInventoryFeature, type SubscriptionPlanKey } from '@buildflow/shared';
import { useCustomers, type PartyRow } from '@/services/party.queries';
import { AdjustStockModal, OpeningStockModal } from '@/components/inventory/StockModals';
import { useWarehouses, useBarcodeLookup, type Warehouse } from '@/services/warehouse.queries';
import { useEffectiveRates } from '@/services/inventory-gtm.queries';
import DashboardCards from '@/components/inventory/DashboardCards';
import AnomalyStrip from '@/components/inventory/AnomalyStrip';
import { BarcodeScannerOverlay } from '@/components/inventory/BarcodeScannerOverlay';
import {
  useStockSummary,
  useStockMovements,
  useIssueStock,
  useAdjustStock,
  useImportOpeningStock,
  expansionKeys,
  type StockSummaryRow,
  type StockMovementRow,
  type AdjustStockInput,
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

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): multi-warehouse — the stock
  // home shows one warehouse at a time (default = company default location).
  const multiWarehouseEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'multi_warehouse',
  );
  const barcodeEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'barcode',
  );
  const { data: warehouses }: { data?: Warehouse[] } = useWarehouses();
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedLocationId && warehouses && warehouses.length > 0) {
      const def = warehouses.find((w) => w.isDefault);
      setSelectedLocationId(def?.id ?? warehouses[0].id);
    }
  }, [warehouses, selectedLocationId]);

  const { data: summary, isLoading, isFetching, refetch } = useStockSummary(projectId, selectedLocationId);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  /** When opened from a row CTA, prefill the multi sheet with this one material. */
  const [issueInitialResourceId, setIssueInitialResourceId] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const {
    data: movements,
    refetch: refetchMovements,
  } = useStockMovements(projectId, selectedResourceId ?? undefined, selectedLocationId);

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.4): barcode identify — type/paste a
  // barcode to jump to its item row.
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.2): camera barcode scanner overlay.
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeLookup = useBarcodeLookup(barcodeQuery);
  useEffect(() => {
    if (barcodeLookup.data) {
      setSelectedResourceId(barcodeLookup.data.id);
      setBarcodeQuery('');
      setBarcodeInput('');
      toast.success(`${barcodeLookup.data.name} found — highlighted below`);
    }
  }, [barcodeLookup.data]);
  useEffect(() => {
    if (barcodeQuery && barcodeLookup.isError) {
      setBarcodeQuery('');
      setBarcodeInput('');
      toast.error('No item found with this barcode');
    }
  }, [barcodeQuery, barcodeLookup.isError]);

  const issueStock = useIssueStock(projectId);
  const adjustStock = useAdjustStock();
  const importOpening = useImportOpeningStock();
  const [adjustRow, setAdjustRow] = useState<StockSummaryRow | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  // Phase 1.3/1.4 flags — shipped for INVENTORY this pass.
  const stockAdjustEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'stock_adjustments',
  );

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

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): profile-based wording.
  const labelMode = getInventoryLabelMode(user?.inventoryProfile ?? null);
  const itemLabel = getInventoryLabel('item', labelMode);
  const itemPluralLabel = getInventoryLabel('item_plural', labelMode);

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
          <Text className="text-sm text-muted mt-0.5">
            {user?.companyName}
            {multiWarehouseEnabled
              ? ` · ${warehouses?.find((w) => w.id === selectedLocationId)?.name ?? 'All stores'}`
              : ' · 1 store'}
          </Text>
        </View>
        {/* Desktop: compact toolbar (Materials + Bulk issue). Phone: same actions, wrap neatly. */}
        <View
          className={`flex-row items-center gap-2 ${isDesktop ? '' : 'flex-wrap'}`}
        >
          <Button
            label={itemPluralLabel}
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
          {stockAdjustEnabled ? (
            <Button
              label="Import opening stock"
              variant="secondary"
              size="sm"
              disabled={buffering}
              onPress={() => setOpeningOpen(true)}
            />
          ) : null}
        </View>
      </View>

      {(multiWarehouseEnabled || barcodeEnabled) ? (
        <View className="px-4 pb-3 flex-row flex-wrap items-center gap-2">
          {multiWarehouseEnabled ? (
            <View className="min-w-[180px] flex-1">
              <Select
                label="Warehouse"
                value={selectedLocationId}
                options={(warehouses ?? []).map((w) => ({ title: `${w.name}${w.isDefault ? ' (default)' : ''}`, value: w.id }))}
                onChange={(v) => v && setSelectedLocationId(v)}
                placeholder="All stores"
              />
            </View>
          ) : null}
          {barcodeEnabled ? (
            <View className="flex-1 min-w-[220px] flex-row items-end gap-2">
              <View className="flex-1">
                <Input
                  label="Barcode / scan"
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  placeholder="Type or paste a barcode"
                />
              </View>
              <Button
                label="Scan"
                variant="secondary"
                size="sm"
                onPress={() => setScannerOpen(true)}
              />
              <Button
                label="Find"
                variant="secondary"
                size="sm"
                disabled={!barcodeInput.trim() || buffering}
                onPress={() => setBarcodeQuery(barcodeInput.trim())}
              />
            </View>
          ) : null}
        </View>
      ) : null}

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
                  <Text className="text-xs text-muted">{itemPluralLabel}</Text>
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

              {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 6.1): executive dashboard. */}
              <View className="mt-3">
                <Text className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
                  Executive overview
                </Text>
                <DashboardCards />
              </View>

              {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 7.3): rules-first anomaly hints. */}
              <AnomalyStrip />

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
                            {m.batchCode ? ` · ${m.batchCode}` : ''}
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
            const isLowStock =
              item.reorderPoint != null && Number(item.reorderPoint) > 0 && Number(item.balance) < Number(item.reorderPoint);
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
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      <Text className="text-[11px] text-muted">{item.unit}</Text>
                      {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): WAC valuation. */}
                      {Number(item.unitCost) > 0 ? (
                        <Text className="text-[11px] text-muted">
                          · WAC ₹{Number(item.unitCost).toFixed(2)} · Value ₹{Number(item.inventoryValue).toFixed(2)}
                        </Text>
                      ) : null}
                      {isLowStock ? (
                        <Badge color="danger" label={`Low (reorder ${Number(item.reorderPoint)})`} />
                      ) : null}
                    </View>
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
                    {stockAdjustEnabled ? (
                      <Button
                        label="Adjust"
                        size="sm"
                        variant="secondary"
                        disabled={buffering}
                        onPress={() => setAdjustRow(item)}
                      />
                    ) : null}
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
        itemLabel={itemLabel}
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
            const result = await issueStock.mutateAsync({
              ...input,
              ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
            });
            await bufferUntil(
              async () => {
                await refetch();
                if (selectedResourceId) await refetchMovements();
                await qc.refetchQueries({ queryKey: ['invoices', 'list', projectId] });
              },
              () => {
                const rows =
                  (qc.getQueryData([...expansionKeys.stockSummary(projectId), selectedLocationId ?? 'all']) as
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

      <AdjustStockModal
        row={adjustRow}
        open={!!adjustRow}
        onClose={() => {
          if (!buffering) setAdjustRow(null);
        }}
        onSubmit={async (input) => {
          setBuffering(true);
          try {
            const result = await adjustStock.mutateAsync({
              ...input,
              ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
            });
            await refetch();
            if (selectedResourceId) await refetchMovements();
            toast.success(
              `Adjusted ${result.resourceName} by ${result.delta > 0 ? '+' : ''}${result.delta} ${result.unit} ` +
                `(${result.reason.replace(/_/g, ' ').toLowerCase()}) · on hand ${result.quantityOnHand}`,
            );
            setAdjustRow(null);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Adjustment failed');
            throw e;
          } finally {
            setBuffering(false);
          }
        }}
      />

      <OpeningStockModal
        open={openingOpen}
        onClose={() => {
          if (!buffering) setOpeningOpen(false);
        }}
        onSubmit={async (lines) => {
          setBuffering(true);
          try {
            const result = await importOpening.mutateAsync({
              lines,
              ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
            });
            await refetch();
            if (selectedResourceId) await refetchMovements();
            toast.success(
              result.applied > 0
                ? `Opening stock applied to ${result.applied} item(s)` +
                    (result.missed > 0 ? ` · ${result.missed} not matched` : '')
                : 'No items matched — check names/SKUs',
            );
            setOpeningOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Import failed');
            throw e;
          } finally {
            setBuffering(false);
          }
        }}
      />

      {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.2): camera barcode scan overlay. */}
      <BarcodeScannerOverlay
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setBarcodeInput(code);
          setBarcodeQuery(code);
          setScannerOpen(false);
          toast.success(`Scanned ${code} — finding item…`);
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
  itemLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  rows: StockSummaryRow[];
  initialResourceId?: string | null;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 0): 'Material' | 'Item'. */
  itemLabel: string;
  onClose: () => void;
  onSubmit: (input: {
    lines: Array<{ resourceId: string; quantity: number; unitPrice?: number; batchCode?: string }>;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): optional party-master link.
    customerId?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const { isPhone } = useViewport();
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): customer picker for the draft invoice.
  const { data: customers } = useCustomers();
  type DraftIssueLine = { key: string; resourceId: string; quantity: string; unitPrice: string; batchCode: string };
  const newKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [lines, setLines] = useState<DraftIssueLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): optional party-master link.
  const [customerId, setCustomerId] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): effective-rate prefill.
  const { data: effectiveRates } = useEffectiveRates(customerId || undefined);
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
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialResourceId]);

  /** Only materials with on-hand stock can be issued. */
  const issuable = rows.filter((r) => Number(r.balance) > 0);
  const itemLower = itemLabel.toLowerCase();

  const rowFor = (resourceId: string) => rows.find((r) => r.resourceId === resourceId);

  const updateLine = (key: string, patch: Partial<DraftIssueLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): when a customer is picked, apply
  // their price-list override to any line still priced at catalog.
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

  /** Options for one line exclude materials already picked on other lines. */
  const optionsFor = (line: DraftIssueLine) => {
    const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.resourceId));
    return issuable
      .filter((r) => !taken.has(r.resourceId))
      .map((r) => ({ title: `${r.name} (${r.balance} ${r.unit})`, value: r.resourceId }));
  };

  const submit = () => {
    setError(null);
    const itemLower = itemLabel.toLowerCase();
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
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): optional batch / lot code.
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
                      {initialResourceId ? itemLabel : `${itemLabel} ${idx + 1}`}
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
                    label={itemLabel}
                    value={line.resourceId || undefined}
                    onChange={(v) => {
                      if (!v) return;
                      // Double-guard duplicates (options already exclude them).
                      if (lines.some((l) => l.key !== line.key && l.resourceId === v)) {
                        setError(`Each ${itemLower} can be issued only once.`);
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
                    placeholder={`Choose ${itemLower}`}
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
                  {/* INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): batch / lot code (lite). */}
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
            {/* Bulk issue only — hidden when opened from a per-row Issue CTA. */}
            {!initialResourceId ? (
              <>
                <Button
                  label={`+ Add ${itemLower}`}
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
                    ? `All on-hand ${itemLower}s are already on this list.`
                    : `Add another on-hand ${itemLower} to this same issue.`}
                </Text>
              </>
            ) : null}
            <View className="h-3" />
            <Select
              // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): link the draft invoice to a party.
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
            <Input
              label="Customer name (optional)"
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
