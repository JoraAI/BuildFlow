/**
 * BuildFlow - PDF report controller (12 report types).
 */
import { Request, Response } from 'express';
import * as svc from '../services/pdf-report.service';

function sendPdf(res: Response, result: svc.PdfResult) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
  return res.status(200).send(result.buffer);
}

// 1. Project Progress
export async function getProjectProgressPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportProjectProgress(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 2. Daily Report
export async function getDailyReportPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportDailyReport(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 3. Invoice
export async function getInvoicePdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportInvoice(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 4. Estimate
export async function getEstimatePdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportEstimate(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 5. Estimate Comparison
export async function getEstimateComparisonPdf(req: Request, res: Response) {
  const { idA, idB } = req.params;
  const result = await svc.reportEstimateComparison(req.user!.companyId, idA, idB);
  return sendPdf(res, result);
}

// 6. Estimate vs Actual
export async function getEstimateVsActualPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportEstimateVsActual(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 7. P&L
export async function getProfitLossPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportProfitLoss(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 8. GST Summary
export async function getGstSummaryPdf(req: Request, res: Response) {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const result = await svc.reportGstSummary(req.user!.companyId, from, to);
  return sendPdf(res, result);
}

// 9. TDS Report
export async function getTdsPdf(req: Request, res: Response) {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const result = await svc.reportTds(req.user!.companyId, from, to);
  return sendPdf(res, result);
}

// 10. Resource Utilization
export async function getResourceUtilizationPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportResourceUtilization(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 11. BOQ vs Actual
export async function getBoqVsActualPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportBoqVsActual(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 12. Material Price History
export async function getMaterialPriceHistoryPdf(req: Request, res: Response) {
  const result = await svc.reportMaterialPriceHistory(req.user!.companyId);
  return sendPdf(res, result);
}

// 13. Measurement Book
export async function getMeasurementBookPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportMeasurementBook(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 14. Abstract Sheet
export async function getAbstractSheetPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportAbstractSheet(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 15. Project Material Rate Sheet
export async function getProjectMaterialRatesPdf(req: Request, res: Response) {
  const { id } = req.params;
  const result = await svc.reportProjectMaterialRates(req.user!.companyId, id);
  return sendPdf(res, result);
}

// 16. Subcontract WO Measurement Book
export async function getSubcontractMeasurementBookPdf(req: Request, res: Response) {
  const { id, woId } = req.params;
  const result = await svc.reportSubcontractMeasurementBook(req.user!.companyId, id, woId);
  return sendPdf(res, result);
}

// 17. Subcontract WO Abstract Sheet
export async function getSubcontractAbstractSheetPdf(req: Request, res: Response) {
  const { id, woId } = req.params;
  const result = await svc.reportSubcontractAbstractSheet(req.user!.companyId, id, woId);
  return sendPdf(res, result);
}