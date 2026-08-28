/**
 * BuildFlow - Transaction engine validators (INVENTORY_HORIZONTAL_PLATFORM Phase 2).
 * Sales Order → Delivery Challan → Invoice; sales/purchase returns; credit/debit
 * notes; customer credit-limit policy. Company + STORE project scoped.
 */
import { z } from 'zod';

export const salesOrderStatusSchema = z.enum(['DRAFT', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'CANCELLED']);
export const deliveryChallanStatusSchema = z.enum(['DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);
export const returnKindSchema = z.enum(['GOOD', 'DAMAGED']);
export const creditLimitPolicySchema = z.enum(['ALLOW', 'WARN', 'BLOCK']);

export const salesOrderLineSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(200),
  orderDate: z.coerce.date(),
  expectedDelivery: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(salesOrderLineSchema).min(1),
});
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const salesOrderActionSchema = z.object({ action: z.enum(['confirm', 'cancel']) });

export const createDeliveryChallanSchema = z.object({
  salesOrderId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): one batch code for the whole
  // challan (lite) - applied to every DC line → copied to each OUT movement.
  batchCode: z.string().max(50).optional(),
  // Optional: restrict to a subset of SO lines (defaults to all undelivered).
  lines: z
    .array(z.object({ salesOrderLineId: z.string().uuid(), quantity: z.coerce.number().positive(),
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): optional batch / lot code (lite).
      batchCode: z.string().max(50).optional() }))
    .optional(),
});
export type CreateDeliveryChallanInput = z.infer<typeof createDeliveryChallanSchema>;

export const createInvoiceFromSalesOrderSchema = z.object({
  // Route also accepts /sales-orders/:id/invoice with the id in the URL params.
  salesOrderId: z.string().uuid().optional(),
  invoiceNumber: z.string().max(50).optional(),
  dueDate: z.coerce.date().optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateInvoiceFromSalesOrderInput = z.infer<typeof createInvoiceFromSalesOrderSchema>;

export const salesReturnLineSchema = z.object({
  invoiceLineItemId: z.string().uuid().optional(),
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  returnKind: returnKindSchema.default('GOOD'),
});

export const createSalesReturnSchema = z.object({
  invoiceId: z.string().uuid(),
  returnDate: z.coerce.date(),
  reason: z.string().max(2000).optional(),
  targetLocationId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'ISSUED']).optional(),
  lines: z.array(salesReturnLineSchema).min(1),
});
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;

export const validateReturnScanSchema = z.object({
  barcode: z.string().min(1).max(100),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
export type ValidateReturnScanInput = z.infer<typeof validateReturnScanSchema>;

export const approveSalesReturnSchema = z.object({
  targetLocationId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type ApproveSalesReturnInput = z.infer<typeof approveSalesReturnSchema>;

export const purchaseReturnLineSchema = z.object({
  goodsReceiptLineId: z.string().uuid().optional(),
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
});

export const createPurchaseReturnSchema = z.object({
  billId: z.string().uuid().optional(),
  grnId: z.string().uuid().optional(),
  returnDate: z.coerce.date(),
  reason: z.string().max(2000).optional(),
  lines: z.array(purchaseReturnLineSchema).min(1),
});
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
