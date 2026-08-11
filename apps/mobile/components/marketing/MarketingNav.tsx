import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useViewport } from '@/hooks/useViewport';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';

export function MarketingNav() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();

  return (
    <View
      className="bg-primary border-b border-white/10"
      style={{ paddingTop: Math.max(insets.top, 12) }}
    >
      <View
        className={`flex-row items-center justify-between px-4 pb-3 ${
          isDesktop ? 'max-w-6xl w-full self-center px-8' : ''
        }`}
      >
        <Pressable
          onPress={() => router.push('/')}
          className="flex-row items-center gap-2 active:opacity-80"
        >
          <View className="w-9 h-9 rounded-lg bg-accent items-center justify-center">
            <Ionicons name="construct" size={20} color="#1E3A5F" />
          </View>
          <Text className="text-white text-lg font-bold">BuildFlow</Text>
        </Pressable>

        <View className="flex-row items-center gap-2">
          {isDesktop && (
            <>
              <Pressable onPress={() => router.push('/about')} className="px-3 py-2">
                <Text className="text-white/80 text-sm font-medium">About</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/pricing')} className="px-3 py-2">
                <Text className="text-white/80 text-sm font-medium">Pricing</Text>
              </Pressable>
            </>
          )}
          <Pressable
            onPress={() => router.push('/login')}
            className="px-3 py-2 rounded-lg border border-white/30 active:opacity-80"
          >
            <Text className="text-white text-sm font-semibold">Login</Text>
          </Pressable>
          <StartFreeTrialButton
            onPress={() => router.push('/signup')}
            size="sm"
            label="Free trial"
          />
        </View>
      </View>
    </View>
  );
}
