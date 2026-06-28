import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from '@/components/ui';
import { StartFreeTrialCardButton } from '@/components/marketing/StartFreeTrialButton';
import { useViewport } from '@/hooks/useViewport';
import { MARKETING_PRICING, GST_PRICING_NOTE } from '@/constants/marketing';

/** Equal-width pricing tier cards - same layout on mobile (stack) and desktop (row). */
export function PricingCardsGrid() {
  const router = useRouter();
  const { isMarketingDesktop } = useViewport();

  return (
    <View className={`w-full gap-4 ${isMarketingDesktop ? 'flex-row items-stretch' : ''}`}>
      {MARKETING_PRICING.map((p) => (
        <View
          key={p.name}
          className={isMarketingDesktop ? 'flex-1 min-w-0' : 'w-full'}
        >
          <Card
            className={`h-full ${p.highlighted ? 'border-2 border-accent' : ''}`}
          >
            {p.highlighted && (
              <Text className="text-xs font-bold text-accent mb-2 uppercase">Most popular</Text>
            )}
            <Text className="text-lg font-bold text-text">{p.name}</Text>
            <View className="flex-row items-baseline mt-1 mb-1">
              <Text className="text-3xl font-bold text-primary">{p.price}</Text>
              {p.period ? <Text className="text-muted ml-1">{p.period}</Text> : null}
            </View>
            {p.annualPrice ? (
              <Text className="text-xs text-muted mb-1">or {p.annualPrice} (2 months free)</Text>
            ) : null}
            {p.name !== 'Enterprise' ? (
              <Text className="text-xs text-muted mb-2">{GST_PRICING_NOTE}</Text>
            ) : (
              <View className="mb-2" />
            )}
            <Text className="text-sm text-muted mb-4">{p.description}</Text>
            {p.features.map((feat) => (
              <View key={feat} className="flex-row items-center mb-2">
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text className="text-sm text-text ml-2 flex-1">{feat}</Text>
              </View>
            ))}
            <View className="mt-4">
              {p.name === 'Enterprise' ? (
                <Button
                  label="Contact sales"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onPress={() => router.push('/signup')}
                />
              ) : (
                <StartFreeTrialCardButton
                  highlighted={p.highlighted}
                  onPress={() => router.push('/signup/company')}
                />
              )}
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}
