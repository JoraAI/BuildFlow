import React from 'react';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { PricingComparisonTable, TrustStrip } from '@/components/marketing/PricingComparisonTable';
import { FullBleedCta } from '@/components/marketing/FullBleedCta';

export default function PricingPage() {
  return (
    <MarketingPageShell>
      <MarketingSection
        title="Pricing"
        subtitle="Transparent plans for contractors of every size. All plans include a 14-day free trial."
      >
        <PricingPreview />
        <TrustStrip />
        <PricingComparisonTable />
      </MarketingSection>
      <FullBleedCta />
    </MarketingPageShell>
  );
}
