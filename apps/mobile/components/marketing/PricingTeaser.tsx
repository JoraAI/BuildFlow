import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useViewport } from '@/hooks/useViewport';

/** Lightweight CTA — pricing lives only on /pricing for visit tracking. */
export function PricingTeaser() {
  const router = useRouter();
  const { isMarketingDesktop } = useViewport();

  return (
    <Pressable
      onPress={() => router.push('/pricing')}
      className={`w-full flex-row items-center justify-between rounded-2xl border border-border bg-card active:opacity-90 ${
        isMarketingDesktop ? 'p-6' : 'p-5'
      }`}
    >
      <View className="flex-1 mr-4">
        <Text className={`font-bold text-text ${isMarketingDesktop ? 'text-xl' : 'text-lg'}`}>
          Plans & pricing
        </Text>
        <Text className="text-sm text-muted mt-1 leading-relaxed">
          Transparent plans for every firm size. 14-day free trial on all tiers.
        </Text>
      </View>
      <View className="flex-row items-center gap-1 shrink-0">
        <Text className="text-primary font-semibold text-sm">View pricing</Text>
        <Ionicons name="chevron-forward" size={18} color="#1E3A5F" />
      </View>
    </Pressable>
  );
}
