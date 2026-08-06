/**
 * BuildFlow - Shared package barrel
 *
 * Usage:
 *   import { Role, loginSchema, formatINR } from '@buildflow/shared';
 *   import type { AuthUser } from '@buildflow/shared';
 *   import { Role } from '@buildflow/shared/enums';
 *   import { loginSchema } from '@buildflow/shared/validators';
 */

export * from './enums';
export * from './types';
export * from './validators';
export * from './constants';
export * from './pricing';
export * from './subscription-limits';
export * from './permissions';
export * from './utils/date';

/* ------------------------------------------------------------------ */
/* Formatting utilities (no deps - safe for RN + Node)                 */
/* ------------------------------------------------------------------ */

/** Format a number as Indian currency: ₹1,23,456.78 (lakhs grouping). */
export function formatINR(amount: number, opts: { decimals?: number } = {}): string {
  const { decimals = 2 } = opts;
  const fixed = Math.abs(amount).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  // Indian numbering: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  const grouped =
    otherNumbers !== ''
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;
  const sign = amount < 0 ? '-' : '';
  const out = decPart ? `${grouped}.${decPart}` : grouped;
  return `${sign}₹${out}`;
}

/** Compact INR: ₹1.2L, ₹3.4Cr, ₹12.5K. */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Convert number to Indian-English words for invoice amounts. */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000)
      return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    return (
      inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '')
    ).trim();
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let words = '';
  if (rupees > 0) {
    // Handle lakhs/crores grouping
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const hundred = rupees % 1000;
    const parts: string[] = [];
    if (crore) parts.push(`${inWords(crore)} Crore`);
    if (lakh) parts.push(`${inWords(lakh)} Lakh`);
    if (thousand) parts.push(`${inWords(thousand)} Thousand`);
    if (hundred) parts.push(inWords(hundred));
    words = parts.join(' ');
  }
  if (paise > 0) {
    words += ` and ${inWords(paise)} Paise`;
  }
  return `${words.trim()} Rupees Only`;
}

/** Round to 2 decimals (GST-safe). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}