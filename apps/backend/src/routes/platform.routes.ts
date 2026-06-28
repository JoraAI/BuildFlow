/**
 * BuildFlow — Platform admin routes (cross-tenant).
 */
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticatePlatformAdmin } from '../middleware/platform-auth';
import {
  platformLoginSchema,
  platformCompanyUpdateSchema,
  platformSubscriptionUpdateSchema,
  platformUserUpdateSchema,
  platformTicketUpdateSchema,
} from '@buildflow/shared';
import * as ctrl from '../controllers/platform.controller';

const router = Router();

router.post('/auth/login', validate({ body: platformLoginSchema }), ctrl.login);
router.get('/auth/me', authenticatePlatformAdmin, ctrl.me);

router.get('/companies', authenticatePlatformAdmin, ctrl.listCompanies);
router.get('/companies/:companyId', authenticatePlatformAdmin, ctrl.getCompany);
router.patch(
  '/companies/:companyId',
  authenticatePlatformAdmin,
  validate({ body: platformCompanyUpdateSchema }),
  ctrl.patchCompany,
);
router.patch(
  '/companies/:companyId/subscription',
  authenticatePlatformAdmin,
  validate({ body: platformSubscriptionUpdateSchema }),
  ctrl.patchSubscription,
);
router.patch(
  '/companies/:companyId/users/:userId',
  authenticatePlatformAdmin,
  validate({ body: platformUserUpdateSchema }),
  ctrl.patchUser,
);

router.get('/tickets', authenticatePlatformAdmin, ctrl.listTickets);
router.patch(
  '/tickets/:ticketId',
  authenticatePlatformAdmin,
  validate({ body: platformTicketUpdateSchema }),
  ctrl.patchTicket,
);

export default router;
