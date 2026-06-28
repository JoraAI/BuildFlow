import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketingContent } from '@/components/marketing/MarketingContent';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';
import { useViewport } from '@/hooks/useViewport';

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
            Ready to streamline your projects?
          </Text>
          <Text className={`text-white/70 ${isMarketingDesktop ? 'text-lg max-w-xl' : 'text-base'}`}>
            Full platform access for 14 days. No credit card required.
          </Text>
          <View className={`mt-4 ${isMarketingDesktop ? 'max-w-md' : ''}`}>
            <FreeTrialBadge onDark />
          </View>
        </View>
        <View className={`${isMarketingDesktop ? 'shrink-0 items-end' : 'w-full'}`}>
          <StartFreeTrialButton
            onPress={() => router.push('/signup/company')}
            fullWidth={!isMarketingDesktop}
          />
          <Pressable
            onPress={() => router.push('/login')}
            className={`mt-3 px-5 py-3 rounded-lg border border-white/40 active:opacity-80 ${
              !isMarketingDesktop ? 'w-full items-center' : ''
            }`}
          >
            <Text className="text-white font-semibold text-center">Login</Text>
          </Pressable>
        </View>
      </MarketingContent>
    </View>
  );
}
