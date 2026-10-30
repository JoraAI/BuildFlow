/**
 * Cash book screen — available for all inventory verticals.
 * Responsive: phone keeps tab-bar padding; desktop uses wider padded chrome.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { CashBookPanel } from '@/components/inventory/CashBookPanel';
import { InventoryScrollChrome } from '@/components/inventory/InventoryScreenList';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryCashScreen() {
  const { isPhone, isDesktop } = useViewport();
  const title = (
    <View className="pt-4 pb-2 px-4">
      <Text className={`font-bold text-text ${isPhone ? 'text-xl' : 'text-2xl'}`}>Cash book</Text>
      <Text className="text-sm text-muted">Daily income, expenses, and closing balance</Text>
    </View>
  );
  return (
    <View
      className="flex-1 min-h-0 bg-surface"
      style={{
        maxWidth: isDesktop ? 900 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <InventoryScrollChrome slot="sticky">{title}</InventoryScrollChrome>
      <CashBookPanel leadingChrome={<InventoryScrollChrome slot="scroll">{title}</InventoryScrollChrome>} />
    </View>
  );
}
