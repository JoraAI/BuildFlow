/**
 * Inventory cash book validators (ICE_CREAM manufacture cash drawer).
 */
import { z } from 'zod';

export const cashBookDirectionSchema = z.enum(['IN', 'OUT']);
export const cashBookEntryTypeSchema = z.enum([
  'OPENING',
  'SALE_COLLECTION',
  'EXPENSE',
  'DEPOSIT',
  'ADJUSTMENT',
]);
export const cashBookPaymentModeSchema = z.enum(['CASH', 'UPI', 'BANK', 'OTHER']);

export const createCashBookEntrySchema = z.object({
  entryDate: z.coerce.date(),
  direction: cashBookDirectionSchema,
  entryType: cashBookEntryTypeSchema,
  paymentMode: cashBookPaymentModeSchema.default('CASH'),
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
export type CreateCashBookEntryInput = z.infer<typeof createCashBookEntrySchema>;

export const cashBookDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});
export type CashBookDayQuery = z.infer<typeof cashBookDayQuerySchema>;
