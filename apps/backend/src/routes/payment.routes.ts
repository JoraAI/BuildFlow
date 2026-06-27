/**
 * BuildFlow — Payment routes (Razorpay).
 */
import { Router } from 'express';
import * as ctrl from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Authenticated: create a payment link for an invoice (OWNER/PM/ACCOUNTANT)
router.post(
  '/invoices/:id/payment-link',
  authenticateToken,
  requireRole('OWNER', 'PM', 'ACCOUNTANT'),
  ctrl.createLink,
);

// Public webhook — must NOT use authenticateToken; HMAC verified in handler.
// Express.json is configured with verify for this route in app.ts.
router.post('/webhooks/razorpay', ctrl.webhook);

export default router;