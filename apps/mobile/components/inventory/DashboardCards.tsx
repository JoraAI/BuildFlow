/**
 * BuildFlow - Executive dashboard cards (INVENTORY_HORIZONTAL_PLATFORM Phase 6.1).
 *
 * Compact second row on the Stock home: inventory value (WAC), sales/purchases
 * today (IST), receivables, payables, and low/dead stock.
 *
 * Phone: horizontal scroll strip (does not stack 6 tall cards). Desktop: wrap row.
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card, LoadingSkeleton } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useInventoryDashboard } from '@/services/inventory-analytics.queries';
import { useExpirySummary } from '@/services/expansion.queries';
import { formatINRCompact } from '@/utils/format';

function MetricStrip({
  cards,
  loading,
  skeletonCount,
}: {
  cards: Array<{ label: string; value: string; tone?: string }> | null;
  loading: boolean;
  skeletonCount: number;
}) {
  const { isPhone } = useViewport();

  if (loading) {
    if (isPhone) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <LoadingSkeleton key={i} className="rounded-xl h-14 w-[132px]" />
          ))}
        </ScrollView>
      );
    }
    return (
      <View className="flex-row gap-3 flex-wrap">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <LoadingSkeleton key={i} className="flex-1 min-w-[140px] rounded-xl h-16" />
        ))}
      </View>
    );
  }
  if (!cards) return null;

  if (isPhone) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {cards.map((c) => (
          <Card key={c.label} className="p-3 w-[132px]">
            <Text className="text-[10px] text-muted" numberOfLines={1}>
              {c.label}
            </Text>
            <Text className={`text-base font-bold text-text mt-0.5 ${c.tone ?? ''}`} numberOfLines={1}>
              {c.value}
            </Text>
          </Card>
        ))}
      </ScrollView>
    );
  }

  return (
    <View className="flex-row gap-3 flex-wrap">
      {cards.map((c) => (
        <Card key={c.label} className="flex-1 min-w-[140px] p-4">
          <Text className="text-xs text-muted">{c.label}</Text>
          <Text className={`text-lg font-bold text-text ${c.tone ?? ''}`}>{c.value}</Text>
        </Card>
      ))}
    </View>
  );
}

export default function DashboardCards() {
  const { data, isLoading } = useInventoryDashboard();

  const cards: Array<{ label: string; value: string; tone?: string }> | null = data
    ? [
        { label: 'Inventory value', value: formatINRCompact(data.inventoryValue) },
        { label: 'Sales today', value: formatINRCompact(data.salesToday) },
        { label: 'Purchases today', value: formatINRCompact(data.purchasesToday) },
        { label: 'Receivables', value: formatINRCompact(data.receivables) },
        { label: 'Payables', value: formatINRCompact(data.payables) },
        {
          label: 'Low stock',
          value: `${data.lowStockCount} · ${data.deadStockCount} dead`,
          tone: data.lowStockCount > 0 ? 'text-danger' : undefined,
        },
      ]
    : null;

  return <MetricStrip cards={cards} loading={isLoading} skeletonCount={6} />;
}

/**
 * INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4.2): Kirana-vertical KPI row on the
 * stock home - today's counter sales, low stock, expiring soon (0–30d), and
 * expired stock value (WAC). Shown ONLY for Kirana tenants; other inventory
 * verticals keep the executive DashboardCards row unchanged.
 */
export function KiranaKpiCards() {
  const { data: dashboard, isLoading: dashboardLoading } = useInventoryDashboard();
  const { data: expiry, isLoading: expiryLoading } = useExpirySummary();

  const cards: Array<{ label: string; value: string; tone?: string }> | null =
    dashboard && expiry
      ? [
          { label: 'Counter sales today', value: formatINRCompact(dashboard.salesToday) },
          {
            label: 'Low stock',
            value: `${dashboard.lowStockCount} item(s)`,
            tone: dashboard.lowStockCount > 0 ? 'text-danger' : undefined,
          },
          {
            label: 'Expiring soon (0–30d)',
            value: `${Math.round(expiry['0_30'])} · ₹${formatINRCompact(expiry['0_30_VALUE'])}`,
            tone: expiry['0_30'] > 0 ? 'text-warning' : undefined,
          },
          {
            label: 'Expired stock',
            value: `${Math.round(expiry.EXPIRED)} · ₹${formatINRCompact(expiry.EXPIRED_VALUE)}`,
            tone: expiry.EXPIRED > 0 ? 'text-danger' : undefined,
          },
        ]
      : null;

  return (
    <MetricStrip
      cards={cards}
      loading={dashboardLoading || expiryLoading}
      skeletonCount={4}
    />
  );
}
