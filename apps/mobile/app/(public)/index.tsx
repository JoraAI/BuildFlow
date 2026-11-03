/**
 * BuildFlow public landing page.
 * Native locked builds show product-specific sections; web keeps both products.
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
import {
  landingFeaturesSection,
  landingTrustSection,
} from '@/utils/marketing-variant';

export default function LandingPage() {
  const features = landingFeaturesSection();
  const trust = landingTrustSection();

  return (
    <MarketingPageShell>
      <DesktopHero />

      <MarketingSection id="features" title={features.title} subtitle={features.subtitle}>
        <FeatureGrid />
      </MarketingSection>

      <MarketingSection title={trust.title} subtitle={trust.subtitle} className="bg-card">
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
