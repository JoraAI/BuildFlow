/**
 * Inventory Home dashboard — KPIs, quick actions, low-stock alerts
 * (matches Creamy Kulfi mockup Home screen). Responsive: 2-col KPIs on phone,
 * 4-col on tablet/desktop; action grid wraps; content capped on wide screens.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LoadingSkeleton, toast } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useIceCreamVertical } from '@/hooks/useIceCreamVertical';
import { useViewport } from '@/hooks/useViewport';
import { useInventoryDashboard } from '@/services/inventory-analytics.queries';
import { useStockSummary, type StockSummaryRow } from '@/services/expansion.queries';
import { useDailySalesSummary } from '@/services/ice-cream.queries';
import { formatINR } from '@/utils/format';
import { INVENTORY_ACCENT, INVENTORY_ACCENT_SOFT } from '@/components/navigation/InventoryTabBar';
import { CompanyLogo } from '@/components/ui/Avatar';
import { inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

export default function InventoryHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isIceCream = useIceCreamVertical();
  const { isPhone, isDesktop } = useViewport();
  const projectId = user?.defaultProjectId ?? '';
  const { data: dashboard, isLoading, isFetching, refetch } = useInventoryDashboard();
  const { data: stock, refetch: refetchStock } = useStockSummary(projectId);
  const date = todayISO();
  const summaryQ = useDailySalesSummary(date, true);

  const lowStock = useMemo(() => {
    return (stock ?? [])
      .filter((r: StockSummaryRow) => {
        const bal = Number(r.balance ?? 0);
        const rp = Number(r.reorderPoint ?? 0);
        return rp > 0 && bal <= rp;
      })
      .slice(0, 8);
  }, [stock]);

  const cashInHand = summaryQ.data?.cash?.closing ?? null;
  const expenses = summaryQ.data?.cash?.expenses ?? null;

  const actions: QuickAction[] = [
    { key: 'sale', label: 'New Sale', icon: 'cart-outline', href: '/inventory/sales' },
    ...(isIceCream
      ? [{ key: 'prod', label: 'Production', icon: 'nutrition-outline' as const, href: '/inventory/production' }]
      : []),
    { key: 'purchase', label: 'Add Purchase', icon: 'bag-outline', href: '/inventory/procurement' },
    { key: 'expense', label: 'Add Expense', icon: 'wallet-outline', href: '/inventory/cash' },
    { key: 'stock', label: 'View Stock', icon: 'cube-outline', href: '/inventory/materials' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', href: '/inventory/reports' },
  ];

  const actionWidth: DimensionValue = isDesktop ? '15%' : isPhone ? '30%' : '22%';
  const kpiWidth: DimensionValue = isDesktop ? '23%' : '47%';

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? inventoryPageListPadding() + 24 : 48,
        maxWidth: isDesktop ? 1100 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching || summaryQ.isFetching}
          onRefresh={() => {
            void refetch();
            void refetchStock();
            void summaryQ.refetch();
          }}
        />
      }
    >
      <View className="flex-row items-center gap-3 mb-4">
        <CompanyLogo name={user?.companyName ?? 'Store'} logoUrl={user?.companyLogoUrl} size={44} />
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-bold text-text" numberOfLines={1}>
            {user?.companyName ?? 'Store'}
          </Text>
          <Text className="text-xs text-muted">Today · {date}</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: kpiWidth, flexGrow: 1 }}>
              <LoadingSkeleton className="h-24 rounded-2xl" />
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3 mb-5">
          <KpiCard
            width={kpiWidth}
            label="Sales"
            value={formatINR(dashboard?.salesToday ?? 0)}
            sub="Today"
            tone="success"
          />
          <KpiCard
            width={kpiWidth}
            label="Purchases"
            value={formatINR(dashboard?.purchasesToday ?? 0)}
            sub="Today"
          />
          <KpiCard
            width={kpiWidth}
            label="Expenses"
            value={expenses != null ? formatINR(expenses) : '—'}
            sub="Cash book"
            tone="danger"
          />
          <KpiCard
            width={kpiWidth}
            label="Cash in hand"
            value={cashInHand != null ? formatINR(cashInHand) : formatINR(0)}
            sub="Closing"
            tone="primary"
          />
        </View>
      )}

      <Text className="text-sm font-bold text-text mb-2">Quick actions</Text>
      <View className="flex-row flex-wrap gap-2 mb-5">
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => router.push(a.href as never)}
            className="min-w-[100px] flex-grow items-center rounded-2xl border border-border bg-card py-3 px-2 active:opacity-80"
            style={{ width: actionWidth }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-1.5"
              style={{ backgroundColor: INVENTORY_ACCENT_SOFT }}
            >
              <Ionicons name={a.icon} size={20} color={INVENTORY_ACCENT} />
            </View>
            <Text className="text-[11px] font-semibold text-text text-center" numberOfLines={2}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-bold text-text">Low stock alerts</Text>
        <Pressable onPress={() => router.push('/inventory/materials' as never)}>
          <Text style={{ color: INVENTORY_ACCENT }} className="text-xs font-semibold">
            View all
          </Text>
        </Pressable>
      </View>
      {lowStock.length === 0 ? (
        <View className="rounded-2xl border border-border bg-card p-4 mb-4">
          <Text className="text-sm text-muted">No low-stock items right now.</Text>
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
          {lowStock.map((row: StockSummaryRow, i: number) => (
            <Pressable
              key={row.resourceId}
              onPress={() => router.push(`/inventory/stock/${row.resourceId}` as never)}
              className={`flex-row items-center justify-between px-4 py-3 ${
                i > 0 ? 'border-t border-border/60' : ''
              }`}
            >
              <Text className="text-sm font-medium text-text flex-1 mr-2" numberOfLines={1}>
                {row.name}
              </Text>
              <Text className="text-sm font-bold text-danger">
                {Number(row.balance)} {row.unit}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => {
          toast.success('Pull down to refresh dashboard');
        }}
        className="items-center py-2"
      >
        <Text className="text-[11px] text-muted">
          Inventory value {formatINR(dashboard?.inventoryValue ?? 0)} · Low stock{' '}
          {dashboard?.lowStockCount ?? lowStock.length}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
  width,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'success' | 'danger' | 'primary';
  width: DimensionValue;
}) {
  const valueColor =
    tone === 'success' ? '#10B981' : tone === 'danger' ? '#EF4444' : tone === 'primary' ? INVENTORY_ACCENT : '#0F172A';
  return (
    <View className="rounded-2xl border border-border bg-card p-3" style={{ width, flexGrow: 1 }}>
      <Text className="text-[11px] text-muted mb-1">{label}</Text>
      <Text className="text-lg font-bold" style={{ color: valueColor }} numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[10px] text-muted mt-0.5">{sub}</Text>
    </View>
  );
}
