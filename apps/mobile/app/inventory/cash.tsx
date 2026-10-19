/**
 * Cash book screen — available for all inventory verticals.
 * Responsive: phone keeps tab-bar padding; desktop uses wider padded chrome.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { CashBookPanel } from '@/components/inventory/CashBookPanel';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryCashScreen() {
  const { isPhone, isDesktop } = useViewport();
  return (
    <View
      className="flex-1 bg-surface"
      style={{
        paddingBottom: isPhone ? mobileListBottomPadding() : 24,
        maxWidth: isDesktop ? 900 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <View className={`pt-4 pb-2 ${isDesktop ? 'px-6' : 'px-4'}`}>
        <Text className="text-2xl font-bold text-text">Cash book</Text>
        <Text className="text-sm text-muted">Daily income, expenses, and closing balance</Text>
      </View>
      <CashBookPanel />
    </View>
  );
}
