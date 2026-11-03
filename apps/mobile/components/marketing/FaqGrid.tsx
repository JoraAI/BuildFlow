import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { filteredMarketingFaq } from '@/utils/marketing-variant';

export function FaqGrid() {
  const { isMarketingDesktop } = useViewport();
  const faqs = filteredMarketingFaq();

  if (isMarketingDesktop) {
    return (
      <View className="w-full flex-row flex-wrap gap-4">
        {faqs.map((item) => (
          <View key={item.q} className="w-[48%] min-w-0">
            <Card className="h-full">
              <Text className="text-base font-bold text-text mb-2">{item.q}</Text>
              <Text className="text-sm text-muted leading-relaxed">{item.a}</Text>
            </Card>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="w-full gap-3">
      {faqs.map((item) => (
        <Card key={item.q}>
          <Text className="text-base font-bold text-text mb-2">{item.q}</Text>
          <Text className="text-sm text-muted leading-relaxed">{item.a}</Text>
        </Card>
      ))}
    </View>
  );
}
