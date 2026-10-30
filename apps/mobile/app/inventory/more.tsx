/**
 * Inventory More hub — mobile/tablet only.
 * Desktop users get these destinations in the sidebar; this route redirects.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useIceCreamVertical } from '@/hooks/useIceCreamVertical';
import { useViewport } from '@/hooks/useViewport';
import {
  INVENTORY_ACCENT,
  INVENTORY_ACCENT_SOFT,
  INVENTORY_SECONDARY_NAV,
} from '@/components/navigation/InventoryTabBar';
import { inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';
import { getInventoryLabel, getInventoryLabelMode } from '@buildflow/shared';
import { useAuthStore } from '@/stores/auth.store';

const SUBTITLES: Record<string, string> = {
  parties: 'Ledgers, outstanding, price lists',
  cash: 'Income, expenses, daily closing',
  onhand: 'Balances, adjust, issue, checkout',
  procurement: 'PO, GRN, indents',
  invoices: 'Sales invoices & payments',
  bills: 'Purchase bills & payments',
  quotes: 'Quotations & estimates',
  warehouse: 'Locations, transfers, counts',
  reports: 'Sales, stock, production, P&L, export',
  activity: 'Audit trail for this company',
  backup: 'Cloud snapshot & data recovery',
  settings: 'Plan, GSTIN, catalog, users',
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

  // Desktop: sections live in the sidebar — don't show a More hub.
  if (isDesktop) {
    return <Redirect href="/inventory" />;
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: 16,
        paddingBottom: isPhone ? inventoryPageListPadding() + 24 : 48,
        width: '100%',
        alignSelf: 'center',
        maxWidth: 640,
      }}
    >
      <Text className="text-2xl font-bold text-text mb-1">More</Text>
      <Text className="text-sm text-muted mb-4">
        {isIceCream ? 'Ice cream manufacture tools' : 'Inventory tools'}
        {user?.companyName ? ` · ${user.companyName}` : ''}
      </Text>
      <View className="rounded-2xl border border-border bg-card overflow-hidden">
        {INVENTORY_SECONDARY_NAV.map((item, i) => {
          const subtitle =
            item.key === 'settings'
              ? `Business profile, ${itemsLabel.toLowerCase()}, users`
              : (SUBTITLES[item.key] ?? '');
          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.href as never)}
              className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface ${
                i > 0 ? 'border-t border-border/70' : ''
              }`}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: INVENTORY_ACCENT_SOFT }}
              >
                <Ionicons name={item.icon} size={20} color={INVENTORY_ACCENT} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-semibold text-text">{item.label}</Text>
                {subtitle ? (
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
