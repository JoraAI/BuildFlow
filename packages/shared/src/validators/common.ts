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

/** Indian GSTIN: 15 chars, e.g. 36AABCR1234A1Z5 */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')
  .optional()
  .or(z.literal(''));

/** Indian PAN: 10 chars, e.g. AABCR1234A */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN')
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