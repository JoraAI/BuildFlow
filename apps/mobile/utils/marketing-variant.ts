/**
 * Filters public marketing content for native product-locked installs.
 * Web (`getAppVariant() === 'web'`) keeps the full dual-product surface.
 */
import { appDisplayName, getAppVariant } from '@/constants/app-variant';
import {
  HERO_STATS,
  MARKETING_FAQ,
  MARKETING_FEATURES,
  MARKETING_PRICING,
  MARKETING_TESTIMONIALS,
  PRICING_FAQ,
  TRUST_PILLS,
  TRIAL_CTA,
  type PricingTierKey,
} from '@/constants/marketing';

export function showsErpMarketing(): boolean {
  return getAppVariant() !== 'inventory';
}

export function showsInventoryMarketing(): boolean {
  return getAppVariant() !== 'construction';
}

export function marketingBrandName(): string {
  return appDisplayName();
}

export function landingHeroCopy() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return {
      eyebrow: 'BuildFlow Inventory',
      titleMobile: 'Stock, sales, and GST for your store.',
      titleDesktop: 'Inventory built for trading businesses.',
      bodyMobile:
        'Business profiles, multi-warehouse stock, SO→challan, parties, invoices, bills, and Tally — without construction project tools.',
      bodyDesktop:
        'Retail, wholesale, distribution, trading, materials, and equipment profiles with warehouses, procurement, sales, parties, GST invoices, and Tally.',
    };
  }
  if (v === 'construction') {
    return {
      eyebrow: 'BuildFlow · Construction ERP',
      titleMobile: 'Projects, estimates, and GST accounting.',
      titleDesktop: 'Construction ERP for Indian contractors.',
      bodyMobile:
        'Run projects with estimation, site reports, CPM planning, and GST accounting — built for the field and the office.',
      bodyDesktop:
        'Full construction suite: projects, BOQ & estimation, daily site reports, CPM planning, procurement, and GST accounting.',
    };
  }
  return {
    eyebrow: 'BuildFlow · Construction ERP + Exclusive Inventory',
    titleMobile: 'Construction ERP and exclusive inventory.',
    titleDesktop: 'One platform for sites and stores.',
    bodyMobile:
      'Run projects with GST accounting, or stock with Inventory profiles - retail, wholesale, trading, materials, equipment - plus warehouses, SO→challan, invoices & Tally.',
    bodyDesktop:
      'Construction firms get full ERP and GST accounting. Stock businesses get Inventory with profiles (retail through equipment), multi-warehouse, sales orders & challans, parties, procurement, invoices, bills, and Tally.',
  };
}

export function landingCtaCopy() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return {
      title: 'Ready for BuildFlow Inventory?',
      body: '14-day free trial for stock businesses. No credit card.',
    };
  }
  if (v === 'construction') {
    return {
      title: 'Ready for Construction ERP?',
      body: '14-day free trial for contractors. No credit card.',
    };
  }
  return {
    title: 'Ready for ERP or exclusive Inventory?',
    body: '14-day free trial for Construction ERP or Inventory (retail through equipment profiles). No credit card.',
  };
}

export function landingFeaturesSection() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return {
      title: 'Built for stores and trading desks',
      subtitle: 'Warehouses, sales, parties, and GST accounting for inventory businesses',
    };
  }
  if (v === 'construction') {
    return {
      title: 'Built for construction firms',
      subtitle: 'Projects, estimates, site reports, planning, and GST accounting',
    };
  }
  return {
    title: 'ERP for sites. Inventory for stores.',
    subtitle:
      'Construction project suite plus Inventory with business profiles, warehouses, and GST accounting',
  };
}

export function landingTrustSection() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return {
      title: 'Trusted by stock businesses',
      subtitle: 'What teams say about BuildFlow Inventory',
    };
  }
  if (v === 'construction') {
    return {
      title: 'Trusted by construction teams',
      subtitle: 'What teams say about BuildFlow',
    };
  }
  return {
    title: 'Trusted across construction and stock',
    subtitle: 'What teams say about BuildFlow',
  };
}

export function pricingPageSubtitle(): string {
  const v = getAppVariant();
  if (v === 'inventory') {
    return 'BuildFlow Inventory from ₹799/mo. Every free trial is 14 days, no credit card.';
  }
  if (v === 'construction') {
    return 'Construction ERP plans from ₹1,999/mo. Every free trial is 14 days, no credit card.';
  }
  return 'Construction ERP plans and exclusive Inventory from ₹799/mo. Every free trial is 14 days, no credit card.';
}

export function footerBlurb(): string {
  const v = getAppVariant();
  if (v === 'inventory') {
    return 'Stock, sales, and GST accounting for Indian trading businesses.';
  }
  if (v === 'construction') {
    return 'Construction project planning, estimation, and accounting - built for Indian contractors.';
  }
  return 'Construction ERP and Inventory for Indian contractors and trading businesses.';
}

export function filteredFeatures() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return [
      {
        icon: 'cube-outline' as const,
        title: 'Stock & warehouses',
        description:
          'Multi-warehouse on-hand, transfers, counts, and barcode identify for retail through equipment profiles.',
      },
      {
        icon: 'cart-outline' as const,
        title: 'Sales & procurement',
        description:
          'Quotes, sales orders, challans, Indent→PO→GRN, parties, and price lists without a construction UI.',
      },
      {
        icon: 'cash-outline' as const,
        title: 'GST & Tally',
        description: 'Invoices, vendor bills, GST, and Tally export built for trading desks.',
      },
    ];
  }
  if (v === 'construction') {
    return MARKETING_FEATURES.filter((f) => f.title !== 'Exclusive Inventory').map((f) =>
      f.title === 'GST Accounting'
        ? {
            ...f,
            description: 'Invoices, bills, GST, and TDS for construction finance.',
          }
        : f,
    );
  }
  return MARKETING_FEATURES;
}

