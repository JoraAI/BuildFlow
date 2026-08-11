/**
 * BuildFlow - Settings routes.
 *
 * Company profile, Users & Roles, Audit Log, Data Export, Role Permissions.
 * All routes require authentication. Permission-based guards (company-customizable).
 */
import { Router } from 'express';
import {
  getCompany,
  updateCompany,
  listCompanyUsers,
  updateUserRole,
  createUserInvite,
  listUserInvites,
  revokeUserInvite,
  resendUserInvite,
  getUserAudit,
  listAudit,
  getIntegrations,
  updateTwilioIntegration,
  updateRazorpayIntegration,
  updateStripeIntegration,
  updateTallyIntegration,
  updateGoogleMapsIntegration,
  updateLlmIntegration,
  updateS3Integration,
  getSubscription,
  createSubscriptionCheckout,
  exportData,
  exportDataZip,
  getMyProfile,
  updateMyProfile,
  createLogoUploadUrl,
  createTicket,
  listMyTickets,
  listTicketInbox,
  updateTicket,
  getReportSettings,
  updateReportSettings,
} from '../controllers/settings.controller';
import * as rateRegionController from '../controllers/rate-region.controller';
import * as permissionController from '../controllers/permission.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../middleware/audit';
import {
  companyUpdateSchema,
  userRoleUpdateSchema,
  auditQuerySchema,
  createUserInviteSchema,
  myProfileUpdateSchema,
  logoUploadSchema,
  createTicketSchema,
  updateTicketSchema,
  twilioIntegrationSchema,
  razorpayIntegrationSchema,
  stripeIntegrationSchema,
  tallyIntegrationSchema,
  googleMapsIntegrationSchema,
  llmIntegrationSchema,
  s3IntegrationSchema,
  updateReportSettingsSchema,
  saasCheckoutSchema,
  createRateRegionSchema,
  updateRateRegionSchema,
  rateRegionParamsSchema,
  bulkUpsertRegionalRatesSchema,
} from '@buildflow/shared';

const router = Router();

// My profile (all authenticated users)
router.get('/me', authenticateToken, getMyProfile);
router.patch(
  '/me',
  authenticateToken,
  validate({ body: myProfileUpdateSchema }),
  auditLog('UPDATE', 'UserProfile'),
  updateMyProfile,
);

// Company profile
router.get('/company', authenticateToken, getCompany);
router.put(
  '/company',
  authenticateToken,
  requirePermission('settings.company'),
  validate({ body: companyUpdateSchema }),
  auditLog('UPDATE', 'Company'),
  updateCompany,
);

// RPT-C2a/c: Report settings (with Zod validation on PATCH)
router.get('/report-settings', authenticateToken, getReportSettings);
router.patch(
  '/report-settings',
  authenticateToken,
  requirePermission('settings.company'),
  validate({ body: updateReportSettingsSchema }),
  updateReportSettings,
);

router.post(
  '/company/logo/upload-url',
  authenticateToken,
  requirePermission('settings.company'),
  validate({ body: logoUploadSchema }),
  createLogoUploadUrl,
);

// Support tickets
router.post(
  '/tickets',
  authenticateToken,
  validate({ body: createTicketSchema }),
  createTicket,
);
router.get('/tickets/mine', authenticateToken, listMyTickets);
router.get('/tickets/inbox', authenticateToken, requirePermission('settings.tickets'), listTicketInbox);
router.patch(
  '/tickets/:ticketId',
  authenticateToken,
  requirePermission('settings.tickets'),
  validate({ body: updateTicketSchema }),
  updateTicket,
);

// Users & Roles
router.get('/users', authenticateToken, requirePermission('settings.users'), listCompanyUsers);
router.get('/users/:userId/audit', authenticateToken, requirePermission('settings.users'), getUserAudit);
router.put(
  '/users/:userId',
  authenticateToken,
  requirePermission('settings.users'),
  validate({ body: userRoleUpdateSchema }),
  auditLog('UPDATE', 'User'),
  updateUserRole,
);

