import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export const MARKETING_FEATURES: {
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    icon: 'business-outline',
    title: 'Project Management',
    description: 'Track projects, budgets, and progress from planning through completion.',
  },
  {
    icon: 'calculator-outline',
    title: 'Estimation & BOQ',
    description: 'Build estimates with rate analysis, templates, and one-click BOQ conversion.',
  },
  {
    icon: 'calendar-outline',
    title: 'CPM Planning',
    description: 'Schedule tasks, manage dependencies, and spot delays before they cost you.',
  },
  {
    icon: 'document-text-outline',
    title: 'Daily Site Reports',
    description: 'Capture work done, materials used, photos, and site status from the field.',
  },
  {
    icon: 'cash-outline',
    title: 'GST Accounting',
    description: 'Invoices, bills, GST, and TDS: construction finance and inventory AR/AP in one place.',
  },
  {
    icon: 'cube-outline',
    title: 'Exclusive Inventory',
    description:
      'Dedicated stock product for traders & material suppliers: Indent→PO→GRN, sales invoices, vendor bills, Tally export.',
  },
];

export const MARKETING_TESTIMONIALS = [
  {
    quote:
      'BuildFlow replaced three separate tools for us. Estimates flow straight into BOQ and billing.',
    name: 'R. Reddy',
    role: 'Director, Reddy Constructions',
  },
  {
    quote:
      'Our site supervisors submit daily reports on mobile. The office sees everything in real time.',
    name: 'Priya Sharma',
    role: 'Project Manager, Sharma Infra',
  },
  {
    quote:
      'We run our building-materials store on Inventory: stock, POs, bills, and Tally without a construction project UI.',
    name: 'Suresh Rao',
    role: 'Owner, Hyderabad Building Materials',
  },
];

export const GST_PRICING_NOTE = '+ 18% GST';

/**
 * Prices mirror @buildflow/shared PLAN_PRICES_INR / PLAN_ANNUAL_INR
 * (single source of truth is pricing.ts). Enterprise = contact sales.
 */
export const MARKETING_PRICING = [
  {
    name: 'Inventory',
    price: '₹499',
    period: '/month',
    annualPrice: '₹4,990/yr',
    description: 'Exclusive inventory product: stock, procurement, and GST accounting for traders',
    features: [
      '1 store (Stock + movements)',
      'Procurement: Indent → PO → GRN',
      'Sales invoices & vendor bills',
      'Tally export',
      '10 team members',
      'BuildFlow Assistant (inventory scope)',
    ],
    highlighted: false,
    trialHref: '/signup/company?product=inventory',
    trialLabel: 'Inventory trial',
  },
  {
    name: 'Starter',
    price: '₹1,999',
    period: '/month',
    annualPrice: '₹19,990/yr',
    description: 'For small contractors getting started',
    features: [
      'Up to 3 projects',
      'Estimation & BOQ',
      'Daily reports',
      'Basic invoicing',
      '5 team members',
    ],
    highlighted: false,
    trialHref: '/signup/company',
    trialLabel: 'ERP trial',
  },
  {
    name: 'Professional',
    price: '₹4,999',
    period: '/month',
    annualPrice: '₹49,990/yr',
    description: 'For growing construction firms',
    features: [
      'Up to 25 projects',
      'Full accounting & GST',
      'CPM planning',
      'BuildFlow Assistant (500 queries/mo)',
      'Procurement, subcontracts & client portal',
      '25 team members',
    ],
    highlighted: true,
    trialHref: '/signup/company',
    trialLabel: 'ERP trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    annualPrice: null as string | null,
    description: 'For large firms with custom needs',
    features: [
      'Everything in Professional',
      'BuildFlow Assistant (unlimited, fair use)',
      'Dedicated support',
      'Custom integrations',
      'Unlimited team members',
    ],
    highlighted: false,
    trialHref: '/signup',
    trialLabel: 'Contact sales',
  },
];

export const HERO_STATS = [
  { value: 'ERP + Stock', label: 'Two products' },
  { value: 'GST', label: 'Ready invoicing' },
  { value: '14 days', label: 'Free trial' },
];

export const TRUST_PILLS = ['GST invoicing', 'TDS on bills', 'Daily reports', 'BOQ & Estimation'];

export const TRIAL_BENEFITS = [
  '14-day free trial, no credit card',
  'Invite your entire team',
  'GST & TDS ready from day one',
];

export const INVENTORY_TRIAL_BENEFITS = [
  '14-day free trial, no credit card',
  '1 store with stock, PO, GRN & invoices',
  'Tally export included',
];

