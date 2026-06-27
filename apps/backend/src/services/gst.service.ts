/**
 * BuildFlow — GST Calculation Service.
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

/**
 * Calculate GST breakdown for an invoice/bill.
 * If clientState is missing, defaults to inter-state (IGST).
 */
export function calculateGST(input: GSTCalcInput): GSTBreakdown {
  const { subtotal, gstRate, tdsEnabled, tdsRate, companyState, clientState } = input;
  const isIntraState = !!(clientState && clientState.toUpperCase() === companyState.toUpperCase());

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isIntraState) {
    const half = gstRate / 2;
    cgstAmount = round2((subtotal * half) / 100);
    sgstAmount = round2((subtotal * half) / 100);
  } else {
    igstAmount = round2((subtotal * gstRate) / 100);
  }

  const gstAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const tdsAmount = tdsEnabled ? round2((subtotal * tdsRate) / 100) : 0;
  const netPayable = round2(subtotal + gstAmount - tdsAmount);

  return {
    subtotal: round2(subtotal),
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount,
    tdsAmount,
    netPayable,
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

  let num = n;
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  let words = '';
  if (crore) words += `${twoDigits(crore)} Crore `;
  if (lakh) words += `${twoDigits(lakh)} Lakh `;
  if (thousand) words += `${twoDigits(thousand)} Thousand `;
  if (hundred) words += threeDigits(hundred);

  return `${words.trim()} Rupees Only`;
}