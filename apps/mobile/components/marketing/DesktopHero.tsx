import React from 'react';
import { View, Text, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductMockPanel } from '@/components/marketing/ProductMockPanel';
import { MarketingContent } from '@/components/marketing/MarketingContent';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';
import { useViewport } from '@/hooks/useViewport';
import { HERO_STATS } from '@/constants/marketing';
import { BRAND_IMAGES } from '@/constants/navigation';

export function DesktopHero() {
  const router = useRouter();
  const { isMarketingDesktop } = useViewport();

  if (!isMarketingDesktop) {
    return (
      <ImageBackground source={{ uri: BRAND_IMAGES.loginHero }} resizeMode="cover">
        <View className="bg-primary/85 px-4 py-14">
          <Text className="font-bold text-white leading-tight text-3xl">
            Plan, estimate, and account - all in one platform.
          </Text>
          <Text className="text-white/75 mt-4 leading-relaxed text-base">
            BuildFlow helps Indian construction firms manage projects, site reports, BOQ estimates,
            and GST accounting from one modern ERP.
          </Text>
          <View className="flex-row flex-wrap items-center gap-3 mt-8">
            <StartFreeTrialButton onPress={() => router.push('/signup/company')} size="md" />
            <Pressable
              onPress={() => router.push('/login')}
              className="px-5 py-3 rounded-lg border border-white/40 active:opacity-80"
            >
              <Text className="text-white font-semibold">Login</Text>
            </Pressable>
          </View>
          <View className="mt-4 self-start">
            <FreeTrialBadge onDark />
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <View className="w-full bg-primary py-20">
      <MarketingContent>
        <View className="flex-row items-center gap-12">
          <View className="flex-1 min-w-0">
            <Text className="text-accent text-sm font-bold uppercase tracking-wider mb-4">
              Construction ERP for India
            </Text>
            <Text className="font-bold text-white leading-tight text-5xl">
              Plan, estimate, and account - all in one platform.
            </Text>
            <Text className="text-white/75 mt-5 leading-relaxed text-xl max-w-xl">
              BuildFlow helps Indian construction firms manage projects, site reports, BOQ estimates,
              and GST accounting from one modern ERP.
            </Text>
            <View className="flex-row flex-wrap items-center gap-3 mt-8">
              <StartFreeTrialButton onPress={() => router.push('/signup/company')} />
              <Pressable
                onPress={() => router.push('/login')}
                className="px-6 py-3 rounded-lg border border-white/40 active:opacity-80"
              >
                <Text className="text-white font-semibold text-base">Login</Text>
              </Pressable>
            </View>
            <View className="mt-5 max-w-md">
              <FreeTrialBadge onDark />
            </View>
            <View className="flex-row gap-6 mt-10">
              {HERO_STATS.map((s) => (
                <View key={s.label}>
                  <Text className="text-accent text-2xl font-bold">{s.value}</Text>
                  <Text className="text-white/60 text-sm mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-1 max-w-md min-w-0">
            <ProductMockPanel />
          </View>
        </View>
      </MarketingContent>
    </View>
  );
}
