/**
 * BuildFlow - Transaction engine routes (INVENTORY_HORIZONTAL_PLATFORM Phase 2).
 *
 * Mounted at /api/inventory/transactions and gated to the INVENTORY plan via the
 * `sales_orders` feature flag - construction tenants get 403.
 */
import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { idSchema } from '@buildflow/shared';
import {
  createSalesOrderSchema,
  salesOrderActionSchema,
  createDeliveryChallanSchema,
  createInvoiceFromSalesOrderSchema,
  createSalesReturnSchema,
  createPurchaseReturnSchema,
  validateReturnScanSchema,
  approveSalesReturnSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';
import { z } from 'zod';

export const transactionRouter = Router();

transactionRouter.use(authenticateToken);
transactionRouter.use(requireInventoryFeature('sales_orders'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);
const idParams = z.object({ id: idSchema });

// Sales orders
transactionRouter.get('/sales-orders', transactionController.listSalesOrders);
transactionRouter.post('/sales-orders', canManage, validate({ body: createSalesOrderSchema }), transactionController.createSalesOrder);
transactionRouter.get('/sales-orders/:id', validate({ params: idParams }), transactionController.getSalesOrder);
transactionRouter.post('/sales-orders/:id/action', canManage, validate({ params: idParams, body: salesOrderActionSchema }), transactionController.updateSalesOrderStatus);
transactionRouter.post('/sales-orders/:id/invoice', canManage, validate({ params: idParams, body: createInvoiceFromSalesOrderSchema }), transactionController.createInvoiceFromSalesOrder);

// Delivery challans
transactionRouter.get('/delivery-challans', transactionController.listDeliveryChallans);
transactionRouter.post('/delivery-challans', canManage, validate({ body: createDeliveryChallanSchema }), transactionController.createDeliveryChallan);
transactionRouter.post(
  '/delivery-challans/:id/dispatch',
  canManage,
  validate({ params: idParams, body: z.object({ locationId: z.string().uuid().optional() }) }),
  transactionController.dispatchDeliveryChallan,
);
transactionRouter.post('/delivery-challans/:id/deliver', canManage, validate({ params: idParams }), transactionController.deliverDeliveryChallan);

// Returns
transactionRouter.get('/returns/sales', transactionController.listSalesReturns);
transactionRouter.post('/returns/sales', canManage, validate({ body: createSalesReturnSchema }), transactionController.createSalesReturn);
transactionRouter.post(
  '/returns/sales/:id/approve',
  canManage,
  validate({ params: idParams, body: approveSalesReturnSchema }),
  transactionController.approveSalesReturn,
);
transactionRouter.post(
  '/returns/validate-scan',
  canManage,
  validate({ body: validateReturnScanSchema }),
  transactionController.validateReturnScan,
);
transactionRouter.get('/returns/purchase', transactionController.listPurchaseReturns);
transactionRouter.post('/returns/purchase', canManage, validate({ body: createPurchaseReturnSchema }), transactionController.createPurchaseReturn);

// Notes
transactionRouter.get('/notes/credit', transactionController.listCreditNotes);
transactionRouter.get('/notes/debit', transactionController.listDebitNotes);
// INVENTORY_HORIZONTAL_PLATFORM (Phase 5.4): issue a DRAFT note so Tally exports it.
transactionRouter.post('/notes/credit/:id/issue', canManage, validate({ params: idParams }), transactionController.issueCreditNote);
transactionRouter.post('/notes/debit/:id/issue', canManage, validate({ params: idParams }), transactionController.issueDebitNote);
