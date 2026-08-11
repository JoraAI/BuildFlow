/**
 * BuildFlow public landing page.
 */
import React from 'react';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { DesktopHero } from '@/components/marketing/DesktopHero';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { TestimonialRow } from '@/components/marketing/TestimonialRow';
import { PricingTeaser } from '@/components/marketing/PricingTeaser';
import { FaqGrid } from '@/components/marketing/FaqGrid';
import { FullBleedCta } from '@/components/marketing/FullBleedCta';

export default function LandingPage() {
  return (
    <MarketingPageShell>
      <DesktopHero />

      <MarketingSection
        id="features"
        title="ERP for sites. Inventory for stores."
        subtitle="Construction project suite plus an exclusive Inventory product with GST accounting"
      >
        <FeatureGrid />
      </MarketingSection>

      <MarketingSection
        title="Trusted across construction and stock"
        subtitle="What teams say about BuildFlow"
        className="bg-card"
      >
        <TestimonialRow />
      </MarketingSection>

      <MarketingSection
        title="Ready to compare plans?"
        subtitle="See pricing on a dedicated page"
      >
        <PricingTeaser />
      </MarketingSection>

      <MarketingSection id="faq" title="FAQ" subtitle="Common questions">
        <FaqGrid />
      </MarketingSection>

      <FullBleedCta />
    </MarketingPageShell>
  );
}
