import React from 'react';
import { View, ScrollView } from 'react-native';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export function MarketingPageShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 bg-surface">
      <MarketingNav />
      <ScrollView className="flex-1" contentContainerClassName="pb-0">
        {children}
        <MarketingFooter />
      </ScrollView>
    </View>
  );
}