router.post(
  '/users/invite',
  authenticateToken,
  requirePermission('settings.users'),
  validate({ body: createUserInviteSchema }),
  asyncHandler(createUserInvite),
);
router.get('/users/invites', authenticateToken, requirePermission('settings.users'), listUserInvites);
router.delete(
  '/users/invites/:inviteId',
  authenticateToken,
  requirePermission('settings.users'),
  asyncHandler(revokeUserInvite),
);
router.post(
  '/users/invites/:inviteId/resend',
  authenticateToken,
  requirePermission('settings.users'),
  asyncHandler(resendUserInvite),
);

// Audit Log
router.get('/audit', authenticateToken, requirePermission('settings.audit'), validate({ query: auditQuerySchema }), listAudit);

// Integrations (company-scoped credentials)
router.get('/integrations', authenticateToken, requirePermission('settings.integrations'), getIntegrations);
router.put(
  '/integrations/twilio',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: twilioIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateTwilioIntegration,
);
router.put(
  '/integrations/razorpay',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: razorpayIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateRazorpayIntegration,
);
router.put(
  '/integrations/stripe',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: stripeIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateStripeIntegration,
);
router.put(
  '/integrations/tally',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: tallyIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateTallyIntegration,
);
router.put(
  '/integrations/google-maps',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: googleMapsIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateGoogleMapsIntegration,
);
router.put(
  '/integrations/llm',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: llmIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateLlmIntegration,
);
router.put(
  '/integrations/s3',
  authenticateToken,
  requirePermission('settings.integrations'),
  validate({ body: s3IntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateS3Integration,
);

// Subscription / billing
router.get('/subscription', authenticateToken, requirePermission('settings.billing'), getSubscription);
router.post(
  '/subscription/checkout',
  authenticateToken,
  requirePermission('settings.billing'),
  validate({ body: saasCheckoutSchema }),
  createSubscriptionCheckout,
);

// Data Export
router.get('/export', authenticateToken, requirePermission('settings.export'), exportData);
router.get('/export/zip', authenticateToken, requirePermission('settings.export'), exportDataZip);

// Rate regions (regional material rate books)
router.get('/rate-regions', authenticateToken, requireAnyPermission(['settings.rate_regions', 'settings.material_prices']), rateRegionController.listRateRegions);
router.post(
  '/rate-regions',
  authenticateToken,
  requirePermission('settings.rate_regions'),
  validate({ body: createRateRegionSchema }),
  rateRegionController.createRateRegion,
);
router.put(
  '/rate-regions/:regionId',
  authenticateToken,
  requirePermission('settings.rate_regions'),
  validate({ params: rateRegionParamsSchema, body: updateRateRegionSchema }),
  rateRegionController.updateRateRegion,
);
router.delete(
  '/rate-regions/:regionId',
  authenticateToken,
  requirePermission('settings.rate_regions'),
  validate({ params: rateRegionParamsSchema }),
  rateRegionController.deleteRateRegion,
);
router.get(
  '/rate-regions/:regionId/rates',
  authenticateToken,
  requireAnyPermission(['settings.rate_regions', 'settings.material_prices']),
  validate({ params: rateRegionParamsSchema }),
  rateRegionController.listRegionalRates,
);
router.put(
  '/rate-regions/:regionId/rates',
  authenticateToken,
  requirePermission('settings.rate_regions'),
  validate({ params: rateRegionParamsSchema, body: bulkUpsertRegionalRatesSchema }),
  rateRegionController.upsertRegionalRates,
);

// ── Role Permissions (company-customizable) ──────────────────────────
router.get(
  '/permissions',
  authenticateToken,
  requirePermission('settings.permissions'),
  permissionController.getPermissions,
);
router.put(
  '/permissions/:role',
  authenticateToken,
  requirePermission('settings.permissions'),
  auditLog('UPDATE', 'RolePermissions'),
  permissionController.updateRolePermissions,
);
router.post(
  '/permissions/:role/reset',
  authenticateToken,
  requirePermission('settings.permissions'),
  permissionController.resetRolePermissions,
);
router.post(
  '/permissions/reset',
  authenticateToken,
  requirePermission('settings.permissions'),
  permissionController.resetAllRolePermissions,
);

export default router;