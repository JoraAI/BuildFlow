import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { MarketingContent } from '@/components/marketing/MarketingContent';
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
            Start your free trial or join your team with an invite link.
          </Text>
        </View>
        <View className={`flex-row flex-wrap gap-3 ${isMarketingDesktop ? 'shrink-0' : ''}`}>
          <Button label="Sign Up" onPress={() => router.push('/signup')} />
          <Pressable
            onPress={() => router.push('/login')}
            className="px-5 py-3 rounded-lg border border-white/40 active:opacity-80"
          >
            <Text className="text-white font-semibold">Login</Text>
          </Pressable>
        </View>
      </MarketingContent>
    </View>
  );
}
