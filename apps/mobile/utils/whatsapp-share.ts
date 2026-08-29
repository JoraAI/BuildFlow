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
