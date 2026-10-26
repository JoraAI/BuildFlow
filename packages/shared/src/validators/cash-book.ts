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

/** Preset expense categories seeded per company (shops can add / rename / hide). */
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

export function slugifyCashCategory(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'OTHER';
}

export const cashBookCategoryNameSchema = z.string().trim().min(1).max(60);
export const createCashBookCategorySchema = z.object({
  name: cashBookCategoryNameSchema,
});
export type CreateCashBookCategoryInput = z.infer<typeof createCashBookCategorySchema>;
export const updateCashBookCategorySchema = z.object({
  name: cashBookCategoryNameSchema,
});
export type UpdateCashBookCategoryInput = z.infer<typeof updateCashBookCategorySchema>;

export const createCashBookEntrySchema = z.object({
  entryDate: z.coerce.date(),
  direction: cashBookDirectionSchema,
  entryType: cashBookEntryTypeSchema,
  paymentMode: cashBookPaymentModeSchema.default('CASH'),
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  /** Expense category slug (used when entryType === EXPENSE). */
  category: z.string().trim().min(1).max(40).optional(),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
export type CreateCashBookEntryInput = z.infer<typeof createCashBookEntrySchema>;

export const cashBookDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});
export type CashBookDayQuery = z.infer<typeof cashBookDayQuerySchema>;

export const cashBookIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const profitLossQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ProfitLossQuery = z.infer<typeof profitLossQuerySchema>;
