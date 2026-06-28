import React from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_IMAGES } from '@/constants/navigation';

/** Fake dashboard preview for marketing hero. */
export function ProductMockPanel() {
  return (
    <View className="rounded-2xl overflow-hidden border border-border shadow-lg bg-card">
      <View className="flex-row h-[340px]">
        {/* Fake sidebar */}
        <View className="w-14 bg-primary py-4 items-center gap-4">
          {(['grid-outline', 'business-outline', 'calculator-outline', 'cash-outline'] as const).map(
            (icon) => (
              <View key={icon} className="w-8 h-8 rounded-lg bg-white/10 items-center justify-center">
                <Ionicons name={icon} size={16} color="#F59E0B" />
              </View>
            ),
          )}
        </View>
        {/* Main preview */}
        <View className="flex-1">
          <View className="h-10 bg-surface border-b border-border flex-row items-center px-3 gap-2">
            <View className="h-2 w-16 rounded bg-border" />
            <View className="h-2 w-24 rounded bg-border" />
          </View>
          <ImageBackground
            source={{ uri: BRAND_IMAGES.planningHero }}
            className="flex-1"
            resizeMode="cover"
          >
            <View className="flex-1 bg-primary/70 p-4 justify-end">
              <View className="flex-row gap-2 mb-2">
                <MiniStat label="Active" value="12" />
                <MiniStat label="Budget" value="₹2.4Cr" />
                <MiniStat label="Reports" value="48" />
              </View>
              <View className="bg-white/95 rounded-lg p-3">
                <Text className="text-xs font-bold text-primary">Highway Phase 2</Text>
                <Text className="text-[10px] text-muted mt-0.5">Planning · 68% complete</Text>
                <View className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
                  <View className="h-full w-[68%] bg-accent rounded-full" />
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 bg-white/15 rounded-lg px-2 py-1.5 border border-white/20">
      <Text className="text-[9px] text-white/70">{label}</Text>
      <Text className="text-xs font-bold text-white">{value}</Text>
    </View>
  );
}