export const TRIAL_CTA = {
  erp: {
    label: 'ERP trial',
    href: '/signup/company',
    hoverTitle: 'Construction ERP free trial',
    hoverBody:
      '14 days of projects, estimates, site reports, GST invoices & bills, procurement, and team invites. For contractors, not a trading store.',
  },
  inventory: {
    label: 'Inventory trial',
    href: '/signup/company?product=inventory',
    hoverTitle: 'Inventory free trial',
    hoverBody:
      '14 days of 1 store: stock, Indent→PO→GRN, sales invoices, vendor bills, Tally export, and inventory Assistant. For traders & material suppliers.',
  },
} as const;

export const SIGNUP_STEPS = ['Company', 'Owner', 'Create'];

export const ABOUT_TIMELINE = [
  { label: 'Estimate', icon: 'calculator-outline' as IconName },
  { label: 'Plan', icon: 'calendar-outline' as IconName },
  { label: 'Build', icon: 'construct-outline' as IconName },
  { label: 'Bill', icon: 'cash-outline' as IconName },
];

export const PRICING_FAQ = [
  {
    q: 'Is there a free trial?',
    a: 'Yes. Construction ERP plans and the Inventory product each include a 14-day free trial with full access to that product’s features.',
  },
  {
    q: 'Can I change plans later?',
    a: 'You can upgrade or downgrade construction plans at any time. Inventory is a separate product. Contact us if you need to switch product families.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes. Inventory is ₹4,990/year, Starter is ₹19,990/year and Professional is ₹49,990/year (2 months free vs monthly). Enterprise pricing is custom - contact sales. All prices are before 18% GST.',
  },
  {
    q: 'Is GST included in the listed price?',
    a: 'No. Plan prices shown are before GST. 18% GST is added on checkout invoices in India.',
  },
];

export type PricingTierKey = 'inventory' | 'starter' | 'professional' | 'enterprise';

export const PRICING_COMPARISON: Array<{
  feature: string;
  inventory: string;
  starter: string;
  professional: string;
  enterprise: string;
}> = [
  { feature: 'Projects / stores', inventory: '1 store', starter: 'Up to 3', professional: '25', enterprise: 'Unlimited' },
  { feature: 'Team members', inventory: '10', starter: '5', professional: '25', enterprise: 'Unlimited' },
  { feature: 'Stock & procurement', inventory: 'Yes', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  { feature: 'Sales invoices & vendor bills', inventory: 'Yes', starter: 'Basic', professional: 'Full', enterprise: 'Full' },
  { feature: 'Tally export', inventory: 'Yes', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  { feature: 'Estimation & BOQ', inventory: '-', starter: 'Yes', professional: 'Yes', enterprise: 'Yes' },
  { feature: 'CPM Planning', inventory: '-', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  {
    feature: 'Subcontracts & portal',
    inventory: 'Procurement',
    starter: '-',
    professional: 'Yes',
    enterprise: 'Yes',
  },
  { feature: 'Client portal', inventory: '-', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  {
    feature: 'BuildFlow Assistant',
    inventory: 'Inventory scope',
    starter: '-',
    professional: '500 queries/mo',
    enterprise: 'Unlimited (fair use)',
  },
  { feature: 'Dedicated support', inventory: '-', starter: '-', professional: '-', enterprise: 'Yes' },
  { feature: 'Custom integrations', inventory: '-', starter: '-', professional: '-', enterprise: 'Yes' },
];

export const MARKETING_FAQ = [
  {
    q: 'How much does BuildFlow cost?',
    a: 'Visit Pricing: Inventory from ₹499/mo, construction Starter from ₹1,999/mo. All tiers include a 14-day free trial. Prices are ex-GST.',
  },
  {
    q: 'How do inventory / trading businesses sign up?',
    a: 'Choose “Start Inventory trial” on the homepage or Pricing, or open Sign up → Inventory free trial. That creates an Inventory account (stock, procurement, invoices, bills, Tally), not the construction project ERP.',
  },
  {
    q: 'What’s the difference between Construction ERP and Inventory?',
    a: 'Construction ERP covers projects, estimates, site reports, and project accounting. Inventory is an exclusive product for stores and traders: one store, Indent→PO→GRN, sales invoices, vendor bills, and Tally, without construction modules.',
  },
  {
    q: 'Who can sign up for BuildFlow?',
    a: 'Company owners start a free trial (Construction or Inventory). Team members join via an invite link from their company owner.',
  },
  {
    q: 'Is BuildFlow suitable for Indian GST compliance?',
    a: 'Yes. BuildFlow supports GST invoicing, TDS on bills, and state-aware tax calculations for both products.',
  },
  {
    q: 'Can I use BuildFlow on mobile and desktop?',
    a: 'BuildFlow works on iOS, Android, and web - one account across all devices.',
  },
];
