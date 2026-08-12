/**
 * BuildFlow - Executive dashboard cards (INVENTORY_HORIZONTAL_PLATFORM Phase 6.1).
 *
 * Compact second row on the Stock home: inventory value (WAC), sales/purchases
 * today (IST), receivables, payables, and low/dead stock. Cards flex-wrap with
 * min-w so phones stack.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Card, LoadingSkeleton } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useInventoryDashboard } from '@/services/inventory-analytics.queries';
import { formatINRCompact } from '@/utils/format';

export default function DashboardCards() {
  const { isDesktop } = useViewport();
  const { data, isLoading } = useInventoryDashboard();

  if (isLoading) {
    return (
      <View className={`flex-row gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <LoadingSkeleton key={i} className="flex-1 min-w-[140px] rounded-xl h-16" />
        ))}
      </View>
    );
  }
  if (!data) return null;

  const cards: Array<{ label: string; value: string; tone?: string }> = [
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
  ];

  return (
    <View className={`flex-row gap-3 ${isDesktop ? '' : 'flex-wrap'}`}>
      {cards.map((c) => (
        <Card key={c.label} className="flex-1 min-w-[140px] p-4">
          <Text className="text-xs text-muted">{c.label}</Text>
          <Text className={`text-lg font-bold text-text ${c.tone ?? ''}`}>{c.value}</Text>
        </Card>
      ))}
    </View>
  );
}
