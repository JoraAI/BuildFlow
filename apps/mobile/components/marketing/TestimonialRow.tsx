import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { MARKETING_TESTIMONIALS } from '@/constants/marketing';

export function TestimonialRow() {
  const { isMarketingDesktop } = useViewport();

  return (
    <View className={`w-full gap-4 ${isMarketingDesktop ? 'flex-row items-stretch' : ''}`}>
      {MARKETING_TESTIMONIALS.map((t) => (
        <View key={t.name} className={isMarketingDesktop ? 'flex-1 min-w-0' : 'w-full'}>
          <Card className="h-full">
            <Text className="text-4xl text-accent/30 font-serif leading-none mb-2">"</Text>
            <Text className="text-sm text-text leading-relaxed mb-4">{t.quote}</Text>
            <Text className="text-sm font-bold text-text">{t.name}</Text>
            <Text className="text-xs text-muted">{t.role}</Text>
          </Card>
        </View>
      ))}
    </View>
  );
}
