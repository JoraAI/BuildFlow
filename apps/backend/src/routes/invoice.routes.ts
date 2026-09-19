/**
 * BuildFlow - Invoice routes.
 *
 * Mounted at /api/invoices (detail-level) and within project router for project-scoped.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as invoiceController from '../controllers/invoice.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  idSchema,
} from '@buildflow/shared';

const idParams = z.object({ id: idSchema });

export const invoiceProjectRouter = Router();
invoiceProjectRouter.use(authenticateToken);

// Project-scoped invoice listing/creation — follow permission tags.
invoiceProjectRouter.get(
  '/:id/invoices',
  requirePermission('invoice.view'),
  validate({ params: idParams }),
  invoiceController.list,
);
invoiceProjectRouter.post(
  '/:id/invoices',
  requirePermission('invoice.create'),
  validate({ params: idParams, body: createInvoiceSchema }),
  invoiceController.create,
);

// Detail-level routes mounted at /api/invoices
export const invoiceRouter = Router();
invoiceRouter.use(authenticateToken);

invoiceRouter.get(
  '/:id',
  requirePermission('invoice.view'),
  validate({ params: idParams }),
  invoiceController.get,
);
invoiceRouter.put(
  '/:id',
  requirePermission('invoice.create'),
  validate({ params: idParams, body: updateInvoiceSchema }),
  invoiceController.update,
);
invoiceRouter.post(
  '/:id/send',
  requirePermission('invoice.create'),
  validate({ params: idParams }),
  invoiceController.send,
);
invoiceRouter.post(
  '/:id/payment',
  requirePermission('invoice.record_payment'),
  validate({ params: idParams, body: recordPaymentSchema }),
  invoiceController.recordPayment,
);
invoiceRouter.post(
  '/:id/record-payment',
  requirePermission('invoice.record_payment'),
  validate({ params: idParams, body: recordPaymentSchema }),
  invoiceController.recordPayment,
);
invoiceRouter.delete(
  '/:id',
  requirePermission('invoice.create'),
  validate({ params: idParams }),
  invoiceController.remove,
);
