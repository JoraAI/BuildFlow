import React from 'react';
import { View, Text, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductMockPanel } from '@/components/marketing/ProductMockPanel';
import { MarketingContent } from '@/components/marketing/MarketingContent';
import { FreeTrialBadge } from '@/components/marketing/FreeTrialBadge';
import { StartFreeTrialButton } from '@/components/marketing/StartFreeTrialButton';
import { useViewport } from '@/hooks/useViewport';
import { BRAND_IMAGES } from '@/constants/navigation';
import {
  filteredHeroStats,
  landingHeroCopy,
  visibleTrialCtas,
} from '@/utils/marketing-variant';

export function DesktopHero() {
  const router = useRouter();
  const { isMarketingDesktop } = useViewport();
  const copy = landingHeroCopy();
  const trials = visibleTrialCtas();
  const stats = filteredHeroStats();

  const ctaRow = (size: 'md' | 'lg') => (
    <View className="flex-row flex-wrap items-center gap-3 mt-8" style={{ zIndex: 30, elevation: 30 }}>
      {trials.map((cta, i) => (
        <StartFreeTrialButton
          key={cta.href}
          size={size}
          variant={i === 0 ? 'accent' : 'outline'}
          label={cta.label}
          hoverTitle={cta.hoverTitle}
          hoverBody={cta.hoverBody}
          onPress={() => router.push(cta.href as never)}
        />
      ))}
      <Pressable
        onPress={() => router.push('/login')}
        className={`${size === 'lg' ? 'px-6' : 'px-5'} py-3 rounded-lg border border-white/40 active:opacity-80`}
      >
        <Text className={`text-white font-semibold ${size === 'lg' ? 'text-base' : ''}`}>Login</Text>
      </Pressable>
    </View>
  );

  if (!isMarketingDesktop) {
    return (
      <ImageBackground source={{ uri: BRAND_IMAGES.loginHero }} resizeMode="cover" style={{ zIndex: 20 }}>
        <View className="bg-primary/85 px-4 py-14" style={{ zIndex: 20, overflow: 'visible' as const }}>
          <Text className="text-accent text-xs font-bold uppercase tracking-wider mb-3">
            {copy.eyebrow}
          </Text>
          <Text className="font-bold text-white leading-tight text-3xl">{copy.titleMobile}</Text>
          <Text className="text-white/75 mt-4 leading-relaxed text-base">{copy.bodyMobile}</Text>
          {ctaRow('md')}
          <View className="mt-4 self-start">
            <FreeTrialBadge onDark />
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <View className="w-full bg-primary py-20" style={{ zIndex: 20, elevation: 20, overflow: 'visible' as const }}>
      <MarketingContent>
        <View className="flex-row items-center gap-12" style={{ overflow: 'visible' as const }}>
          <View className="flex-1 min-w-0" style={{ zIndex: 25, overflow: 'visible' as const }}>
            <Text className="text-accent text-sm font-bold uppercase tracking-wider mb-4">
              {copy.eyebrow}
            </Text>
            <Text className="font-bold text-white leading-tight text-5xl">{copy.titleDesktop}</Text>
            <Text className="text-white/75 mt-5 leading-relaxed text-xl max-w-xl">{copy.bodyDesktop}</Text>
            {ctaRow('lg')}
            <View className="mt-5 max-w-md">
              <FreeTrialBadge onDark />
            </View>
            <View className="flex-row gap-6 mt-10">
              {stats.map((s) => (
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
