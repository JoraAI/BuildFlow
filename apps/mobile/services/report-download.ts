/**
 * BuildFlow - Shared report PDF download helper.
 *
 * Centralizes the download + share pattern used by Reports Hub, Subcontracts,
 * Resources, and entity detail screens.
 */
import { apiDownload } from '@/lib/api-client';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { toast } from '@/components/ui';

/**
 * Download a PDF from an authenticated API path and share it via the OS share
 * sheet (or trigger a browser download on web).
 */
export async function downloadReportPdf(apiPath: string, filename: string): Promise<void> {
  try {
    toast.info('Preparing PDF…');
    const uri = await apiDownload(apiPath, filename, 'application/pdf');
    if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      toast.success('PDF ready to share');
      return;
    }
    // Web: apiDownload already triggered the browser download (uri is null).
    toast.success(Platform.OS === 'web' ? 'PDF download started' : 'PDF saved to device');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not download report';
    toast.error(message);
    // Alert is unreliable on web; keep it as a native fallback only.
    if (Platform.OS !== 'web') {
      Alert.alert('Download failed', message);
    }
  }
}

/**
 * Download Tally Prime import XML for a project and share / save it.
 * In the Inventory product this is the only data export - always framed as
 * "Exporting to Tally" so it is never mistaken for a generic backup.
 */
export async function downloadTallyXml(projectId: string): Promise<void> {
  toast.info('Exporting to Tally…');
  try {
    const uri = await apiDownload(
      `/projects/${projectId}/financials/export-tally`,
      `tally-${projectId}.xml`,
      'application/xml',
    );
    if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'application/xml', UTI: 'public.xml' });
      toast.success('Tally XML exported - import it in Tally Prime.');
    } else {
      toast.success('Tally XML downloaded to device - import it in Tally Prime.');
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not export to Tally');
  }
}

// ── Path helpers (named exports for every report type) ──────────────

export const reportPaths = {
  // Project-scoped
  projectProgress: (projectId: string) => `/reports/pdf/projects/${projectId}/progress`,
  estimateVsActual: (projectId: string) => `/reports/pdf/projects/${projectId}/estimate-vs-actual`,
  resourceUtilization: (projectId: string) => `/reports/pdf/projects/${projectId}/resource-utilization`,
  boqVsActual: (projectId: string) => `/reports/pdf/projects/${projectId}/boq-vs-actual`,
  profitLoss: (projectId: string) => `/reports/pdf/projects/${projectId}/profit-loss`,
  materialRates: (projectId: string) => `/reports/pdf/projects/${projectId}/material-rates`,
  measurementBook: (projectId: string) => `/reports/pdf/projects/${projectId}/measurement-book`,
  abstractSheet: (projectId: string) => `/reports/pdf/projects/${projectId}/abstract-sheet`,
  tallyExport: (projectId: string) => `/projects/${projectId}/financials/export-tally`,
  // Entity-scoped
  dailyReport: (reportId: string) => `/reports/pdf/reports/${reportId}`,
  invoice: (invoiceId: string) => `/reports/pdf/invoices/${invoiceId}`,
  bill: (billId: string) => `/reports/pdf/bills/${billId}`,
  estimateSummary: (estimateId: string) => `/reports/pdf/estimates/${estimateId}`,
  estimateComparison: (idA: string, idB: string) => `/reports/pdf/estimates/${idA}/compare/${idB}`,
  // Company-scoped
  gstSummary: () => '/reports/pdf/gst-summary',
  tds: () => '/reports/pdf/tds',
  materialPriceHistory: () => '/reports/pdf/material-price-history',
  // Subcontract-scoped
  subcontractMeasurementBook: (projectId: string, workOrderId: string) =>
    `/reports/pdf/projects/${projectId}/subcontract/work-orders/${workOrderId}/measurement-book`,
  subcontractAbstractSheet: (projectId: string, workOrderId: string) =>
    `/reports/pdf/projects/${projectId}/subcontract/work-orders/${workOrderId}/abstract-sheet`,
} as const;
