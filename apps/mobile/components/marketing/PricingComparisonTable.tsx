import React from 'react';
import { View, Text } from 'react-native';
import { useViewport } from '@/hooks/useViewport';
import { PRICING_COMPARISON, TRUST_PILLS } from '@/constants/marketing';

export function PricingComparisonTable() {
  const { isMarketingDesktop } = useViewport();
  if (!isMarketingDesktop) return null;

  const cols = ['starter', 'professional', 'enterprise'] as const;
  const headers = ['Starter', 'Professional', 'Enterprise'];

  return (
    <View className="mt-12">
      <Text className="text-2xl font-bold text-text mb-6">Compare plans</Text>
      <View className="rounded-xl border border-border overflow-hidden bg-card">
        <View className="flex-row bg-surface border-b border-border">
          <View className="flex-[1.4] p-4">
            <Text className="text-sm font-bold text-muted">Feature</Text>
          </View>
          {headers.map((h) => (
            <View key={h} className="flex-1 p-4 items-center border-l border-border">
              <Text className="text-sm font-bold text-text">{h}</Text>
            </View>
          ))}
        </View>
        {PRICING_COMPARISON.map((row, i) => (
          <View
            key={row.feature}
            className={`flex-row border-b border-border ${i % 2 === 0 ? 'bg-card' : 'bg-surface/50'}`}
          >
            <View className="flex-[1.4] p-4 justify-center">
              <Text className="text-sm text-text">{row.feature}</Text>
            </View>
            {cols.map((col) => (
              <View key={col} className="flex-1 p-4 items-center justify-center border-l border-border">
                <Text className="text-sm text-muted text-center">{row[col]}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function TrustStrip() {
  const { isMarketingDesktop } = useViewport();

  return (
    <View className={`flex-row flex-wrap gap-2 ${isMarketingDesktop ? 'mt-8' : 'mt-6'}`}>
      {TRUST_PILLS.map((pill) => (
        <View key={pill} className="px-4 py-2 rounded-full bg-primary/8 border border-primary/15">
          <Text className="text-sm font-medium text-primary">{pill}</Text>
        </View>
      ))}
    </View>
  );
}
