/**
 * BuildFlow - Inventory analytics reports (INVENTORY_HORIZONTAL_PLATFORM Phase 6).
 *
 * Route: /inventory/reports (entry from Settings → "Reports & analytics").
 *
 * Tabs:
 *   1. Stock health - dead/slow/active classification with days + warehouse filters.
 *   2. Warehouse value - per-location inventory value (qty × WAC).
 *   3. Margins - revenue − WAC×qty sold per item.
 *   4. Purchase history - last buy rate vs current WAC.
 *
 * Responsive: cards flex-wrap / min-w, phone-stacked (no desktop-only tables).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Badge, Button, Select, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import {
  useStockHealthReport,
  useWarehouseValueReport,
  useMarginReport,
  usePurchaseHistoryReport,
  type StockHealthRow,
  type WarehouseValueRow,
  type MarginRow,
  type PurchaseHistoryRow,
} from '@/services/inventory-analytics.queries';
import { formatINR, formatINRCompact, formatDate } from '@/utils/format';

type Tab = 'health' | 'warehouse' | 'margin' | 'purchase';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'health', label: 'Stock health' },
  { key: 'warehouse', label: 'Warehouse value' },
  { key: 'margin', label: 'Margins' },
  { key: 'purchase', label: 'Purchase history' },
];

const CLASSIFICATION_BADGE: Record<
  StockHealthRow['classification'],
  { color: 'success' | 'warning' | 'danger'; label: string }
> = {
  ACTIVE: { color: 'success', label: 'Active' },
  SLOW: { color: 'warning', label: 'Slow' },
  DEAD: { color: 'danger', label: 'Dead' },
};

export default function InventoryReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState<Tab>('health');
  /** Stock-health filters (Phase 6.2). */
  const [days, setDays] = useState(90);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);

  const { data: warehouses } = useWarehouses();
  const stockHealth = useStockHealthReport(days, locationId);
  const warehouseValue = useWarehouseValueReport();
  const margin = useMarginReport();
  const purchase = usePurchaseHistoryReport();

  const warehouseTotal = useMemo(
    () => (warehouseValue.data ?? []).reduce((s: number, r: WarehouseValueRow) => s + Number(r.value), 0),
    [warehouseValue.data],
  );

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Back header */}
      <View className="px-6 py-4 border-b border-border flex-row items-center gap-3 shrink-0">
        <Button label="← Back" variant="ghost" size="sm" onPress={() => router.back()} />
        <Text className="text-xl font-bold text-text flex-1" numberOfLines={1}>
          Reports & analytics
        </Text>
      </View>

      {/* Sub-tabs (horizontal scroll keeps the shell's 9-tab bar untouched). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="shrink-0 border-b border-border">
        <View className="flex-row items-center gap-1 px-4 py-2">
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 ${tab === t.key ? 'bg-primary' : 'bg-surface'}`}
            >
              <Text className={`text-sm font-semibold ${tab === t.key ? 'text-accent' : 'text-muted'}`}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === 'health' ? (
          <>
            {/* Filters (Phase 6.2): warehouse + days. */}
            <View className={`flex-row gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
              <View className="min-w-[170px] flex-1">
                <Select
                  label="Warehouse"
                  value={locationId}
                  options={(warehouses ?? []).map((w: Warehouse) => ({ title: w.name, value: w.id }))}
                  onChange={(v) => setLocationId(v ?? undefined)}
                  placeholder="All stores"
                />
              </View>
              <View className="min-w-[150px] flex-1">
                <Select
                  label="Dead after (days)"
                  value={String(days)}
                  options={[
                    { title: '30 days', value: '30' },
                    { title: '90 days', value: '90' },
                    { title: '180 days', value: '180' },
                    { title: '365 days', value: '365' },
                  ]}
                  onChange={(v) => v && setDays(Number(v))}
                />
              </View>
            </View>

            {stockHealth.isLoading ? (
              <LoadingSkeleton className="rounded-xl h-20" />
            ) : (stockHealth.data ?? []).length === 0 ? (
              <EmptyState title="No stocked items" description="Items with on-hand stock will appear here." />
            ) : (
              (stockHealth.data ?? []).map((row: StockHealthRow) => {
                const badge = CLASSIFICATION_BADGE[row.classification];
                return (
                  <Card key={row.resourceId} className="p-4">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text className="text-[11px] text-muted mt-0.5">
                          {row.unit} · on hand {row.onHand}
                          {row.daysSinceLastOut != null
                            ? ` · no issue for ${row.daysSinceLastOut}d`
                            : ' · never issued'}
                        </Text>
                      </View>
                      <Badge color={badge.color} label={badge.label} />
                    </View>
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-border/60">
                      <Text className="text-xs text-muted">WAC {formatINR(row.unitCost)}</Text>
                      <Text className="text-sm font-bold text-text">{formatINRCompact(row.value)}</Text>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        ) : null}

        {tab === 'warehouse' ? (
          <>
            <Card className="p-4 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-text">Total inventory value</Text>
              <Text className="text-xl font-bold text-primary">{formatINR(warehouseTotal)}</Text>
            </Card>
            {warehouseValue.isLoading ? (
              <LoadingSkeleton className="rounded-xl h-20" />
            ) : (warehouseValue.data ?? []).length === 0 ? (
              <EmptyState title="No warehouses" description="Create a warehouse to see per-location value." />
            ) : (
              (warehouseValue.data ?? []).map((loc: WarehouseValueRow) => (
                <Card key={loc.locationId} className="p-4">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                      {loc.name}
                    </Text>
                    <Text className="text-lg font-bold text-text">{formatINRCompact(loc.value)}</Text>
                  </View>
                  <Text className="text-[11px] text-muted mt-1">{loc.itemCount} stocked items</Text>
                </Card>
              ))
            )}
          </>
        ) : null}

        {tab === 'margin' ? (
          margin.isLoading ? (
            <LoadingSkeleton className="rounded-xl h-20" />
          ) : (margin.data ?? []).length === 0 ? (
            <EmptyState
              title="No sales yet"
              description="Margin appears once you issue or dispatch stock (revenue − WAC×qty sold)."
            />
          ) : (
            (margin.data ?? []).map((row: MarginRow) => (
              <Card key={row.resourceId} className="p-4">
                <View className="flex-row justify-between items-center gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      Sold {row.qtySold} {row.unit} · revenue {formatINR(row.revenue)} · COGS {formatINR(row.cogs)}
                    </Text>
                  </View>
                  <Badge
                    color={row.margin >= 0 ? 'success' : 'danger'}
                    label={`${row.marginPct.toFixed(1)}%`}
                  />
                </View>
                <View className="flex-row justify-between mt-2 pt-2 border-t border-border/60">
                  <Text className="text-xs text-muted">Margin</Text>
                  <Text className={`text-sm font-bold ${row.margin >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatINR(row.margin)}
                  </Text>
                </View>
              </Card>
            ))
          )
        ) : null}

        {tab === 'purchase' ? (
          purchase.isLoading ? (
            <LoadingSkeleton className="rounded-xl h-20" />
          ) : (purchase.data ?? []).length === 0 ? (
            <EmptyState title="No purchase history" description="Items with a GRN or an average cost appear here." />
          ) : (
            (purchase.data ?? []).map((row: PurchaseHistoryRow) => (
              <Card key={row.resourceId} className="p-4">
                <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                  {row.name}
                </Text>
                <View className="flex-row justify-between mt-2">
                  <Text className="text-xs text-muted">Last buy</Text>
                  <Text className="text-sm font-semibold text-text">
                    {row.lastBuyRate ? formatINR(row.lastBuyRate) : '-'}
                    {row.lastBuyDate ? ` · ${formatDate(row.lastBuyDate)}` : ''}
                  </Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-xs text-muted">Current WAC</Text>
                  <Text className="text-sm font-semibold text-text">{formatINR(row.currentWac)}</Text>
                </View>
                <View className="flex-row justify-between mt-1 pt-2 border-t border-border/60">
                  <Text className="text-xs text-muted">WAC vs last buy</Text>
                  <Text
                    className={`text-sm font-bold ${row.wacVsLastBuy > 0 ? 'text-danger' : 'text-success'}`}
                  >
                    {row.wacVsLastBuy >= 0 ? '+' : ''}
                    {formatINR(row.wacVsLastBuy)}
                  </Text>
                </View>
              </Card>
            ))
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

