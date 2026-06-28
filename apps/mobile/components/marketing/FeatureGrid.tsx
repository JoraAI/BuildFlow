import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { MARKETING_FEATURES } from '@/constants/marketing';

export function FeatureGrid() {
  const { isMarketingDesktop } = useViewport();

  return (
    <View className={`w-full gap-4 ${isMarketingDesktop ? 'flex-row flex-wrap' : ''}`}>
      {MARKETING_FEATURES.map((f) => (
        <View
          key={f.title}
          className={isMarketingDesktop ? 'w-[31%] min-w-[240px] flex-1' : 'w-full'}
        >
          <Card className="h-full min-h-[180px]">
            <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center mb-3">
              <Ionicons name={f.icon} size={22} color="#1E3A5F" />
            </View>
            <Text className="text-base font-bold text-text mb-1">{f.title}</Text>
            <Text className="text-sm text-muted leading-relaxed">{f.description}</Text>
          </Card>
        </View>
      ))}
    </View>
  );
}
