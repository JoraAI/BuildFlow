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
        subtitle="Construction ERP plans and exclusive Inventory from ₹499/mo. Every free trial is 14 days, no credit card."
      >
        <PricingPreview />
        <TrustStrip />
        <PricingComparisonTable />
      </MarketingSection>
      <FullBleedCta />
    </MarketingPageShell>
  );
}
