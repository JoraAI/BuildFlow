/**
 * BuildFlow — Payment routes (Razorpay invoice + SaaS billing webhooks).
 */
import { Router } from 'express';
import * as ctrl from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.post(
  '/invoices/:id/payment-link',
  authenticateToken,
  requireRole('OWNER', 'PM', 'ACCOUNTANT'),
  ctrl.createLink,
);

router.post('/webhooks/razorpay', ctrl.webhook);
router.post('/webhooks/razorpay/:companyId', ctrl.companyWebhook);
router.post('/webhooks/stripe/:companyId', ctrl.companyStripeWebhook);
router.post('/webhooks/saas/razorpay', ctrl.saasRazorpayWebhook);
router.post('/webhooks/saas/stripe', ctrl.saasStripeWebhook);

export default router;
