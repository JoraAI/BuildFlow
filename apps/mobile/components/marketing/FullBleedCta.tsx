import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketingContent } from '@/components/marketing/MarketingContent';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';
import { useViewport } from '@/hooks/useViewport';
import { TRIAL_CTA } from '@/constants/marketing';

export function FullBleedCta() {
  const router = useRouter();
  const { isMarketingDesktop } = useViewport();

  return (
    <View className="w-full bg-primary">
      <MarketingContent
        className={`${isMarketingDesktop ? 'py-20' : 'py-12'} ${
          isMarketingDesktop ? 'flex-row items-center justify-between' : ''
        }`}
      >
        <View className={isMarketingDesktop ? 'flex-1 mr-10' : 'mb-6'}>
          <Text
            className={`text-white font-bold mb-2 ${isMarketingDesktop ? 'text-3xl' : 'text-2xl'}`}
          >
            Ready for ERP or exclusive Inventory?
          </Text>
          <Text className={`text-white/70 ${isMarketingDesktop ? 'text-lg max-w-xl' : 'text-base'}`}>
            14-day free trial for Construction ERP or Inventory (retail through equipment profiles). No
            credit card.
          </Text>
          <View className={`mt-4 ${isMarketingDesktop ? 'max-w-md' : ''}`}>
            <FreeTrialBadge onDark />
          </View>
        </View>
        <View className={`${isMarketingDesktop ? 'shrink-0 items-stretch gap-3' : 'w-full gap-3'}`}>
          <StartFreeTrialButton
            label={TRIAL_CTA.erp.label}
            onPress={() => router.push(TRIAL_CTA.erp.href as never)}
            fullWidth={!isMarketingDesktop}
            size={isMarketingDesktop ? 'lg' : 'md'}
          />
          <StartFreeTrialButton
            variant="outline"
            label={TRIAL_CTA.inventory.label}
            onPress={() => router.push(TRIAL_CTA.inventory.href as never)}
            fullWidth={!isMarketingDesktop}
            size={isMarketingDesktop ? 'lg' : 'md'}
          />
          <Pressable
            onPress={() => router.push('/login')}
            className={`px-5 py-3 rounded-lg border border-white/40 active:opacity-80 ${
              !isMarketingDesktop ? 'w-full items-center' : 'items-center'
            }`}
          >
            <Text className="text-white font-semibold text-center">Login</Text>
          </Pressable>
        </View>
      </MarketingContent>
    </View>
  );
}
