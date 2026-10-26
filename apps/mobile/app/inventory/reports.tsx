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
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Badge, Button, Select, EmptyState, LoadingSkeleton, toast } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useWarehouses, type Warehouse } from '@/services/warehouse.queries';
import {
  useStockHealthReport,
  useWarehouseValueReport,
  useMarginReport,
  usePurchaseHistoryReport,
  useProfitLossReport,
  downloadInventoryExcel,
  type StockHealthRow,
  type WarehouseValueRow,
  type MarginRow,
  type PurchaseHistoryRow,
} from '@/services/inventory-analytics.queries';
import { formatINR, formatINRCompact, formatDate } from '@/utils/format';
import { useInventoryLanguage } from '@/components/inventory/InventoryLanguageProvider';
import { SegmentedTabs } from '@/components/inventory/SegmentedTabs';
import { InventoryHubCard } from '@/components/inventory/InventoryHubCard';
import {
  INVENTORY_REPORT_LINKS,
  isInventoryReportView,
  type InventoryExcelReport,
  type InventoryReportView,
} from '@/components/inventory/inventory-report-links';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';

type Tab = 'health' | 'warehouse' | 'margin' | 'purchase' | 'pnl';

const TABS = [
  { value: 'health' as const, label: 'Stock health' },
  { value: 'warehouse' as const, label: 'Warehouse value' },
  { value: 'margin' as const, label: 'Margins' },
  { value: 'purchase' as const, label: 'Purchase history' },
  { value: 'pnl' as const, label: 'P&L' },
];

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const CLASSIFICATION_BADGE: Record<
  StockHealthRow['classification'],
  { color: 'success' | 'warning' | 'danger'; label: string }
> = {
  ACTIVE: { color: 'success', label: 'Active' },
  SLOW: { color: 'warning', label: 'Slow' },
  DEAD: { color: 'danger', label: 'Dead' },
};

