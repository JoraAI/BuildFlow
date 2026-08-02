/**
 * BuildFlow - Petty Cash / Site Expenses validators (Phase 5 §8.9).
 */
import { z } from 'zod';

export const PETTY_CASH_CATEGORIES = [
  'TRAVEL',
  'TEA_SNACKS',
  'STATIONERY',
  'REPAIRS',
  'MISC_CASH',
  'OTHER',
] as const;

export const createPettyCashEntrySchema = z.object({
  body: z.object({
    projectId: z.string().uuid().optional(),
    description: z.string().min(1, 'Description is required').max(500),
    category: z.enum(PETTY_CASH_CATEGORIES).default('OTHER'),
    amount: z.number().positive('Amount must be positive'),
    expenseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    paidTo: z.string().min(1, 'Paid to is required').max(200),
    receiptUrl: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const updatePettyCashEntrySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    description: z.string().min(1).max(500).optional(),
    category: z.enum(PETTY_CASH_CATEGORIES).optional(),
    amount: z.number().positive().optional(),
    expenseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    paidTo: z.string().min(1).max(200).optional(),
    receiptUrl: z.string().url().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    status: z.enum(['PENDING', 'RECONCILED', 'REJECTED']).optional(),
  }),
});

export const pettyCashEntryIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const pettyCashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'RECONCILED', 'REJECTED']).optional(),
  category: z.enum(PETTY_CASH_CATEGORIES).optional(),
});

export type CreatePettyCashEntryInput = z.infer<typeof createPettyCashEntrySchema>['body'];
export type UpdatePettyCashEntryInput = z.infer<typeof updatePettyCashEntrySchema>['body'];
export type PettyCashQueryInput = z.infer<typeof pettyCashQuerySchema>;