/**
 * BuildFlow - Petty Cash / Site Expenses validators (Phase 5 §8.9).
 */
import { z } from 'zod';

/**
 * Canonical category codes stored on PettyCashEntry.category.
 * Keep legacy Phase-5 codes plus field (Powerplay-style) codes used by mobile.
 */
export const PETTY_CASH_CATEGORIES = [
  // Legacy API codes
  'TRAVEL',
  'TEA_SNACKS',
  'STATIONERY',
  'REPAIRS',
  'MISC_CASH',
  'OTHER',
  // Field / site UI codes
  'FUEL_DG',
  'HARDWARE',
  'URGENT_LABOR',
  'MATERIALS',
] as const;

export type PettyCashCategory = (typeof PETTY_CASH_CATEGORIES)[number];

/** Display labels for chips / badges (shared so web + mobile stay aligned). */
export const PETTY_CASH_CATEGORY_LABELS: Record<PettyCashCategory, string> = {
  TRAVEL: 'Travel',
  TEA_SNACKS: 'Tea / Meals',
  STATIONERY: 'Stationery',
  REPAIRS: 'Repairs',
  MISC_CASH: 'Misc',
  OTHER: 'Other',
  FUEL_DG: 'Fuel / DG',
  HARDWARE: 'Hardware',
  URGENT_LABOR: 'Urgent Labor',
  MATERIALS: 'Materials',
};

/** Primary chips shown when logging a site expense (ordered for field use). */
export const PETTY_CASH_UI_CATEGORIES = [
  'FUEL_DG',
  'TEA_SNACKS',
  'HARDWARE',
  'TRAVEL',
  'URGENT_LABOR',
  'MATERIALS',
  'MISC_CASH',
] as const satisfies readonly PettyCashCategory[];

export type PettyCashUiCategory = (typeof PETTY_CASH_UI_CATEGORIES)[number];

export const PETTY_CASH_STATUSES = ['PENDING', 'RECONCILED', 'REJECTED'] as const;
export type PettyCashStatus = (typeof PETTY_CASH_STATUSES)[number];

/** Accept optional receipt: http(s) URL or data:image… (camera capture). */
const receiptUrlSchema = z
  .string()
  .max(5_000_000)
  .refine(
    (v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v),
    'Receipt must be an image URL or captured image',
  );

export const createPettyCashEntrySchema = z.object({
  body: z.object({
    projectId: z.string().uuid().optional(),
    description: z.string().min(1, 'Description is required').max(500),
    category: z.enum(PETTY_CASH_CATEGORIES).default('OTHER'),
    amount: z.number().positive('Amount must be positive'),
    expenseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    paidTo: z.string().min(1, 'Paid to is required').max(200),
    receiptUrl: receiptUrlSchema.optional(),
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
    receiptUrl: receiptUrlSchema.nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    status: z.enum(PETTY_CASH_STATUSES).optional(),
  }),
});

export const pettyCashEntryIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const pettyCashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  status: z.enum(PETTY_CASH_STATUSES).optional(),
  category: z.enum(PETTY_CASH_CATEGORIES).optional(),
});

export type CreatePettyCashEntryInput = z.infer<typeof createPettyCashEntrySchema>['body'];
export type UpdatePettyCashEntryInput = z.infer<typeof updatePettyCashEntrySchema>['body'];
export type PettyCashQueryInput = z.infer<typeof pettyCashQuerySchema>;
