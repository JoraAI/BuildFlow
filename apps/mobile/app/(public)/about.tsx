import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { Card } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { getAppVariant, appDisplayName } from '@/constants/app-variant';

export default function AboutPage() {
  const { isMarketingDesktop } = useViewport();
  const variant = getAppVariant();
  const brand = appDisplayName();

  const values =
    variant === 'inventory'
      ? [
          {
            icon: 'shield-checkmark-outline' as const,
            title: 'Built for India',
            text: 'GST, TDS, and Indian numbering - not bolted on as an afterthought.',
          },
          {
            icon: 'phone-portrait-outline' as const,
            title: 'Store-first',
            text: 'Owners and staff manage stock, sales, and parties from mobile or desktop.',
          },
          {
            icon: 'cube-outline' as const,
            title: 'Inventory focus',
            text: 'Business profiles for retail, wholesale, distribution, trading, materials, and equipment — without construction project tools.',
          },
        ]
      : variant === 'construction'
        ? [
            {
              icon: 'shield-checkmark-outline' as const,
              title: 'Built for India',
              text: 'GST, TDS, and Indian numbering - not bolted on as an afterthought.',
            },
            {
              icon: 'phone-portrait-outline' as const,
              title: 'Field-first',
              text: 'Site supervisors report from mobile; owners manage from desktop.',
            },
            {
              icon: 'construct-outline' as const,
              title: 'Construction ERP',
              text: 'Projects, estimates, site reports, CPM planning, procurement, and GST accounting for contractors.',
            },
          ]
        : [
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

  const subtitle =
    variant === 'inventory'
      ? 'BuildFlow Inventory for Indian trading businesses who need modern stock operations with Tally-grade financial control.'
      : variant === 'construction'
        ? 'Construction ERP for Indian businesses who need modern project operations with Tally-grade financial control.'
        : 'Construction ERP and exclusive Inventory for Indian businesses who need modern operations with Tally-grade financial control.';

  const body =
    variant === 'inventory'
      ? 'We give trading businesses a dedicated Inventory path for stock, procurement, sales, invoicing, and Tally — without a construction project UI.'
      : variant === 'construction'
        ? 'We help construction firms move from spreadsheets to a unified project workflow with estimation, site reports, planning, and GST accounting.'
        : 'We help construction firms move from spreadsheets to a unified project workflow, and give trading businesses a dedicated Inventory path for stock, procurement, invoicing, and Tally.';

  const mission =
    variant === 'inventory'
      ? 'To give every materials trader and stock business software that works in the store and in the office.'
      : variant === 'construction'
        ? 'To give every construction company, from mini contractors to heavy civil firms, software that works on site and in the office.'
        : 'To give every construction company and materials business, from mini contractors to heavy civil firms and local traders, software that works on site, in the store, and in the office.';

  return (
    <MarketingPageShell>
      <MarketingSection title={`About ${brand}`} subtitle={subtitle}>
        <Text className="text-muted text-base leading-relaxed mb-10">{body}</Text>

        <View className={`gap-4 ${isMarketingDesktop ? 'flex-row' : ''}`}>
          {values.map((v) => (
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
          <Text className="text-sm text-muted leading-relaxed">{mission}</Text>
        </Card>
      </MarketingSection>
    </MarketingPageShell>
  );
}
