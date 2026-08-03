/**
 * BuildFlow - Shared Zod validators for Accounting (invoices, bills, journal).
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Invoice                                                             */
/* ------------------------------------------------------------------ */

export const invoiceLineItemSchema = z.object({
  boqItemId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(28).default(18),
  hsnSacCode: z.string().max(15).optional(),
  previousQty: z.coerce.number().nonnegative().optional(),
  currentQty: z.coerce.number().nonnegative().optional(),
  cumulativeQty: z.coerce.number().nonnegative().optional(),
});
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const createInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(50),
  clientName: z.string().min(1).max(200),
  clientGstin: z.string().max(15).optional(),
  clientState: z.string().max(40).optional(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  gstRate: z.coerce.number().min(0).max(28).default(18),
  tdsEnabled: z.boolean().default(false),
  tdsRate: z.coerce.number().min(0).max(30).default(2),
  notes: z.string().max(2000).optional(),
  invoiceType: z.enum(['STANDARD', 'RUNNING_ACCOUNT', 'MILESTONE']).default('STANDARD'),
  raSequence: z.coerce.number().int().positive().optional(),
  milestoneLabel: z.string().max(200).optional(),
  retentionPct: z.coerce.number().min(0).max(100).default(0),
  lineItems: z.array(invoiceLineItemSchema).min(1),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = z.object({
  clientName: z.string().min(1).max(200).optional(),
  clientGstin: z.string().max(15).optional(),
  clientState: z.string().max(40).optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  gstRate: z.coerce.number().min(0).max(28).optional(),
  tdsEnabled: z.boolean().optional(),
  tdsRate: z.coerce.number().min(0).max(30).optional(),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(invoiceLineItemSchema).optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date().optional(),
  reference: z.string().max(100).optional(),
  method: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'OTHER']).default('BANK'),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

/* ------------------------------------------------------------------ */
/* Bill                                                                */
/* ------------------------------------------------------------------ */

export const createBillSchema = z.object({
  projectId: z.string().uuid(),
  billNumber: z.string().min(1).max(50).optional(),
  vendorName: z.string().min(1).max(200),
  vendorGstin: z.string().max(15).optional(),
  vendorState: z.string().max(40).optional(),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  subtotal: z.coerce.number().nonnegative(),
  gstAmount: z.coerce.number().nonnegative().default(0),
  tdsAmount: z.coerce.number().nonnegative().default(0),
  category: z.enum(['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER']).default('OTHER'),
  notes: z.string().max(2000).optional(),
  // PROC-B3: Link bill to purchase order for procurement workflow.
  purchaseOrderId: z.string().uuid().optional(),
  // PROC-B5: Vendor invoice attachment (PDF/image URL from storage).
  attachmentUrl: z.string().max(2000).optional(),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const updateBillSchema = z.object({
  vendorName: z.string().min(1).max(200).optional(),
  vendorGstin: z.string().max(15).optional(),
  vendorState: z.string().max(40).optional(),
  billDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  subtotal: z.coerce.number().nonnegative().optional(),
  gstAmount: z.coerce.number().nonnegative().optional(),
  tdsAmount: z.coerce.number().nonnegative().optional(),
  category: z.enum(['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER']).optional(),
  notes: z.string().max(2000).optional(),
});
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

/* ------------------------------------------------------------------ */
/* Journal Entry                                                       */
/* ------------------------------------------------------------------ */

export const createJournalSchema = z.object({
  projectId: z.string().uuid().optional(),
  entryDate: z.coerce.date(),
  description: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
  debitAccount: z.string().min(1).max(100),
  creditAccount: z.string().min(1).max(100),
  amount: z.coerce.number().positive(),
});
export type CreateJournalInput = z.infer<typeof createJournalSchema>;