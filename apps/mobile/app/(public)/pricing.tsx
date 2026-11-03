import React from 'react';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { PricingComparisonTable, TrustStrip } from '@/components/marketing/PricingComparisonTable';
import { FullBleedCta } from '@/components/marketing/FullBleedCta';
import { pricingPageSubtitle } from '@/utils/marketing-variant';

export default function PricingPage() {
  return (
    <MarketingPageShell>
      <MarketingSection title="Pricing" subtitle={pricingPageSubtitle()}>
        <PricingPreview />
        <TrustStrip />
        <PricingComparisonTable />
      </MarketingSection>
      <FullBleedCta />
    </MarketingPageShell>
  );
}
