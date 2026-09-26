/**
 * BuildFlow - WhatsApp Studio & 1-Tap Progress / Wage / Petty Cash Share Utility.
 * Formats rich branded WhatsApp messages and opens WhatsApp directly via deep linking.
 */
import { Linking, Platform } from 'react-native';
import { formatINR } from '@/utils/format';

function openWhatsAppUrl(text: string) {
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/?text=${encoded}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(() => {
      // Fallback
    });
  }
}

export function generateWhatsAppPettyCashShare(params: {
  entryNumber: string;
  amount: number;
  category: string;
  description: string;
  paidTo: string;
  status: string;
  projectName?: string;
}) {
  const msg = `*BUILDFLOW SITE EXPENSE VOUCHER* 🧾\n` +
    `--------------------------------\n` +
    `*Voucher No:* ${params.entryNumber}\n` +
    (params.projectName ? `*Project:* ${params.projectName}\n` : '') +
    `*Category:* ${params.category}\n` +
    `*Description:* ${params.description}\n` +
    `*Amount:* ${formatINR(params.amount)}\n` +
    `*Paid To:* ${params.paidTo}\n` +
    `*Status:* ${params.status}\n` +
    `--------------------------------\n` +
    `_Generated via BuildFlow Field ERP_`;

  openWhatsAppUrl(msg);
}

export function generateWhatsAppLaborWageShare(params: {
  projectName: string;
  workerName: string;
  trade: string;
  daysWorked: number;
  dailyRate: number;
  otHours: number;
  netPay: number;
  weekEnding: string;
}) {
  const msg = `*BUILDFLOW WEEKLY WAGE SLIP* 👷‍♂️\n` +
    `--------------------------------\n` +
    `*Project:* ${params.projectName}\n` +
    `*Worker:* ${params.workerName} (${params.trade})\n` +
    `*Week Ending:* ${params.weekEnding}\n` +
    `*Days Worked:* ${params.daysWorked} days @ ${formatINR(params.dailyRate)}/day\n` +
    `*Overtime:* ${params.otHours} hrs\n` +
    `*Net Payout:* ${formatINR(params.netPay)}\n` +
    `--------------------------------\n` +
    `_Approved by Site Engineer via BuildFlow_`;

  openWhatsAppUrl(msg);
}

export function generateWhatsAppDailyReportShare(params: {
  projectName: string;
  reportDate: string;
  workDoneSummary: string;
  laborCount: number;
  weather?: string;
  materialsReceived?: string;
}) {
  const msg = `*DAILY PROGRESS REPORT (DPR)* 🏗️\n` +
    `--------------------------------\n` +
    `*Project:* ${params.projectName}\n` +
    `*Date:* ${params.reportDate}\n` +
    (params.weather ? `*Weather:* ${params.weather}\n` : '') +
    `*Total Site Headcount:* ${params.laborCount} workers\n\n` +
    `*Key Work Executed:*\n${params.workDoneSummary}\n\n` +
    (params.materialsReceived ? `*Materials Inward:* ${params.materialsReceived}\n\n` : '') +
    `--------------------------------\n` +
    `_View full live report & attachments on BuildFlow_`;

  openWhatsAppUrl(msg);
}

export function generateWhatsAppQuoteShare(params: {
  quoteNumber: string;
  customerName: string;
  eventName?: string | null;
  quoteDate: string;
  validUntil?: string | null;
  items: Array<{ name: string; qty: number; unit: string; rate: number; amount: number }>;
  total: number;
  /** Event / lighting wording (default false for general inventory quotes). */
  eventLighting?: boolean;
}) {
  const lineSummary = params.items
    .map((it) => `• ${it.name} - ${it.qty} ${it.unit} @ ${formatINR(it.rate)} = ${formatINR(it.amount)}`)
    .join('\n');

  const eventLighting = params.eventLighting === true;
  const title = eventLighting ? '*EVENT ESTIMATE & QUOTATION* 💡✨\n' : '*QUOTATION*\n';
  const partyLabel = eventLighting ? '*Client / Organization:*' : '*Customer:*';
  const notesLabel = eventLighting ? '*Event / Occasion:*' : '*Reference / Notes:*';
  const breakdownLabel = eventLighting ? '*Requirement Breakdown:*' : '*Line items:*';
  const totalLabel = eventLighting ? '*Estimated Total:*' : '*Total:*';
  const footer = eventLighting
    ? '_Prepared via BuildFlow Lighting & Inventory Platform_'
    : '_Prepared via BuildFlow Inventory_';

  const msg =
    title +
    `--------------------------------\n` +
    `*Quote No:* ${params.quoteNumber}\n` +
    `${partyLabel} ${params.customerName}\n` +
    (params.eventName ? `${notesLabel} ${params.eventName}\n` : '') +
    `*Quote Date:* ${params.quoteDate}\n` +
    (params.validUntil ? `*Valid Until:* ${params.validUntil}\n` : '') +
    `--------------------------------\n` +
    `${breakdownLabel}\n` +
    lineSummary + '\n' +
    `--------------------------------\n` +
    `${totalLabel} ${formatINR(params.total)}\n` +
    `--------------------------------\n` +
    footer;

  openWhatsAppUrl(msg);
}
