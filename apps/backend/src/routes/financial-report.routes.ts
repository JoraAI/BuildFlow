/**
 * BuildFlow - Financial reports routes.
 *
 *   GET /api/projects/:id/financials/pl
 *   GET /api/projects/:id/financials/cashflow
 *   GET /api/projects/:id/financials/estimate-vs-actual
 *   GET /api/projects/:id/financials/export-tally
 *   GET /api/company/financials/dashboard
 *   GET /api/company/financials/gst-report
 *   GET /api/company/financials/tds-report
 */
import { Router } from 'express';
import * as ctrl from '../controllers/financial-report.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Project-scoped reports
// FIX (FIN-M8): Gate financial routes with requireRole for OWNER, PM, ACCOUNTANT.
router.get('/projects/:id/financials/pl', requireRole('OWNER', 'PM', 'ACCOUNTANT'), ctrl.getProfitLoss);
router.get('/projects/:id/financials/cashflow', requireRole('OWNER', 'PM', 'ACCOUNTANT'), ctrl.getCashFlow);
router.get('/projects/:id/financials/estimate-vs-actual', requireRole('OWNER', 'PM', 'ACCOUNTANT'), ctrl.getEstimateVsActual);
router.get('/projects/:id/financials/export-tally', requireRole('OWNER', 'PM', 'ACCOUNTANT'), ctrl.exportProjectTally);

// Company-wide reports
router.get(
  '/company/financials/dashboard',
  requireRole('OWNER', 'ACCOUNTANT'),
  ctrl.getCompanyDashboard,
);
router.get(
  '/company/financials/gst-report',
  requireRole('OWNER', 'ACCOUNTANT'),
  ctrl.getGstReport,
);
router.get(
  '/company/financials/tds-report',
  requireRole('OWNER', 'ACCOUNTANT'),
  ctrl.getTdsReport,
);

export default router;