export default function InventoryReportsScreen() {
  const { translate } = useInventoryLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop, isPhone } = useViewport();
  const params = useLocalSearchParams<{ view?: string | string[] }>();
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;
  const selectedView = isInventoryReportView(viewParam) ? viewParam : undefined;
  const [tab, setTab] = useState<Tab>(selectedView ?? 'health');

  useEffect(() => {
    if (selectedView) setTab(selectedView);
  }, [selectedView]);

  const openReport = (view: InventoryReportView) => {
    router.setParams({ view });
    setTab(view);
  };
  /** Stock-health filters (Phase 6.2). */
  const [excelBusy, setExcelBusy] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);

  const exportExcel = async (report: InventoryExcelReport, opts?: { from?: string; to?: string }) => {
    setExcelBusy(report);
    try {
      await downloadInventoryExcel(report, opts);
      toast.success('Excel ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExcelBusy(null);
    }
  };

  const { data: warehouses } = useWarehouses();
  const stockHealth = useStockHealthReport(days, locationId);
  const warehouseValue = useWarehouseValueReport();
  const margin = useMarginReport();
  const purchase = usePurchaseHistoryReport();
  const [pnlFrom] = useState(monthStartISO());
  const [pnlTo] = useState(todayISO());
  const pnl = useProfitLossReport(pnlFrom, pnlTo, tab === 'pnl');

  const warehouseTotal = useMemo(
    () => (warehouseValue.data ?? []).reduce((s: number, r: WarehouseValueRow) => s + Number(r.value), 0),
    [warehouseValue.data],
  );

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Back header */}
      <View className="px-6 py-4 border-b border-border flex-row items-center gap-3 shrink-0">
        <Button
          label="← Back"
          variant="ghost"
          size="sm"
          onPress={() => (selectedView ? router.replace('/inventory/reports' as never) : router.back())}
        />
        <Text className="text-xl font-bold text-text flex-1" numberOfLines={1}>
          {translate('inventory.page.reports', 'Reports & analytics')}
        </Text>
      </View>

      {!selectedView ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 24 : 16,
            paddingBottom: isPhone ? mobileListBottomPadding() + 24 : 48,
            gap: 12,
            maxWidth: isDesktop ? 960 : undefined,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text className="text-sm text-muted">
            Open a report on screen, or download Excel from the same card.
          </Text>
          <View className={`flex-row flex-wrap ${isDesktop ? 'gap-3' : 'gap-2'}`}>
            {INVENTORY_REPORT_LINKS.map((link) => (
              <View key={link.view} className={isDesktop ? 'w-[48%]' : 'w-full'}>
                <InventoryHubCard
                  icon={link.icon}
                  title={link.title}
                  subtitle={link.subtitle}
                  meta="Open"
                  onPress={() => openReport(link.view)}
                  onDownload={link.excel ? () => void exportExcel(link.excel!) : undefined}
                  downloadBusy={excelBusy === link.excel}
                />
              </View>
            ))}
            <View className={isDesktop ? 'w-[48%]' : 'w-full'}>
              <InventoryHubCard
                icon="download-outline"
                title="Expenses"
                subtitle="Cash book expenses by category"
                meta="Excel"
                onPress={() => void exportExcel('expenses')}
                onDownload={() => void exportExcel('expenses')}
                downloadBusy={excelBusy === 'expenses'}
              />
            </View>
          </View>
          <Text className="text-sm font-semibold text-text mt-2">Related</Text>
          <View className={`flex-row flex-wrap ${isDesktop ? 'gap-3' : 'gap-2'}`}>
            <View className={isDesktop ? 'w-[48%]' : 'w-full'}>
              <InventoryHubCard
                icon="wallet-outline"
                title="Cash book"
                subtitle="Daily in, out, and expenses"
                onPress={() => router.push('/inventory/cash' as never)}
              />
            </View>
            <View className={isDesktop ? 'w-[48%]' : 'w-full'}>
              <InventoryHubCard
                icon="document-text-outline"
                title="Invoices"
                subtitle="Sales invoices and collections"
                onPress={() => router.push('/inventory/invoices' as never)}
              />
            </View>
            <View className={isDesktop ? 'w-[48%]' : 'w-full'}>
              <InventoryHubCard
                icon="newspaper-outline"
                title="Bills"
                subtitle="Vendor bills and payments"
                onPress={() => router.push('/inventory/bills' as never)}
              />
            </View>
            <View className={isDesktop ? 'w-[48%]' : 'w-full'}>
              <InventoryHubCard
                icon="cloud-upload-outline"
                title="Backup"
                subtitle="Download a shop snapshot"
                onPress={() => router.push('/inventory/backup' as never)}
              />
            </View>
          </View>
        </ScrollView>
      ) : null}

      {selectedView ? (
        <>
      <SegmentedTabs
        tabs={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          router.setParams({ view: next });
        }}
        className="border-b border-border"
        contentContainerClassName="px-4 gap-2 py-2"
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: isPhone ? mobileListBottomPadding() + 16 : 48,
        }}
      >
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
            <Button
              label={excelBusy === 'stock-health' ? 'Preparing…' : 'Download Excel'}
              variant="secondary"
              size="sm"
              disabled={excelBusy != null}
              onPress={() => void exportExcel('stock-health')}
            />

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
          <>
            <Button
              label={excelBusy === 'margin' ? 'Preparing…' : 'Download Excel'}
              variant="secondary"
              size="sm"
              disabled={excelBusy != null}
              onPress={() => void exportExcel('margin')}
            />
          {margin.isLoading ? (
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
          )}
          </>
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

        {tab === 'pnl' ? (
          pnl.isLoading ? (
            <LoadingSkeleton className="rounded-xl h-24" />
          ) : !pnl.data ? (
            <EmptyState title="No P&L data" description="Sales, stock issues, and cash expenses feed this estimate." />
          ) : (
            <>
              <Card className="p-4 gap-2">
                <Text className="text-xs text-muted">
                  {pnl.data.from} → {pnl.data.to}
                </Text>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Sales</Text>
                  <Text className="text-sm font-bold text-text">{formatINR(pnl.data.sales)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">COGS</Text>
                  <Text className="text-sm font-bold text-text">{formatINR(pnl.data.cogs)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Gross margin</Text>
                  <Text className="text-sm font-bold text-text">{formatINR(pnl.data.grossMargin)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Expenses</Text>
                  <Text className="text-sm font-bold text-danger">{formatINR(pnl.data.expenses)}</Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-border/60">
                  <Text className="text-sm font-semibold text-text">Estimated profit</Text>
                  <Text
                    className={`text-lg font-bold ${
                      pnl.data.estimatedProfit >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {formatINR(pnl.data.estimatedProfit)}
                  </Text>
                </View>
              </Card>
              {Object.keys(pnl.data.expensesByCategory).length > 0 ? (
                <Card className="p-4">
                  <Text className="text-sm font-bold text-text mb-2">Expenses by category</Text>
                  {Object.entries(pnl.data.expensesByCategory).map(([cat, amt]) => (
                    <View key={cat} className="flex-row justify-between py-1">
                      <Text className="text-xs text-muted">{cat.replace(/_/g, ' ')}</Text>
                      <Text className="text-sm font-semibold text-text">{formatINR(Number(amt))}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}
              <View className={`flex-row flex-wrap gap-2`}>
                <Button
                  label={excelBusy === 'pnl' ? 'Preparing…' : 'Download P&L Excel'}
                  variant="accent"
                  disabled={excelBusy != null}
                  onPress={() => void exportExcel('pnl', { from: pnlFrom, to: pnlTo })}
                />
                <Button
                  label={excelBusy === 'expenses' ? 'Preparing…' : 'Download expenses Excel'}
                  variant="secondary"
                  disabled={excelBusy != null}
                  onPress={() => void exportExcel('expenses', { from: pnlFrom, to: pnlTo })}
                />
              </View>
            </>
          )
        ) : null}
      </ScrollView>
        </>
      ) : null}
    </View>
  );
}

