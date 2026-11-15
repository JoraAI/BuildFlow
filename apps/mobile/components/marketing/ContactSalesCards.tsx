import React from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { showsErpMarketing, showsInventoryMarketing } from '@/utils/marketing-variant';
import { MARKETING_SALES_EMAIL } from '@/constants/marketing';

type ProductCard = {
  key: string;
  name: string;
  description: string;
  highlights: string[];
  subject: string;
};

const PRODUCTS: ProductCard[] = [
  {
    key: 'erp',
    name: 'Construction ERP',
    description:
      'Projects, estimates, site reports, CPM planning, procurement, and GST accounting for contractors.',
    highlights: [
      'Estimation & BOQ',
      'Daily site reports',
      'GST invoicing & TDS',
      'Team access for office and field',
    ],
    subject: 'BuildFlow Construction ERP — pricing enquiry',
  },
  {
    key: 'inventory',
    name: 'Inventory Management',
    description:
      'Stock, warehouses, procurement, sales, parties, invoices, and Tally for trading businesses.',
    highlights: [
      'Business profiles (retail → equipment)',
      'Multi-warehouse & stock counts',
      'Indent → PO → GRN',
      'Quotes, sales orders & challans',
    ],
    subject: 'BuildFlow Inventory — pricing enquiry',
  },
];

function openSalesMail(subject: string, productName: string) {
  const body = [
    `Hi BuildFlow team,`,
    ``,
    `I'd like pricing details for ${productName}.`,
    ``,
    `Company:`,
    `Name:`,
    `Phone:`,
    `City:`,
    `Team size:`,
    ``,
    `Thanks`,
  ].join('\n');
  const url = `mailto:${MARKETING_SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  void Linking.openURL(url).catch(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    }
  });
}

/** Contact-sales cards for Construction ERP and Inventory (no public price list). */
export function ContactSalesCards() {
  const { isMarketingDesktop } = useViewport();
  const cards = PRODUCTS.filter((p) =>
    p.key === 'erp' ? showsErpMarketing() : showsInventoryMarketing(),
  );

  return (
    <View className={`w-full gap-4 ${isMarketingDesktop ? 'flex-row items-stretch' : ''}`}>
      {cards.map((p) => (
        <View key={p.key} className={isMarketingDesktop ? 'flex-1 min-w-0' : 'w-full'}>
          <Card className="h-full">
            <Text className="text-lg font-bold text-text">{p.name}</Text>
            <Text className="text-sm text-muted mt-2 mb-4 leading-relaxed">{p.description}</Text>
            {p.highlights.map((feat) => (
              <View key={feat} className="flex-row items-center mb-2">
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text className="text-sm text-text ml-2 flex-1">{feat}</Text>
              </View>
            ))}
            <View className="mt-4 gap-2">
              <Button
                label="Connect with our team"
                variant="accent"
                size="sm"
                fullWidth
                onPress={() => openSalesMail(p.subject, p.name)}
              />
              <Text className="text-xs text-muted text-center">
                We’ll share a plan that fits your team — no public price list.
              </Text>
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}
