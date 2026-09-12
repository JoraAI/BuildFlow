/**
 * BuildFlow - Common Zod validators & helpers
 */
import { z } from 'zod';

/** UUID v4-ish (cuid/uuid tolerant). Used for path params. */
export const idSchema = z.string().min(1).max(60);

/** Pagination query: ?page=1&limit=20&search=&sortBy=&sortOrder=asc */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(80).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/** Non-negative monetary amount in INR (2 decimals). */
export const amountSchema = z
  .number()
  .min(0)
  .max(1_00_00_00_000) // 100 Cr cap
  .refine((n) => Math.round(n * 100) === n * 100, 'Max 2 decimal places');

/** Percentage 0–100 (2 decimals allowed). */
export const percentSchema = z
  .number()
  .min(0)
  .max(100)
  .refine((n) => Math.round(n * 100) === n * 100, 'Max 2 decimal places');

/** Quantity ≥ 0 (up to 3 decimals for civil works). */
export const quantitySchema = z
  .number()
  .min(0)
  .max(1_00_00_000)
  .refine((n) => Math.round(n * 1000) === n * 1000, 'Max 3 decimal places');

/** Indian GSTIN: 15 chars, e.g. 36AABCR1234A1Z5. Empty is allowed. */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'GSTIN must be 15 characters (e.g. 36AABCR1234A1Z5)',
  )
  .optional()
  .or(z.literal(''));

/** Indian PAN: 10 chars, e.g. AABCR1234A. Empty is allowed. */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^$|^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'PAN must be 10 characters (e.g. AABCR1234A)')
  .optional()
  .or(z.literal(''));

/** HSN/SAC code (2–8 digits). */
export const hsnSacSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{2,8}$/, 'Invalid HSN/SAC')
  .optional()
  .or(z.literal(''));

/** ISO date string (YYYY-MM-DD). */
export const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/**
 * Normalize mobile numbers for storage/lookup.
 * 10-digit Indian mobiles become +91…; other inputs keep digits with a leading +.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (trimmed.startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

/** E.164-ish phone (8–15 digits after country code). */
export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Invalid phone number')
  .max(20)
  .transform(normalizePhone)
  .refine((p) => /^\+[1-9]\d{7,14}$/.test(p), 'Invalid phone number');