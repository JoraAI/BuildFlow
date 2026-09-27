/**
 * Stock home hero — one primary figure + supporting context (counter-first).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui';
import { formatINRCompact } from '@/utils/format';

export function StockHero({
  companyName,
  warehouseLabel,
  primaryLabel,
  primaryValue,
  supportLeft,
  supportRight,
  attentionLabel,
  onAttentionPress,
}: {
  companyName?: string | null;
  warehouseLabel?: string;
  primaryLabel: string;
  primaryValue: string;
  supportLeft?: { label: string; value: string };
  supportRight?: { label: string; value: string };
  attentionLabel?: string | null;
  onAttentionPress?: () => void;
}) {
  return (
    <Card className="p-4 mb-3 shadow-card border border-border/80">
      {(companyName || warehouseLabel) ? (
        <Text className="text-xs text-muted mb-1" numberOfLines={1}>
          {[companyName, warehouseLabel].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <Text className="text-[11px] font-semibold text-muted uppercase tracking-wide">{primaryLabel}</Text>
      <Text className="text-3xl font-bold text-primary mt-0.5" numberOfLines={1}>
        {primaryValue}
      </Text>
      {(supportLeft || supportRight) ? (
        <View className="flex-row gap-6 mt-3">
          {supportLeft ? (
            <View className="min-w-0">
              <Text className="text-[10px] text-muted" numberOfLines={1}>{supportLeft.label}</Text>
              <Text className="text-base font-bold text-text mt-0.5">{supportLeft.value}</Text>
            </View>
          ) : null}
          {supportRight ? (
            <View className="min-w-0">
              <Text className="text-[10px] text-muted" numberOfLines={1}>{supportRight.label}</Text>
              <Text className="text-base font-bold text-text mt-0.5">{supportRight.value}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {attentionLabel ? (
        <Pressable
          onPress={onAttentionPress}
          disabled={!onAttentionPress}
          className="mt-3 pt-3 border-t border-border flex-row items-center justify-between"
        >
          <Text className="text-xs font-semibold text-warning flex-1 pr-2" numberOfLines={2}>
            {attentionLabel}
          </Text>
          {onAttentionPress ? (
            <Text className="text-xs font-bold text-primary">Review</Text>
          ) : null}
        </Pressable>
      ) : null}
    </Card>
  );
}

export function formatHeroMoney(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '₹0';
  const compact = formatINRCompact(n);
  return compact.startsWith('₹') ? compact : `₹${compact}`;
}
