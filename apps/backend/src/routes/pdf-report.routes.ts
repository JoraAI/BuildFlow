/**
 * BuildFlow — PDF report routes.
 * All 12 report types are exposed as PDF downloads.
 */
import { Router } from 'express';
import * as ctrl from '../controllers/pdf-report.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All reports require authentication
router.use(authenticateToken);

// 1. Project Progress Report
router.get('/projects/:id/progress', ctrl.getProjectProgressPdf);

// 2. Daily Report
router.get('/reports/:id', ctrl.getDailyReportPdf);

// 3. Invoice
router.get('/invoices/:id', ctrl.getInvoicePdf);

// 4. Estimate
router.get('/estimates/:id', ctrl.getEstimatePdf);

// 5. Estimate Comparison
router.get('/estimates/:idA/compare/:idB', ctrl.getEstimateComparisonPdf);

// 6. Estimate vs Actual
router.get('/projects/:id/estimate-vs-actual', ctrl.getEstimateVsActualPdf);

// 7. P&L
router.get('/projects/:id/profit-loss', ctrl.getProfitLossPdf);

// 8. GST Summary (OWNER/ACCOUNTANT only — financial compliance)
router.get('/gst-summary', requireRole('OWNER', 'ACCOUNTANT'), ctrl.getGstSummaryPdf);

// 9. TDS Report (OWNER/ACCOUNTANT only — financial compliance)
router.get('/tds', requireRole('OWNER', 'ACCOUNTANT'), ctrl.getTdsPdf);

// 10. Resource Utilization
router.get('/projects/:id/resource-utilization', ctrl.getResourceUtilizationPdf);

// 11. BOQ vs Actual
router.get('/projects/:id/boq-vs-actual', ctrl.getBoqVsActualPdf);

// 12. Material Price History
router.get('/material-price-history', ctrl.getMaterialPriceHistoryPdf);

// 13. Measurement Book (RA certified qty)
router.get('/projects/:id/measurement-book', ctrl.getMeasurementBookPdf);

// 14. Abstract Sheet
router.get('/projects/:id/abstract-sheet', ctrl.getAbstractSheetPdf);

export default router;