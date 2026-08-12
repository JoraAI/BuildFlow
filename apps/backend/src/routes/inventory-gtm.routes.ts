/**
 * BuildFlow - Inventory GTM routes (INVENTORY_HORIZONTAL_PLATFORM Phase 9).
 *
 * Mounted at /api/inventory (after the warehouse router) - every Phase 9 route
 * is gated by `requireInventoryFeature('stock_adjustments')` so construction
 * tenants get 403. Writes require OWNER / INVENTORY_MANAGER.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as gtm from '../controllers/inventory-gtm.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { Role, idSchema } from '@buildflow/shared';
import {
  customerPriceSchema,
  customerPriceIdParamsSchema,
  createQuoteSchema,
  quoteStatusActionSchema,
} from '@buildflow/shared';

export const inventoryGtmRouter = Router();

inventoryGtmRouter.use(authenticateToken);
inventoryGtmRouter.use(requireInventoryFeature('stock_adjustments'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);
const idParams = z.object({ id: idSchema });

// 9.1 Customer price lists.
inventoryGtmRouter.get('/price-list', gtm.listPrices);
inventoryGtmRouter.post('/price-list', canManage, validate({ body: customerPriceSchema }), gtm.upsertPrice);
inventoryGtmRouter.delete(
  '/price-list/:id',
  canManage,
  validate({ params: customerPriceIdParamsSchema }),
  gtm.deletePrice,
);

// 9.2 Quote → Sales Order.
inventoryGtmRouter.get('/quotes', gtm.listQuotesCtrl);
inventoryGtmRouter.post('/quotes', canManage, validate({ body: createQuoteSchema }), gtm.createQuoteCtrl);
inventoryGtmRouter.post(
  '/quotes/:id/action',
  canManage,
  validate({ params: idParams, body: quoteStatusActionSchema }),
  gtm.quoteAction,
);
inventoryGtmRouter.post('/quotes/:id/sales-order', canManage, validate({ params: idParams }), gtm.quoteToSalesOrder);

// 9.4 Payment reminders (manual "Remind" on an invoice).
inventoryGtmRouter.post('/invoices/:id/remind', canManage, validate({ params: idParams }), gtm.remindInvoice);

// 9.3 Printable PDFs for inventory documents.
inventoryGtmRouter.get('/pdf/sales-orders/:id', validate({ params: idParams }), gtm.salesOrderPdf);
inventoryGtmRouter.get('/pdf/delivery-challans/:id', validate({ params: idParams }), gtm.deliveryChallanPdf);
inventoryGtmRouter.get('/pdf/grn/:id', validate({ params: idParams }), gtm.goodsReceiptPdf);
