/**
 * Phone stock list row — clear hierarchy, one primary action.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge, Button } from '@/components/ui';

export function StockRow({
  name,
  unit,
  balance,
  sellRate,
  sku,
  isLowStock,
  reorderPoint,
  primaryLabel,
  onPress,
  onPrimary,
  onAdjust,
  disabled,
}: {
  name: string;
  unit: string;
  balance: number | string;
  sellRate: number;
  sku?: string | null;
  isLowStock?: boolean;
  reorderPoint?: number | null;
  primaryLabel: string;
  onPress: () => void;
  onPrimary: () => void;
  onAdjust?: () => void;
  disabled?: boolean;
}) {
  const meta = [
    sku ? `SKU ${sku}` : null,
    sellRate > 0 ? `Sell ₹${sellRate.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="py-3.5 px-0.5 border-b border-border/50 active:bg-primary/5"
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-text" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {meta || unit}
          </Text>
          {isLowStock ? (
            <View className="mt-1.5 self-start">
              <Badge color="danger" label={`Low · reorder ${Number(reorderPoint)}`} />
            </View>
          ) : null}
        </View>
        <View className="items-end shrink-0 pl-2">
          <Text className="text-[10px] text-muted uppercase">On hand</Text>
          <Text className="text-base font-bold text-primary">
            {balance} <Text className="text-xs font-medium text-muted">{unit}</Text>
          </Text>
        </View>
      </View>
      <View className="flex-row justify-end gap-2 mt-2.5">
        {onAdjust ? (
          <Button label="Adjust" size="sm" variant="ghost" disabled={disabled} onPress={onAdjust} />
        ) : null}
        <Button
          label={primaryLabel}
          size="sm"
          variant="accent"
          disabled={disabled || Number(balance) <= 0}
          onPress={onPrimary}
        />
      </View>
    </Pressable>
  );
}
