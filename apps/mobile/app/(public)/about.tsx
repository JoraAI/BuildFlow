import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { Card } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';

const VALUES = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Built for India',
    text: 'GST, TDS, and Indian numbering - not bolted on as an afterthought.',
  },
  {
    icon: 'phone-portrait-outline' as const,
    title: 'Field-first',
    text: 'Site supervisors report from mobile; owners and store teams manage from desktop.',
  },
  {
    icon: 'layers-outline' as const,
    title: 'ERP + Inventory',
    text: 'Construction ERP for contractors, plus Inventory with business profiles for retail, wholesale, distribution, trading, materials, and equipment.',
  },
];

export default function AboutPage() {
  const { isMarketingDesktop } = useViewport();

  return (
    <MarketingPageShell>
      <MarketingSection
        title="About BuildFlow"
        subtitle="Construction ERP and exclusive Inventory for Indian businesses who need modern operations with Tally-grade financial control."
      >
        <Text className="text-muted text-base leading-relaxed mb-10">
          We help construction firms move from spreadsheets to a unified project workflow, and give
          trading businesses a dedicated Inventory path for stock, procurement, invoicing, and Tally.
        </Text>

        <View
          className={`gap-4 ${isMarketingDesktop ? 'flex-row' : ''}`}
        >
          {VALUES.map((v) => (
            <Card key={v.title} className={isMarketingDesktop ? 'flex-1' : ''}>
              <View className="flex-row items-start gap-3">
                <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                  <Ionicons name={v.icon} size={22} color="#1E3A5F" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-text mb-1">{v.title}</Text>
                  <Text className="text-sm text-muted leading-relaxed">{v.text}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <Text className="text-base font-bold text-text mb-2">Our mission</Text>
          <Text className="text-sm text-muted leading-relaxed">
            To give every construction company and materials business, from mini contractors to
            heavy civil firms and local traders, software that works on site, in the store, and in
            the office.
          </Text>
        </Card>
      </MarketingSection>
    </MarketingPageShell>
  );
}
