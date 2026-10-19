/**
 * Inventory cash book validators (all inventory verticals).
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

/** Preset expense categories for reporting (free-text still allowed via OTHER). */
export const CASH_EXPENSE_CATEGORIES = [
  'RENT',
  'SALARY',
  'UTILITIES',
  'FUEL',
  'PACKAGING',
  'MAINTENANCE',
  'MARKETING',
  'TRANSPORT',
  'RAW_MATERIAL',
  'MISC',
  'OTHER',
] as const;
export type CashExpenseCategory = (typeof CASH_EXPENSE_CATEGORIES)[number];
export const cashExpenseCategorySchema = z.enum(CASH_EXPENSE_CATEGORIES);

export const createCashBookEntrySchema = z.object({
  entryDate: z.coerce.date(),
  direction: cashBookDirectionSchema,
  entryType: cashBookEntryTypeSchema,
  paymentMode: cashBookPaymentModeSchema.default('CASH'),
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  /** Expense category (used when entryType === EXPENSE). */
  category: cashExpenseCategorySchema.optional(),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
export type CreateCashBookEntryInput = z.infer<typeof createCashBookEntrySchema>;

export const cashBookDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});
export type CashBookDayQuery = z.infer<typeof cashBookDayQuerySchema>;

export const profitLossQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ProfitLossQuery = z.infer<typeof profitLossQuerySchema>;
