/**
 * Inventory shell - Stock home.
 *
 * Stock summary for the tenant's default STORE project. Tap an item for history.
 * Supports manual stock issue (OUT) with selling price → draft sales invoice.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, EmptyState, LoadingSkeleton, Input, Select, toast, BusyOverlay } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { useRouter } from 'expo-router';
import { getInventoryLabel, getInventoryLabelMode, hasInventoryFeature, type SubscriptionPlanKey } from '@buildflow/shared';
import { AdjustStockModal, OpeningStockModal, MultiIssueStockModal } from '@/components/inventory/StockModals';
import { inventoryStockItemHref } from '@/utils/navigation-paths';
import { useWarehouses, useBarcodeLookup, type Warehouse } from '@/services/warehouse.queries';
import DashboardCards from '@/components/inventory/DashboardCards';
import AnomalyStrip from '@/components/inventory/AnomalyStrip';
import { BarcodeScannerOverlay } from '@/components/inventory/BarcodeScannerOverlay';
import {
  useStockSummary,
  useIssueStock,
  useAdjustStock,
  useImportOpeningStock,
  expansionKeys,
  type StockSummaryRow,
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

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): multi-warehouse - the stock
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
  const [issueOpen, setIssueOpen] = useState(false);
  /** When opened from a row CTA, prefill the multi sheet with this one material. */
  const [issueInitialResourceId, setIssueInitialResourceId] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.4): barcode identify - type/paste a
  // barcode to jump to its item row.
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.2): camera barcode scanner overlay.
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeLookup = useBarcodeLookup(barcodeQuery);
  useEffect(() => {
    if (barcodeLookup.data) {
      const id = barcodeLookup.data.id;
      const name = barcodeLookup.data.name;
      setBarcodeQuery('');
      setBarcodeInput('');
      toast.success(`${name} found`);
      router.push(inventoryStockItemHref(id, selectedLocationId) as never);
    }
  }, [barcodeLookup.data, router, selectedLocationId]);
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
  // Phase 1.3/1.4 flags - shipped for INVENTORY this pass.
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
  };

  return (
    <View className="flex-1 bg-surface">
      <BusyOverlay
        visible={buffering}
        title="Updating stock…"
        subtitle="Please wait until stock and the sale refresh. Do not tap again."
      />

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

              <Text className="text-sm font-bold text-text mt-4 mb-2">Stock summary</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isLowStock =
              item.reorderPoint != null && Number(item.reorderPoint) > 0 && Number(item.balance) < Number(item.reorderPoint);
            return (
              <Pressable
                disabled={buffering}
                onPress={() => router.push(inventoryStockItemHref(item.resourceId, selectedLocationId) as never)}
                className="px-4 py-3"
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
                await qc.refetchQueries({ queryKey: ['invoices', 'list', projectId] });
                await qc.refetchQueries({ queryKey: ['transactions', 'sales-orders'] });
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
              result.draftInvoiceId
                ? `Issued ${names} · counter sale is on Sales · draft invoice created`
                : `Issued ${names}`,
            );
            setIssueOpen(false);
            setIssueInitialResourceId(null);
            if (result.draftInvoiceId) router.push('/inventory/invoices' as never);
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
            toast.success(
              result.applied > 0
                ? `Opening stock applied to ${result.applied} item(s)` +
                    (result.missed > 0 ? ` · ${result.missed} not matched` : '')
                : 'No items matched - check names/SKUs',
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
          toast.success(`Scanned ${code} - finding item…`);
        }}
      />
    </View>
  );
}