export function filteredTestimonials() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return MARKETING_TESTIMONIALS.filter((t) => /inventory|stock|store|materials/i.test(t.quote + t.role));
  }
  if (v === 'construction') {
    return MARKETING_TESTIMONIALS.filter((t) => !/inventory|stock|store|materials/i.test(t.quote));
  }
  return MARKETING_TESTIMONIALS;
}

export function filteredPricingPlans() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return MARKETING_PRICING.filter((p) => p.name === 'Inventory');
  }
  if (v === 'construction') {
    return MARKETING_PRICING.filter((p) => p.name !== 'Inventory');
  }
  return MARKETING_PRICING;
}

export function filteredHeroStats() {
  const v = getAppVariant();
  if (v === 'web') return HERO_STATS;
  return HERO_STATS.filter((s) => s.label !== 'Two products').concat(
    v === 'inventory'
      ? [{ value: 'Profiles', label: 'Retail → equipment' }]
      : [{ value: 'Sites', label: 'Projects & BOQ' }],
  );
}

export function filteredTrustPills() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return TRUST_PILLS.filter((p) => !/BOQ|Daily reports/i.test(p));
  }
  if (v === 'construction') {
    return TRUST_PILLS.filter((p) => !/Inventory profiles/i.test(p));
  }
  return TRUST_PILLS;
}

export function filteredMarketingFaq() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return MARKETING_FAQ.filter(
      (item) => !/difference between Construction ERP and Inventory/i.test(item.q),
    ).map((item) => {
      if (/How much does BuildFlow cost/i.test(item.q)) {
        return {
          ...item,
          a: 'Visit Pricing: Inventory from ₹799/mo. Includes a 14-day free trial. Prices are ex-GST.',
        };
      }
      if (/Who can sign up/i.test(item.q)) {
        return {
          ...item,
          a: 'Company owners start an Inventory free trial. Team members join via an invite link from their company owner.',
        };
      }
      if (/both products/i.test(item.a)) {
        return { ...item, a: item.a.replace('both products', 'Inventory') };
      }
      return item;
    });
  }
  if (v === 'construction') {
    return MARKETING_FAQ.filter(
      (item) =>
        !/inventory \/ trading businesses sign up/i.test(item.q) &&
        !/difference between Construction ERP and Inventory/i.test(item.q),
    ).map((item) => {
      if (/How much does BuildFlow cost/i.test(item.q)) {
        return {
          ...item,
          a: 'Visit Pricing: construction Starter from ₹1,999/mo. All tiers include a 14-day free trial. Prices are ex-GST.',
        };
      }
      if (/Who can sign up/i.test(item.q)) {
        return {
          ...item,
          a: 'Company owners start a Construction ERP free trial. Team members join via an invite link from their company owner.',
        };
      }
      if (/both products/i.test(item.a)) {
        return { ...item, a: item.a.replace('both products', 'Construction ERP') };
      }
      return item;
    });
  }
  return MARKETING_FAQ;
}

export function filteredPricingFaq() {
  const v = getAppVariant();
  if (v === 'inventory') {
    return PRICING_FAQ.map((item) => {
      if (/free trial/i.test(item.q)) {
        return { ...item, a: 'Yes. BuildFlow Inventory includes a 14-day free trial with full access.' };
      }
      if (/change plans/i.test(item.q)) {
        return {
          ...item,
          a: 'Inventory is a single product plan. Contact us if you need help with billing or switching products.',
        };
      }
      if (/annual billing/i.test(item.q)) {
        return {
          ...item,
          a: 'Yes. Inventory is ₹7,990/year (2 months free vs monthly). Prices are before 18% GST.',
        };
      }
      return item;
    });
  }
  if (v === 'construction') {
    return PRICING_FAQ.map((item) => {
      if (/free trial/i.test(item.q)) {
        return {
          ...item,
          a: 'Yes. Construction ERP plans include a 14-day free trial with full access to that plan’s features.',
        };
      }
      if (/change plans/i.test(item.q)) {
        return {
          ...item,
          a: 'You can upgrade or downgrade construction plans at any time. Contact us if you need help.',
        };
      }
      if (/annual billing/i.test(item.q)) {
        return {
          ...item,
          a: 'Yes. Starter is ₹19,990/year and Professional is ₹49,990/year (2 months free vs monthly). Enterprise pricing is custom. All prices are before 18% GST.',
        };
      }
      return item;
    });
  }
  return PRICING_FAQ;
}

export function comparisonColumns(): {
  keys: PricingTierKey[];
  headers: string[];
} {
  const v = getAppVariant();
  if (v === 'inventory') {
    return { keys: ['inventory'], headers: ['Inventory'] };
  }
  if (v === 'construction') {
    return {
      keys: ['starter', 'professional', 'enterprise'],
      headers: ['Starter', 'Professional', 'Enterprise'],
    };
  }
  return {
    keys: ['inventory', 'starter', 'professional', 'enterprise'],
    headers: ['Inventory', 'Starter', 'Professional', 'Enterprise'],
  };
}

export function visibleTrialCtas() {
  const items: Array<(typeof TRIAL_CTA)['erp' | 'inventory']> = [];
  if (showsErpMarketing()) items.push(TRIAL_CTA.erp);
  if (showsInventoryMarketing()) items.push(TRIAL_CTA.inventory);
  return items;
}
