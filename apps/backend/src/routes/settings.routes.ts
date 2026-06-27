/**
 * BuildFlow — Settings routes.
 *
 * Company profile, Users & Roles, Audit Log, Data Export.
 * All routes require authentication. Company mutations + Users require OWNER.
 */
import { Router } from 'express';
import {
  getCompany,
  updateCompany,
  listCompanyUsers,
  updateUserRole,
  getUserAudit,
  listAudit,
  getIntegrations,
  exportData,
  exportDataZip,
} from '../controllers/settings.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  companyUpdateSchema,
  userRoleUpdateSchema,
  auditQuerySchema,
} from '@buildflow/shared';

const router = Router();

// Company profile
router.get('/company', authenticateToken, getCompany);
router.put(
  '/company',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: companyUpdateSchema }),
  auditLog('UPDATE', 'Company'),
  updateCompany,
);

// Users & Roles
router.get('/users', authenticateToken, requireRole('OWNER'), listCompanyUsers);
router.get('/users/:userId/audit', authenticateToken, requireRole('OWNER'), getUserAudit);
router.put(
  '/users/:userId',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: userRoleUpdateSchema }),
  auditLog('UPDATE', 'User'),
  updateUserRole,
);

// Audit Log
router.get('/audit', authenticateToken, requireRole('OWNER'), validate({ query: auditQuerySchema }), listAudit);

// Integrations status
router.get('/integrations', authenticateToken, requireRole('OWNER'), getIntegrations);

// Data Export
router.get('/export', authenticateToken, requireRole('OWNER'), exportData);
router.get('/export/zip', authenticateToken, requireRole('OWNER'), exportDataZip);

export default router;
