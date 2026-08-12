/**
 * BuildFlow - GST Calculation Service.
 *
 * Implements Indian GST logic:
 *  - Intra-state: split into CGST + SGST (gstRate / 2 each)
 *  - Inter-state: single IGST (full rate)
 *  - TDS Section 194C: default 2% on contractor payments (configurable)
 */
export interface GSTBreakdown {
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  tdsAmount: number;
  netPayable: number;
  isIntraState: boolean;
}

export interface GSTCalcInput {
  subtotal: number;
  gstRate: number; // e.g. 18 means 18%
  tdsEnabled: boolean;
  tdsRate: number; // e.g. 2 means 2%
  companyState: string;
  clientState?: string;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Line amount from qty × rate in integer paise (FIN-M1). */
export function lineAmount(qty: number, rate: number): number {
  return Math.round(Number(qty) * Number(rate) * 100) / 100;
}

/** Sum pre-rounded line amounts without float drift. */
export function sumAmounts(amounts: number[]): number {
  const paise = amounts.reduce((s, a) => s + Math.round(a * 100), 0);
  return paise / 100;
}

/** subtotal + gst − tds in paise (FIN-M1). */
export function netTotal(subtotal: number, gstAmount: number, tdsAmount: number): number {
  const paise =
    Math.round(subtotal * 100) + Math.round(gstAmount * 100) - Math.round(tdsAmount * 100);
  return paise / 100;
}

/**
 * Calculate GST breakdown for an invoice/bill.
 * If clientState is missing, defaults to inter-state (IGST).
 */
export function calculateGST(input: GSTCalcInput): GSTBreakdown {
  const { subtotal, gstRate, tdsEnabled, tdsRate, companyState, clientState } = input;
  const isIntraState = !!(clientState && clientState.toUpperCase() === companyState.toUpperCase());

  // FIX (FIN-M1): Do money math in integer paise (cents) internally to avoid
  // floating-point penny drift. Round only once, at the end. This ensures the
  // sum of rounded line items reconciles to the rounded total.
  const subtotalPaise = Math.round(subtotal * 100);

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (isIntraState) {
    // CGST + SGST = gstRate% split evenly. Compute total GST first in paise,
    // then split - avoids rounding twice.
    const totalGstPaise = Math.round((subtotalPaise * gstRate) / 100);
    cgstPaise = Math.round(totalGstPaise / 2);
    sgstPaise = totalGstPaise - cgstPaise;
  } else {
    igstPaise = Math.round((subtotalPaise * gstRate) / 100);
  }

  const gstAmountPaise = cgstPaise + sgstPaise + igstPaise;
  const tdsAmountPaise = tdsEnabled ? Math.round((subtotalPaise * tdsRate) / 100) : 0;
  const netPayablePaise = subtotalPaise + gstAmountPaise - tdsAmountPaise;

  return {
    subtotal: round2(subtotal),
    cgstAmount: cgstPaise / 100,
    sgstAmount: sgstPaise / 100,
    igstAmount: igstPaise / 100,
    gstAmount: gstAmountPaise / 100,
    tdsAmount: tdsAmountPaise / 100,
    netPayable: netPayablePaise / 100,
    isIntraState,
  };
}

/**
 * Convert a number to Indian numbering words (approximate, whole rupees).
 */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    return `${tens[Math.floor(num / 10)]}${ones[num % 10] ? ' ' + ones[num % 10] : ''}`;
  }

  function threeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const r = num % 100;
    let str = '';
    if (h) str += `${ones[h]} Hundred`;
    if (r) str += `${h ? ' ' : ''}${twoDigits(r)}`;
    return str;
  }

  // FIX (NR-14/FIN-L8): Handle amounts ≥ 1 arab (100 crore) and ≥ 1 kharab
  // correctly. The previous "fix" used 10^10/10^12 for arab/kharab - that's
  // 10x too large, so values from 1,000 crore upward rendered wrong words
  // (e.g. 1 arab = 10^9, not 10^10). Correct Indian grouping:
  //   1 crore  = 10^7
  //   1 arab   = 10^9   (= 100 crore)
  //   1 kharab = 10^11  (= 100 arab = 10,000 crore)
  let num = n;
  const kharab = Math.floor(num / 1e11); // 10^11
  num %= 1e11;
  const arab = Math.floor(num / 1e9); // 10^9
  num %= 1e9;
  const crore = Math.floor(num / 10000000); // 10^7
  num %= 10000000;
  const lakh = Math.floor(num / 100000); // 10^5
  num %= 100000;
  const thousand = Math.floor(num / 1000); // 10^3
  num %= 1000;
  const hundred = num;

  let words = '';
  if (kharab) words += `${threeDigits(kharab)} Kharab `;
  if (arab) words += `${threeDigits(arab)} Arab `;
  if (crore) words += `${threeDigits(crore)} Crore `;
  if (lakh) words += `${twoDigits(lakh)} Lakh `;
  if (thousand) words += `${twoDigits(thousand)} Thousand `;
  if (hundred) words += threeDigits(hundred);

  return `${words.trim()} Rupees Only`;
}