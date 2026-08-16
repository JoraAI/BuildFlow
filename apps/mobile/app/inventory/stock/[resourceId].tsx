/**
 * Inventory shell - single stock item (balance + movement history).
 * Route: /inventory/stock/[resourceId]
 */
import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Button, EmptyState, Input, LoadingSkeleton, toast, BusyOverlay } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useAuthStore } from '@/stores/auth.store';
import { useViewport } from '@/hooks/useViewport';
import { navigateAppBack, parseReturnTo } from '@/utils/navigation';
import { getInventoryLabel, getInventoryLabelMode, hasInventoryFeature, type SubscriptionPlanKey } from '@buildflow/shared';
import { AdjustStockModal, MultiIssueStockModal } from '@/components/inventory/StockModals';
import {
  useStockSummary,
  useStockMovements,
  useIssueStock,
  useAdjustStock,
  useResourceBatches,
  useUpdateBatchMetadata,
  expansionKeys,
  type StockSummaryRow,
  type StockMovementRow,
  type ResourceBatchRow,
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

export default function InventoryStockItemScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const projectId = user?.defaultProjectId ?? '';
  const { resourceId, locationId: locationParam, returnTo: returnToParam } = useLocalSearchParams<{
    resourceId: string;
    locationId?: string;
    returnTo?: string;
  }>();
  const locationId = typeof locationParam === 'string' && locationParam ? locationParam : undefined;
  const returnTo = parseReturnTo(returnToParam);
  const goBack = () => navigateAppBack('/inventory', returnTo);

  const labelMode = getInventoryLabelMode(user?.inventoryProfile ?? null);
  const itemLabel = getInventoryLabel('item', labelMode);
  const stockAdjustEnabled = hasInventoryFeature(
    (user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey,
    'stock_adjustments',
  );
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch/expiry surfaces are
  // Kirana-vertical-only (K10) - no fetch/no UI for other inventory types.
  const batchExpiryEnabled =
    hasInventoryFeature((user?.subscriptionPlan ?? 'INVENTORY') as SubscriptionPlanKey, 'batch_expiry') &&
    user?.inventoryVertical === 'KIRANA';

  const { data: summary, refetch: refetchSummary } = useStockSummary(projectId, locationId);
  const {
    data: movements,
    isLoading,
    isFetching,
    refetch: refetchMovements,
  } = useStockMovements(projectId, resourceId, locationId);
  const { data: batches, refetch: refetchBatches } = useResourceBatches(
    batchExpiryEnabled ? resourceId : undefined,
    locationId,
  );
  const row = (summary ?? []).find((r: StockSummaryRow) => r.resourceId === resourceId) ?? null;

  const issueStock = useIssueStock(projectId);
  const adjustStock = useAdjustStock();
  const updateBatch = useUpdateBatchMetadata(resourceId);
  const [issueOpen, setIssueOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ResourceBatchRow | null>(null);
  const [batchMfg, setBatchMfg] = useState('');
  const [batchExp, setBatchExp] = useState('');

  const onRefresh = () => {
    void refetchSummary();
    void refetchMovements();
    if (batchExpiryEnabled) void refetchBatches();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={isDesktop ? [] : ['bottom']}>
      <BusyOverlay visible={buffering} title="Updating stock…" />
      <OfflineBanner />
      <FormScreenHeader
        title={row?.name ?? itemLabel}
        subtitle={row ? `${row.balance} ${row.unit} on hand` : 'Movement history'}
        cancelLabel="Back"
        onCancel={goBack}
        showBack
      />

      {isLoading && !movements ? (
        <View className="px-4 pt-4 gap-3">
          <LoadingSkeleton className="h-24 rounded-xl" />
          <LoadingSkeleton className="h-48 rounded-xl" />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={movements ?? []}
          keyExtractor={(m: StockMovementRow) => m.id}
          refreshControl={
            <RefreshControl refreshing={isFetching && !buffering} onRefresh={onRefresh} tintColor="#1E3A5F" />
          }
          ListHeaderComponent={
            <View className="px-4 pt-4 pb-2">
              <View className={`flex-row gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
                <Card className="flex-1 min-w-[120px] p-4">
                  <Text className="text-xs text-muted">On hand</Text>
                  <Text className="text-2xl font-bold text-primary">{row?.balance ?? '-'}</Text>
                  <Text className="text-[11px] text-muted mt-0.5">{row?.unit ?? ''}</Text>
                </Card>
                <Card className="flex-1 min-w-[120px] p-4">
                  <Text className="text-xs text-muted">Received</Text>
                  <Text className="text-2xl font-bold text-success">{row?.received ?? '-'}</Text>
                </Card>
                <Card className="flex-1 min-w-[120px] p-4">
                  <Text className="text-xs text-muted">Issued</Text>
                  <Text className="text-2xl font-bold text-danger">{row?.issued ?? '-'}</Text>
                </Card>
              </View>
              {row && Number(row.unitCost) > 0 ? (
                <Text className="text-xs text-muted mt-3">
                  WAC ₹{Number(row.unitCost).toFixed(2)} · Value ₹{Number(row.inventoryValue).toFixed(2)}
                  {row.reorderPoint != null && Number(row.reorderPoint) > 0
                    ? ` · Reorder at ${row.reorderPoint}`
                    : ''}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2 mt-3">
                <Button
                  label="Issue"
                  variant="accent"
                  size="sm"
                  disabled={buffering || !row || Number(row.balance) <= 0}
                  onPress={() => setIssueOpen(true)}
                />
                {stockAdjustEnabled ? (
                  <Button
                    label="Adjust"
                    variant="secondary"
                    size="sm"
                    disabled={buffering || !row}
                    onPress={() => setAdjustOpen(true)}
                  />
                ) : null}
              </View>
              {batchExpiryEnabled && batches && batches.length > 0 ? (
                <View className="mt-5">
                  <Text className="text-sm font-bold text-text mb-2">Batches &amp; expiry</Text>
                  <Card className="p-4">
                    {batches.map((b: ResourceBatchRow, idx: number) => (
                      <View
                        key={b.id}
                        className={idx === 0 ? '' : 'border-t border-border/60 mt-2 pt-2'}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-text font-semibold">{b.batchCode}</Text>
                          <Badge
                            color={
                              b.bucket === 'EXPIRED'
                                ? 'danger'
                                : b.bucket === '0_30'
                                  ? 'warning'
                                  : 'neutral'
                            }
                            label={
                              b.bucket === 'EXPIRED'
                                ? 'Expired'
                                : b.bucket === '0_30'
                                  ? `${b.daysToExpiry} d left`
                                  : b.expiresAt
                                    ? new Date(b.expiresAt).toLocaleDateString('en-IN')
                                    : 'No expiry'
                            }
                          />
                        </View>
                        <Text className="text-[11px] text-muted mt-1">
                          {b.quantity} {row?.unit ?? ''} · {b.locationName}
                          {b.manufacturedAt
                            ? ` · mfg ${new Date(b.manufacturedAt).toLocaleDateString('en-IN')}`
                            : ''}
                          {b.expiresAt
                            ? ` · exp ${new Date(b.expiresAt).toLocaleDateString('en-IN')}`
                            : ''}
                        </Text>
                        <Button
                          label="Edit dates"
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setEditingBatch(b);
                            setBatchMfg(b.manufacturedAt?.slice(0, 10) ?? '');
                            setBatchExp(b.expiresAt?.slice(0, 10) ?? '');
                          }}
                        />
                      </View>
                    ))}
                  </Card>
                </View>
              ) : null}
              <Text className="text-sm font-bold text-text mt-5 mb-2">Movement history</Text>
            </View>
          }
          renderItem={({ item: m }: { item: StockMovementRow }) => (
            <View className="px-4">
              <View className="flex-row items-center justify-between py-2.5 border-b border-border/60">
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-sm text-text" numberOfLines={1}>
                    {m.referenceLabel ?? m.referenceType ?? 'Movement'}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    {m.locationName} · {new Date(m.createdAt).toLocaleString('en-IN')}
                    {m.batchCode ? ` · ${m.batchCode}` : ''}
                    {m.notes ? ` · ${m.notes}` : ''}
                  </Text>
                </View>
                <Badge
                  color={m.type === 'IN' ? 'success' : 'danger'}
                  label={`${m.type === 'IN' ? '+' : '-'}${m.quantity} ${m.unit}`}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View className="px-4 pt-2">
              <EmptyState title="No movements yet" description="GRNs, issues, adjustments and transfers for this item will show here." />
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      <MultiIssueStockModal
        open={issueOpen}
        submitting={issueStock.isPending || buffering}
        rows={summary ?? []}
        initialResourceId={resourceId}
        itemLabel={itemLabel}
        onClose={() => {
          if (!buffering) setIssueOpen(false);
        }}
        onSubmit={async (input) => {
          const prevBalances = new Map<string, number>();
          for (const l of input.lines) {
            const r = (summary ?? []).find((x: StockSummaryRow) => x.resourceId === l.resourceId);
            prevBalances.set(l.resourceId, r ? Number(r.balance) : 0);
          }
          setBuffering(true);
          try {
            const result = await issueStock.mutateAsync({
              ...input,
              ...(locationId ? { locationId } : {}),
            });
            await bufferUntil(
              async () => {
                await refetchSummary();
                await refetchMovements();
                await qc.refetchQueries({ queryKey: ['invoices', 'list', projectId] });
                await qc.refetchQueries({ queryKey: ['transactions', 'sales-orders'] });
              },
              () => {
                const rows =
                  (qc.getQueryData([...expansionKeys.stockSummary(projectId), locationId ?? 'all']) as
                    | StockSummaryRow[]
                    | undefined) ?? [];
                return input.lines.every((l) => {
                  const prev = prevBalances.get(l.resourceId) ?? 0;
                  const next = rows.find((r) => r.resourceId === l.resourceId);
                  if (!next) return false;
                  return Number(next.balance) <= prev - l.quantity + 0.001;
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
            if (result.draftInvoiceId) router.push('/inventory/invoices' as never);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Issue failed');
            throw e;
          } finally {
            setBuffering(false);
          }
        }}
      />
      <Modal visible={editingBatch !== null} transparent animationType="fade" onRequestClose={() => setEditingBatch(null)}>
        <Pressable className="flex-1 bg-black/40 items-center justify-center p-4" onPress={() => setEditingBatch(null)}>
          <Pressable className="bg-card rounded-2xl p-4 w-full max-w-md" onPress={(e) => e.stopPropagation()}>
            <Text className="text-lg font-bold text-text">Edit batch dates</Text>
            <Text className="text-xs text-muted mb-3">{editingBatch?.batchCode} · quantity is not changed</Text>
            <Input label="Manufacture date (YYYY-MM-DD, optional)" value={batchMfg} onChangeText={setBatchMfg} />
            <Input label="Expiry date (YYYY-MM-DD, optional)" value={batchExp} onChangeText={setBatchExp} />
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => setEditingBatch(null)} />
              <Button
                label="Save dates"
                variant="accent"
                className="flex-1"
                loading={updateBatch.isPending}
                onPress={() => {
                  if (!editingBatch) return;
                  if (batchMfg && batchExp && batchExp < batchMfg) {
                    toast.error('Expiry date must be after manufacture date');
                    return;
                  }
                  void updateBatch.mutateAsync({
                    id: editingBatch.id,
                    manufacturedAt: batchMfg || null,
                    expiresAt: batchExp || null,
                  }).then(() => {
                    toast.success('Batch dates updated');
                    setEditingBatch(null);
                  }).catch((e) => toast.error(e instanceof Error ? e.message : 'Could not update dates'));
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AdjustStockModal
        row={row}
        open={adjustOpen}
        onClose={() => {
          if (!buffering) setAdjustOpen(false);
        }}
        onSubmit={async (input) => {
          setBuffering(true);
          try {
            const result = await adjustStock.mutateAsync({
              ...input,
              ...(locationId ? { locationId } : {}),
            });
            await refetchSummary();
            await refetchMovements();
            toast.success(
              `Adjusted ${result.resourceName} by ${result.delta > 0 ? '+' : ''}${result.delta} ${result.unit} ` +
                `(${result.reason.replace(/_/g, ' ').toLowerCase()}) · on hand ${result.quantityOnHand}`,
            );
            setAdjustOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Adjustment failed');
            throw e;
          } finally {
            setBuffering(false);
          }
        }}
      />
    </SafeAreaView>
  );
}
