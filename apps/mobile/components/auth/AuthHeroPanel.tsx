/**
 * Shared hero panel for auth / signup screens (desktop split layout).
 */
import React from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_IMAGES } from '@/constants/navigation';

const DEFAULT_BENEFITS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { icon: 'calendar-outline', label: 'CPM Scheduling' },
  { icon: 'calculator-outline', label: 'BOQ & Estimation' },
  { icon: 'cash-outline', label: 'Integrated Accounting' },
];

export function AuthHeroPanel({
  headline = 'Plan, estimate, and account - all in one platform.',
  subline = 'Built for contractors who need Tally-grade accounting with modern project management.',
  benefits = DEFAULT_BENEFITS,
}: {
  headline?: string;
  subline?: string;
  benefits?: { icon: keyof typeof Ionicons.glyphMap; label: string }[];
}) {
  return (
    <ImageBackground source={{ uri: BRAND_IMAGES.loginHero }} className="flex-1" resizeMode="cover">
      <View className="flex-1 bg-primary/80 px-12 py-16 justify-between">
        <View>
          <View className="flex-row items-center gap-3 mb-10">
            <View className="w-12 h-12 rounded-xl bg-accent items-center justify-center">
              <Ionicons name="construct" size={26} color="#1E3A5F" />
            </View>
            <View>
              <Text className="text-white text-2xl font-bold">BuildFlow</Text>
              <Text className="text-white/60 text-sm">Construction ERP</Text>
            </View>
          </View>
          <Text className="text-white text-4xl font-bold leading-tight max-w-md">{headline}</Text>
          <Text className="text-white/70 text-lg mt-4 max-w-sm leading-relaxed">{subline}</Text>
        </View>
        <View className="flex-row gap-4 flex-wrap">
          {benefits.map((b) => (
            <FeaturePill key={b.label} icon={b.icon} label={b.label} />
          ))}
        </View>
      </View>
    </ImageBackground>
  );
}

function FeaturePill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-row items-center bg-white/10 rounded-lg px-3 py-2 border border-white/15">
      <Ionicons name={icon} size={16} color="#F59E0B" />
      <Text className="text-white text-sm font-medium ml-2">{label}</Text>
    </View>
  );
}
