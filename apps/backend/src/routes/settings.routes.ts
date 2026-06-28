/**
 * BuildFlow - Settings routes.
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
} from '../controllers/settings.controller';
import * as rateRegionController from '../controllers/rate-region.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
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
  requireRole('OWNER'),
  validate({ body: companyUpdateSchema }),
  auditLog('UPDATE', 'Company'),
  updateCompany,
);

router.post(
  '/company/logo/upload-url',
  authenticateToken,
  requireRole('OWNER'),
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
router.get('/tickets/inbox', authenticateToken, requireRole('OWNER'), listTicketInbox);
router.patch(
  '/tickets/:ticketId',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: updateTicketSchema }),
  updateTicket,
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

router.post(
  '/users/invite',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: createUserInviteSchema }),
  createUserInvite,
);
router.get('/users/invites', authenticateToken, requireRole('OWNER'), listUserInvites);
router.delete(
  '/users/invites/:inviteId',
  authenticateToken,
  requireRole('OWNER'),
  revokeUserInvite,
);
router.post(
  '/users/invites/:inviteId/resend',
  authenticateToken,
  requireRole('OWNER'),
  resendUserInvite,
);

// Audit Log
router.get('/audit', authenticateToken, requireRole('OWNER'), validate({ query: auditQuerySchema }), listAudit);

// Integrations (company-scoped credentials; OWNER only)
router.get('/integrations', authenticateToken, requireRole('OWNER'), getIntegrations);
router.put(
  '/integrations/twilio',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: twilioIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateTwilioIntegration,
);
router.put(
  '/integrations/razorpay',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: razorpayIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateRazorpayIntegration,
);
router.put(
  '/integrations/stripe',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: stripeIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateStripeIntegration,
);
router.put(
  '/integrations/tally',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: tallyIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateTallyIntegration,
);
router.put(
  '/integrations/google-maps',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: googleMapsIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateGoogleMapsIntegration,
);
router.put(
  '/integrations/llm',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: llmIntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateLlmIntegration,
);
router.put(
  '/integrations/s3',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: s3IntegrationSchema }),
  auditLog('UPDATE', 'CompanyIntegration'),
  updateS3Integration,
);

// Subscription / billing
router.get('/subscription', authenticateToken, requireRole('OWNER'), getSubscription);
router.post(
  '/subscription/checkout',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: saasCheckoutSchema }),
  createSubscriptionCheckout,
);

// Data Export
router.get('/export', authenticateToken, requireRole('OWNER'), exportData);
router.get('/export/zip', authenticateToken, requireRole('OWNER'), exportDataZip);

// Rate regions (regional material rate books)
router.get('/rate-regions', authenticateToken, requireRole('OWNER', 'PM'), rateRegionController.listRateRegions);
router.post(
  '/rate-regions',
  authenticateToken,
  requireRole('OWNER'),
  validate({ body: createRateRegionSchema }),
  rateRegionController.createRateRegion,
);
router.put(
  '/rate-regions/:regionId',
  authenticateToken,
  requireRole('OWNER'),
  validate({ params: rateRegionParamsSchema, body: updateRateRegionSchema }),
  rateRegionController.updateRateRegion,
);
router.delete(
  '/rate-regions/:regionId',
  authenticateToken,
  requireRole('OWNER'),
  validate({ params: rateRegionParamsSchema }),
  rateRegionController.deleteRateRegion,
);
router.get(
  '/rate-regions/:regionId/rates',
  authenticateToken,
  requireRole('OWNER', 'PM'),
  validate({ params: rateRegionParamsSchema }),
  rateRegionController.listRegionalRates,
);
router.put(
  '/rate-regions/:regionId/rates',
  authenticateToken,
  requireRole('OWNER'),
  validate({ params: rateRegionParamsSchema, body: bulkUpsertRegionalRatesSchema }),
  rateRegionController.upsertRegionalRates,
);

export default router;
