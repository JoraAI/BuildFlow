/**
 * Shared hero panel for auth / signup screens (desktop split layout).
 */
import React from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_IMAGES } from '@/constants/navigation';
import { BuildFlowMark } from '@/components/brand/BuildFlowMark';
import { appDisplayName, getAppVariant } from '@/constants/app-variant';

const CONSTRUCTION_BENEFITS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { icon: 'calendar-outline', label: 'CPM Scheduling' },
  { icon: 'calculator-outline', label: 'BOQ & Estimation' },
  { icon: 'cash-outline', label: 'Integrated Accounting' },
];

const INVENTORY_BENEFITS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { icon: 'cube-outline', label: 'Multi-warehouse stock' },
  { icon: 'cart-outline', label: 'Sales & challans' },
  { icon: 'cash-outline', label: 'GST & Tally' },
];

export function AuthHeroPanel({
  headline,
  subline,
  benefits,
}: {
  headline?: string;
  subline?: string;
  benefits?: { icon: keyof typeof Ionicons.glyphMap; label: string }[];
}) {
  const variant = getAppVariant();
  const brand = appDisplayName();
  const tagline = variant === 'inventory' ? 'Inventory' : 'Construction ERP';
  const resolvedHeadline =
    headline ??
    (variant === 'inventory'
      ? 'Stock, sales, and GST - built for trading businesses.'
      : 'Plan, estimate, and account - all in one platform.');
  const resolvedSubline =
    subline ??
    (variant === 'inventory'
      ? 'Warehouses, parties, invoices, and Tally without construction project tools.'
      : 'Built for contractors who need Tally-grade accounting with modern project management.');
  const resolvedBenefits =
    benefits ?? (variant === 'inventory' ? INVENTORY_BENEFITS : CONSTRUCTION_BENEFITS);

  return (
    <ImageBackground source={{ uri: BRAND_IMAGES.loginHero }} className="flex-1" resizeMode="cover">
      <View className="flex-1 bg-primary/80 px-12 py-16 justify-between">
        <View>
          <View className="flex-row items-center gap-3 mb-10">
            <BuildFlowMark size={48} />
            <View>
              <Text className="text-white text-2xl font-bold">{brand}</Text>
              <Text className="text-white/60 text-sm">{tagline}</Text>
            </View>
          </View>
          <Text className="text-white text-4xl font-bold leading-tight max-w-md">
            {resolvedHeadline}
          </Text>
          <Text className="text-white/70 text-lg mt-4 max-w-sm leading-relaxed">
            {resolvedSubline}
          </Text>
        </View>
        <View className="flex-row gap-4 flex-wrap">
          {resolvedBenefits.map((b) => (
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
