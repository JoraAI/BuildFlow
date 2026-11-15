import React from 'react';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { TrustStrip } from '@/components/marketing/PricingComparisonTable';
import { FullBleedCta } from '@/components/marketing/FullBleedCta';
import { pricingPageSubtitle } from '@/utils/marketing-variant';

export default function PricingPage() {
  return (
    <MarketingPageShell>
      <MarketingSection title="Talk to our team" subtitle={pricingPageSubtitle()}>
        <PricingPreview />
        <TrustStrip />
      </MarketingSection>
      <FullBleedCta />
    </MarketingPageShell>
  );
}
