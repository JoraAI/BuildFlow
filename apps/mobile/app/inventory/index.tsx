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
import { Card, Badge, Button, EmptyState, LoadingSkeleton, Input, toast } from '@/components/ui';
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
  const [issueRow, setIssueRow] = useState<StockSummaryRow | null>(null);
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

      <View className="px-4 pt-4 pb-2 flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-text">Stock</Text>
          <Text className="text-sm text-muted mt-0.5">{user?.companyName} · 1 store</Text>
        </View>
        <Button
          label="Materials"
          variant="secondary"
          size="sm"
          disabled={buffering}
          onPress={() => router.push('/inventory/materials' as never)}
        />
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
                      onPress={() => setIssueRow(item)}
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

      <IssueStockModal
        row={issueRow}
        open={!!issueRow}
        submitting={issueStock.isPending || buffering}
        onClose={() => {
          if (!buffering) setIssueRow(null);
        }}
        onSubmit={async (qty, unitPrice, customerName, notes) => {
          if (!issueRow) return;
          const resourceId = issueRow.resourceId;
          const prevBalance = Number(issueRow.balance);
          setBuffering(true);
          try {
            const result = await issueStock.mutateAsync({
              resourceId,
              quantity: qty,
              unitPrice,
              customerName,
              notes,
            });
            await bufferUntil(
              async () => {
                await refetch();
                if (selectedResourceId === resourceId) await refetchMovements();
                await qc.refetchQueries({ queryKey: ['invoices', 'list', projectId] });
              },
              () => {
                const rows =
                  (qc.getQueryData(expansionKeys.stockSummary(projectId)) as
                    | StockSummaryRow[]
                    | undefined) ?? [];
                const row = rows.find((r) => r.resourceId === resourceId);
                if (!row) return false;
                return Number(row.balance) <= prevBalance - qty + 0.001;
              },
            );
            toast.success(
              result.draftInvoiceId
                ? `Issued ${qty} ${issueRow.unit} · draft invoice created`
                : `Issued ${qty} ${issueRow.unit} of ${issueRow.name}`,
            );
            setIssueRow(null);
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

function IssueStockModal({
  row,
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  row: StockSummaryRow | null;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (
    qty: number,
    unitPrice: number,
    customerName?: string,
    notes?: string,
  ) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && row) {
      setQty('');
      setUnitPrice(
        row.catalogRate != null && Number(row.catalogRate) > 0 ? String(row.catalogRate) : '',
      );
      setCustomerName('');
      setNotes('');
      setError(null);
    }
  }, [open, row?.resourceId, row?.catalogRate]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={submitting ? undefined : onClose}>
      <Pressable
        className="flex-1 bg-black/40 justify-end"
        onPress={submitting ? undefined : onClose}
      >
        <Pressable className="bg-card rounded-t-2xl p-4" onPress={(e) => e.stopPropagation()}>
          <Text className="text-lg font-bold text-text mb-1">Issue stock</Text>
          <Text className="text-sm text-muted mb-3">
            {row?.name} · on hand {row?.balance} {row?.unit}. Set your selling price for the draft
            invoice (ex-GST).
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input
              label={`Quantity (${row?.unit ?? ''})`}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Input
              label="Selling price / unit (₹, ex-GST)"
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
              placeholder={
                row?.catalogRate != null ? `Catalog ₹${row.catalogRate}` : 'Enter your price'
              }
            />
            <Input
              label="Customer (optional)"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Defaults to Walk-in customer"
            />
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
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
                label={submitting ? 'Issuing…' : 'Issue'}
                variant="accent"
                className="flex-1"
                disabled={submitting}
                loading={submitting}
                onPress={() => {
                  const n = Number(qty);
                  const price = Number(unitPrice);
                  if (!Number.isFinite(n) || n <= 0) {
                    setError('Enter a positive quantity');
                    return;
                  }
                  if (row && n > Number(row.balance)) {
                    setError(`Only ${row.balance} ${row.unit} available`);
                    return;
                  }
                  if (!Number.isFinite(price) || price < 0) {
                    setError('Enter a selling price (0 or more)');
                    return;
                  }
                  setError(null);
                  void onSubmit(
                    n,
                    price,
                    customerName.trim() || undefined,
                    notes.trim() || undefined,
                  );
                }}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
