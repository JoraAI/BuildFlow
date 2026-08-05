/**
 * BuildFlow — Shared report PDF download helper.
 *
 * Centralizes the download + share pattern used by Reports Hub, Subcontracts,
 * Resources, and entity detail screens.
 */
import { apiDownload } from '@/lib/api-client';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * Download a PDF from an authenticated API path and share it via the OS share
 * sheet (or alert if sharing is unavailable).
 */
export async function downloadReportPdf(apiPath: string, filename: string): Promise<void> {
  try {
    const uri = await apiDownload(apiPath, filename, 'application/pdf');
    if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Saved', 'Report downloaded to device.');
    }
  } catch (e) {
    Alert.alert('Download failed', e instanceof Error ? e.message : 'Could not download report');
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
  // Entity-scoped
  dailyReport: (reportId: string) => `/reports/pdf/reports/${reportId}`,
  invoice: (invoiceId: string) => `/reports/pdf/invoices/${invoiceId}`,
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
