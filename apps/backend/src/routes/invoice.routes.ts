/**
 * BuildFlow - Invoice routes.
 *
 * Mounted at /api/invoices (detail-level) and within project router for project-scoped.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as invoiceController from '../controllers/invoice.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  idSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const idParams = z.object({ id: idSchema });

export const invoiceProjectRouter = Router();
invoiceProjectRouter.use(authenticateToken);

// Project-scoped invoice listing/creation
invoiceProjectRouter.get('/:id/invoices', validate({ params: idParams }), invoiceController.list);
invoiceProjectRouter.post(
  '/:id/invoices',
  // INVENTORY_PRODUCT: INVENTORY_MANAGER creates sales invoices for the store.
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT, Role.INVENTORY_MANAGER),
  validate({ params: idParams, body: createInvoiceSchema }),
  invoiceController.create,
);

// Detail-level routes mounted at /api/invoices
export const invoiceRouter = Router();
invoiceRouter.use(authenticateToken);

invoiceRouter.get('/:id', validate({ params: idParams }), invoiceController.get);
invoiceRouter.put(
  '/:id',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT, Role.INVENTORY_MANAGER),
  validate({ params: idParams, body: updateInvoiceSchema }),
  invoiceController.update,
);
invoiceRouter.post('/:id/send', validate({ params: idParams }), invoiceController.send);
// Alias `/record-payment` matches bills + mobile client; keep `/payment` for older callers.
invoiceRouter.post(
  '/:id/payment',
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.INVENTORY_MANAGER),
  validate({ params: idParams, body: recordPaymentSchema }),
  invoiceController.recordPayment,
);
invoiceRouter.post(
  '/:id/record-payment',
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.INVENTORY_MANAGER),
  validate({ params: idParams, body: recordPaymentSchema }),
  invoiceController.recordPayment,
);
invoiceRouter.delete(
  '/:id',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT, Role.INVENTORY_MANAGER),
  validate({ params: idParams }),
  invoiceController.remove,
);
