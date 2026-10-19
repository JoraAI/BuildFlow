/**
 * Inventory More hub — secondary destinations from the 5-tab shell.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIceCreamVertical } from '@/hooks/useIceCreamVertical';
import { useViewport } from '@/hooks/useViewport';
import { INVENTORY_PINK, INVENTORY_PINK_SOFT } from '@/components/navigation/InventoryTabBar';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { getInventoryLabel, getInventoryLabelMode } from '@buildflow/shared';
import { useAuthStore } from '@/stores/auth.store';

type MoreItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

export default function InventoryMoreScreen() {
  const router = useRouter();
  const { isPhone, isDesktop } = useViewport();
  const isIceCream = useIceCreamVertical();
  const user = useAuthStore((s) => s.user);
  const itemsLabel = getInventoryLabel(
    'item_plural',
    getInventoryLabelMode(user?.inventoryProfile ?? null),
  );

  const items: MoreItem[] = [
    {
      key: 'parties',
      title: 'Customers & suppliers',
      subtitle: 'Ledgers, outstanding, price lists',
      icon: 'people-outline',
      href: '/inventory/parties',
    },
    {
      key: 'cash',
      title: 'Cash book',
      subtitle: 'Income, expenses, daily closing',
      icon: 'wallet-outline',
      href: '/inventory/cash',
    },
    {
      key: 'onhand',
      title: 'On-hand stock',
      subtitle: 'Balances, adjust, issue, checkout',
      icon: 'layers-outline',
      href: '/inventory/on-hand',
    },
    {
      key: 'procurement',
      title: 'Purchases / procurement',
      subtitle: 'PO, GRN, indents',
      icon: 'bag-outline',
      href: '/inventory/procurement',
    },
    {
      key: 'invoices',
      title: 'Invoices',
      subtitle: 'Sales invoices & payments',
      icon: 'document-text-outline',
      href: '/inventory/invoices',
    },
    {
      key: 'bills',
      title: 'Bills',
      subtitle: 'Purchase bills & payments',
      icon: 'newspaper-outline',
      href: '/inventory/bills',
    },
    {
      key: 'quotes',
      title: 'Quotes',
      subtitle: 'Quotations & estimates',
      icon: 'create-outline',
      href: '/inventory/quotes',
    },
    {
      key: 'warehouse',
      title: 'Warehouse',
      subtitle: 'Locations, transfers, counts',
      icon: 'business-outline',
      href: '/inventory/warehouse',
    },
    {
      key: 'reports',
      title: 'Reports',
      subtitle: 'Sales, stock, production, P&L, export',
      icon: 'bar-chart-outline',
      href: '/inventory/reports',
    },
    {
      key: 'activity',
      title: 'User activity',
      subtitle: 'Audit trail for this company',
      icon: 'time-outline',
      href: '/inventory/activity',
    },
    {
      key: 'backup',
      title: 'Backup & export',
      subtitle: 'Cloud snapshot & data recovery',
      icon: 'cloud-upload-outline',
      href: '/inventory/backup',
    },
    {
      key: 'settings',
      title: 'Settings',
      subtitle: `Business profile, ${itemsLabel.toLowerCase()}, users`,
      icon: 'settings-outline',
      href: '/inventory/settings',
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? mobileListBottomPadding() + 24 : 48,
        maxWidth: isDesktop ? 720 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Text className="text-2xl font-bold text-text mb-1">More</Text>
      <Text className="text-sm text-muted mb-4">
        {isIceCream ? 'Ice cream manufacture tools' : 'Inventory tools'} · {user?.companyName}
      </Text>
      <View className="rounded-2xl border border-border bg-card overflow-hidden">
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href as never)}
            className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface ${
              i > 0 ? 'border-t border-border/70' : ''
            }`}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: INVENTORY_PINK_SOFT }}
            >
              <Ionicons name={item.icon} size={20} color={INVENTORY_PINK} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-text">{item.title}</Text>
              <Text className="text-xs text-muted" numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
