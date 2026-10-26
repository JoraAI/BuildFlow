/**
 * Ice cream manufacturer + B2B buyer routes.
 * Staff: /api/inventory/ice-cream/*
 * Buyer public: /api/buyer/*
 */
import { Router } from 'express';
import * as ctrl from '../controllers/ice-cream.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { authenticateBuyer } from '../middleware/buyer-auth';
import { Role } from '@buildflow/shared';
import {
  createRecipeSchema,
  updateRecipeSchema,
  createProductionBatchSchema,
  completeProductionBatchSchema,
  inviteBuyerSchema,
  regenerateBuyerInviteSchema,
  claimBuyerInviteSchema,
  previewBuyerInviteSchema,
  buyerUpdateProfileSchema,
  setB2bPublishedSchema,
  updateSalesShippingSchema,
  buyerLoginSchema,
  buyerSendOtpSchema,
  buyerPlaceOrderSchema,
  switchBuyerMembershipSchema,
  createCashBookEntrySchema,
} from '@buildflow/shared';

export const iceCreamStaffRouter = Router();
iceCreamStaffRouter.use(authenticateToken);

iceCreamStaffRouter.get(
  '/recipes',
  requireInventoryFeature('recipes'),
  ctrl.listRecipes,
);
iceCreamStaffRouter.post(
  '/recipes',
  requireInventoryFeature('recipes'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: createRecipeSchema }),
  ctrl.createRecipe,
);
iceCreamStaffRouter.patch(
  '/recipes/:id',
  requireInventoryFeature('recipes'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: updateRecipeSchema }),
  ctrl.updateRecipe,
);
iceCreamStaffRouter.delete(
  '/recipes/:id',
  requireInventoryFeature('recipes'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.deleteRecipe,
);

iceCreamStaffRouter.get(
  '/production',
  requireInventoryFeature('production_batches'),
  ctrl.listProduction,
);
iceCreamStaffRouter.post(
  '/production',
  requireInventoryFeature('production_batches'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: createProductionBatchSchema }),
  ctrl.createProduction,
);
iceCreamStaffRouter.post(
  '/production/:id/complete',
  requireInventoryFeature('production_batches'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: completeProductionBatchSchema }),
  ctrl.completeProduction,
);
iceCreamStaffRouter.post(
  '/production/:id/cancel',
  requireInventoryFeature('production_batches'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.cancelProduction,
);

iceCreamStaffRouter.get(
  '/buyers',
  requireInventoryFeature('b2b_buyer_app'),
  ctrl.listBuyers,
);
iceCreamStaffRouter.get(
  '/buyers/invites',
  requireInventoryFeature('b2b_buyer_app'),
  ctrl.listBuyerInvites,
);
iceCreamStaffRouter.post(
  '/buyers/invite',
  requireInventoryFeature('b2b_buyer_app'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: inviteBuyerSchema }),
  ctrl.inviteBuyer,
);
iceCreamStaffRouter.post(
  '/buyers/invites/:inviteId/regenerate',
  requireInventoryFeature('b2b_buyer_app'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: regenerateBuyerInviteSchema }),
  ctrl.regenerateBuyerInvite,
);
iceCreamStaffRouter.post(
  '/buyers/:buyerId/revoke',
  requireInventoryFeature('b2b_buyer_app'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.revokeBuyer,
);
iceCreamStaffRouter.post(
  '/catalog/publish',
  requireInventoryFeature('b2b_buyer_app'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: setB2bPublishedSchema }),
  ctrl.setB2bPublished,
);

iceCreamStaffRouter.get(
  '/sales-dashboard',
  requireInventoryFeature('b2b_buyer_app'),
  ctrl.salesDashboard,
);
iceCreamStaffRouter.patch(
  '/sales-orders/:id/shipping',
  requireInventoryFeature('b2b_buyer_app'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: updateSalesShippingSchema }),
  ctrl.updateShipping,
);

// Legacy aliases — prefer /api/inventory/cash-book (all verticals).
iceCreamStaffRouter.get('/cash-book', requireInventoryFeature('cash_book'), ctrl.cashBookDay);
iceCreamStaffRouter.post(
  '/cash-book',
  requireInventoryFeature('cash_book'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: createCashBookEntrySchema }),
  ctrl.createCashBookEntry,
);
iceCreamStaffRouter.delete(
  '/cash-book/:id',
  requireInventoryFeature('cash_book'),
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.deleteCashBookEntry,
);
iceCreamStaffRouter.get(
  '/daily-sales-summary',
  requireInventoryFeature('cash_book'),
  ctrl.dailySalesSummary,
);

export const buyerPublicRouter = Router();
buyerPublicRouter.post(
  '/auth/send-otp',
  authLimiter,
  validate({ body: buyerSendOtpSchema }),
  ctrl.buyerSendOtp,
);
buyerPublicRouter.post('/auth/login', authLimiter, validate({ body: buyerLoginSchema }), ctrl.buyerLogin);
buyerPublicRouter.post(
  '/auth/preview-invite',
  authLimiter,
  validate({ body: previewBuyerInviteSchema }),
  ctrl.buyerPreviewInvite,
);
buyerPublicRouter.post(
  '/auth/claim-invite',
  authLimiter,
  validate({ body: claimBuyerInviteSchema }),
  ctrl.buyerClaimInvite,
);

buyerPublicRouter.get('/catalog', authenticateBuyer, ctrl.buyerCatalog);
buyerPublicRouter.get('/profile', authenticateBuyer, ctrl.buyerProfile);
buyerPublicRouter.get('/memberships', authenticateBuyer, ctrl.buyerMemberships);
buyerPublicRouter.post(
  '/memberships/switch',
  authenticateBuyer,
  validate({ body: switchBuyerMembershipSchema }),
  ctrl.buyerSwitchMembership,
);
buyerPublicRouter.patch(
  '/profile',
  authenticateBuyer,
  validate({ body: buyerUpdateProfileSchema }),
  ctrl.buyerUpdateProfile,
);
buyerPublicRouter.post(
  '/orders',
  authenticateBuyer,
  validate({ body: buyerPlaceOrderSchema }),
  ctrl.buyerPlaceOrder,
);
buyerPublicRouter.get('/orders', authenticateBuyer, ctrl.buyerOrders);
buyerPublicRouter.get('/orders/:id', authenticateBuyer, ctrl.buyerOrderDetail);
