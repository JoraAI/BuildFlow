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
    title: 'Integrated Accounting',
    description: 'Invoices, bills, GST, and TDS - construction finance in one place.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'BuildFlow Assistant',
    description: 'Ask about project status, pending bills, estimates, and overdue tasks.',
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
      'GST invoicing and vendor bills in one system - our accountant finally stopped chasing spreadsheets.',
    name: 'Arun Mehta',
    role: 'Finance Head, Mehta Builders',
  },
];

export const GST_PRICING_NOTE = '+ 18% GST';

export const MARKETING_PRICING = [
  {
    name: 'Starter',
    price: '₹4,999',
    period: '/month',
    annualPrice: '₹49,999/yr',
    description: 'For small contractors getting started',
    features: [
      'Up to 3 projects',
      'Estimation & BOQ',
      'Daily reports',
      'Basic invoicing',
      '5 team members',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '₹13,999',
    period: '/month',
    annualPrice: '₹1,39,999/yr',
    description: 'For growing construction firms',
    features: [
      'Unlimited projects',
      'Full accounting & GST',
      'CPM planning',
      'BuildFlow Assistant (500 queries/mo)',
      'Procurement, subcontracts & client portal',
      '25 team members',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    annualPrice: null,
    description: 'For large firms with custom needs',
    features: [
      'Everything in Professional',
      'BuildFlow Assistant (unlimited, fair use)',
      'Dedicated support',
      'Custom integrations',
      'Unlimited team members',
    ],
    highlighted: false,
  },
];

export const HERO_STATS = [
  { value: '500+', label: 'Projects managed' },
  { value: 'GST', label: 'Ready invoicing' },
  { value: '14 days', label: 'Free trial' },
];

export const TRUST_PILLS = ['GST invoicing', 'TDS on bills', 'Daily reports', 'BOQ & Estimation'];

export const TRIAL_BENEFITS = [
  '14-day free trial, no credit card',
  'Invite your entire team',
  'GST & TDS ready from day one',
];

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
    a: 'Yes. All plans include a 14-day free trial with full access to core features.',
  },
  {
    q: 'Can I change plans later?',
    a: 'You can upgrade or downgrade at any time. Changes apply from the next billing cycle.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes. Starter is ₹49,999/year and Professional is ₹1,39,999/year (2 months free vs monthly). Enterprise pricing is custom - contact sales. All prices are before 18% GST.',
  },
  {
    q: 'Is GST included in the listed price?',
    a: 'No. Plan prices shown are before GST. 18% GST is added on checkout invoices in India.',
  },
];

export type PricingTierKey = 'starter' | 'professional' | 'enterprise';

export const PRICING_COMPARISON: {
  feature: string;
  starter: string;
  professional: string;
  enterprise: string;
}[] = [
  { feature: 'Projects', starter: 'Up to 3', professional: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Team members', starter: '5', professional: '25', enterprise: 'Unlimited' },
  { feature: 'Estimation & BOQ', starter: 'Yes', professional: 'Yes', enterprise: 'Yes' },
  { feature: 'CPM Planning', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  { feature: 'Accounting & GST', starter: 'Basic', professional: 'Full', enterprise: 'Full' },
  {
    feature: 'Procurement & subcontracts',
    starter: '-',
    professional: 'Yes',
    enterprise: 'Yes',
  },
  { feature: 'Client portal', starter: '-', professional: 'Yes', enterprise: 'Yes' },
  {
    feature: 'BuildFlow Assistant',
    starter: '-',
    professional: '500 queries/mo',
    enterprise: 'Unlimited (fair use)',
  },
  { feature: 'Dedicated support', starter: '-', professional: '-', enterprise: 'Yes' },
  { feature: 'Custom integrations', starter: '-', professional: '-', enterprise: 'Yes' },
];

export const MARKETING_FAQ = [
  {
    q: 'How much does BuildFlow cost?',
    a: 'Visit our Pricing page for current plans. All tiers include a 14-day free trial.',
  },
  {
    q: 'Who can sign up for BuildFlow?',
    a: 'Company owners can start a free trial. Team members join via an invite link from their company owner.',
  },
  {
    q: 'Is BuildFlow suitable for Indian GST compliance?',
    a: 'Yes. BuildFlow supports GST invoicing, TDS on bills, and state-aware tax calculations.',
  },
  {
    q: 'Can I use BuildFlow on mobile and desktop?',
    a: 'BuildFlow works on iOS, Android, and web - one account across all devices.',
  },
  {
    q: 'How do I add my team?',
    a: 'After registering your company, go to Settings → Users & Roles and invite team members by email.',
  },
];
